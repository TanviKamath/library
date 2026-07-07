"""add book popularity_score and publish_year

Revision ID: f1a2b3c4d5e6
Revises: e7496d333b6a
Create Date: 2026-07-07 14:00:00.000000

Adds two scoring signals to ``book`` used by the preference engine:

* ``popularity_score`` – a mild "famous book" boost. Backfilled from the
  existing borrow count (``total_copies - available_copies``) so scoring
  works the moment the migration runs; kept updatable going forward.
* ``publish_year`` – enables the recency-affinity signal (nudge toward
  recent releases vs. classics based on a user's taste). Nullable; a NULL
  year simply contributes no recency signal.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'e7496d333b6a'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('book', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('popularity_score', sa.Float(), nullable=False,
                      server_default='0.0')
        )
        batch_op.add_column(
            sa.Column('publish_year', sa.Integer(), nullable=True)
        )

    # Backfill popularity_score from current borrow counts so the signal is
    # meaningful immediately. Guard against divide-by-zero on empty tables.
    bind = op.get_bind()
    row = bind.execute(sa.text(
        "SELECT MAX(total_copies - available_copies) AS m FROM book"
    )).fetchone()
    max_borrows = (row[0] or 0) if row else 0
    if max_borrows and max_borrows > 0:
        # Normalize borrow count into a 0..1 popularity_score.
        bind.execute(sa.text(
            "UPDATE book SET popularity_score = "
            "CAST(total_copies - available_copies AS FLOAT) / :maxb"
        ), {"maxb": float(max_borrows)})


def downgrade():
    with op.batch_alter_table('book', schema=None) as batch_op:
        batch_op.drop_column('publish_year')
        batch_op.drop_column('popularity_score')
