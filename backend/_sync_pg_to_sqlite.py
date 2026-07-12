"""Copy all data from the live Render Postgres DB into the local SQLite app.db.

Invoked by `python cli.py db sync` using the backend venv's Python (so SQLAlchemy
and psycopg2 are available). The live database is only ever READ; all writes go
to the local SQLite file.

Reads two env vars:
    SYNC_SOURCE_URL   live Postgres URL   (postgresql://...)
    SYNC_DEST_URL     local SQLite URL    (sqlite:///.../app.db)

Strategy: the SQLite schema already exists (created by the app's migrations), so
this only refreshes DATA -- it clears each local table and re-copies rows from
live. Only tables/columns present in BOTH databases are touched, so minor schema
drift degrades gracefully instead of crashing.
"""
import json
import os
import sys

from sqlalchemy import (Boolean, Float, Integer, MetaData, Numeric,
                        create_engine, insert, select)


def _placeholder(column, record, used):
    """Build a non-null value for a local column the live DB doesn't provide
    (schema drift). Used only for NOT NULL local-only columns so the row can be
    inserted. Prefers a readable, unique value derived from the row's email."""
    col_type = column.type
    if isinstance(col_type, (Integer, Numeric, Float)):
        return 0
    if isinstance(col_type, Boolean):
        return False
    # Text-like: prefer the email's name-part (e.g. "john" from john@x.com),
    # falling back to the column name; make it unique within this table.
    email = record.get("email")
    base = email.split("@")[0] if isinstance(email, str) and "@" in email else column.name
    candidate, n = base, 1
    while candidate in used:
        n += 1
        candidate = f"{base}{n}"
    used.add(candidate)
    return candidate


def main():
    src_url = os.environ.get("SYNC_SOURCE_URL")
    dst_url = os.environ.get("SYNC_DEST_URL")
    if not src_url or not dst_url:
        print("SYNC_SOURCE_URL and SYNC_DEST_URL must both be set.", file=sys.stderr)
        return 1

    src = create_engine(src_url)
    dst = create_engine(dst_url)

    # Learn the shape of both databases.
    src_meta = MetaData()
    src_meta.reflect(bind=src)
    dst_meta = MetaData()
    dst_meta.reflect(bind=dst)
    dst_tables = dst_meta.tables

    # sorted_tables orders parents before children (FK dependency order).
    ordered = src_meta.sorted_tables

    total = 0
    with src.connect() as sconn, dst.begin() as dconn:
        # Clear local tables first, children before parents, so the reload is a
        # clean mirror rather than an append. (SQLite doesn't enforce FKs by
        # default, so order here is belt-and-suspenders.)
        for table in reversed(ordered):
            if table.name in dst_tables:
                dconn.execute(dst_tables[table.name].delete())

        for table in ordered:
            local = dst_tables.get(table.name)
            if local is None:
                print(f"  skip  {table.name} (not in local app.db -- run 'bb db upgrade')")
                continue

            src_cols = {c.name for c in table.columns}
            shared = [c.name for c in local.columns if c.name in src_cols]
            # Local NOT NULL columns the live DB lacks, with no default of their
            # own: we must synthesize a value or the insert fails (e.g. username).
            to_fill = [
                c for c in local.columns
                if c.name not in src_cols
                and not c.nullable
                and c.default is None
                and c.server_default is None
            ]
            rows = sconn.execute(select(table)).mappings().all()
            if not rows:
                print(f"  ok    {table.name}: 0 rows")
                continue

            used = {c.name: set() for c in to_fill}
            payload = []
            for row in rows:
                record = {}
                for col in shared:
                    value = row[col]
                    # JSON/array columns come back as dict/list; SQLite stores text.
                    if isinstance(value, (dict, list)):
                        value = json.dumps(value)
                    record[col] = value
                for column in to_fill:
                    record[column.name] = _placeholder(column, record, used[column.name])
                payload.append(record)

            dconn.execute(insert(local), payload)
            total += len(payload)
            note = f" (filled {[c.name for c in to_fill]})" if to_fill else ""
            print(f"  ok    {table.name}: {len(payload)} rows{note}")

    print(f"copied {total} rows in total.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
