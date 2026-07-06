"""add_event_cache_table

Revision ID: c1b2a3d4e5f6
Revises: e2d74f7da995
Create Date: 2026-07-04 03:45:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c1b2a3d4e5f6"
down_revision = "e2d74f7da995"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "event_cache",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("cached_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("day", sa.Date, nullable=False, unique=True),
        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column("payload", sa.Text, nullable=False),
    )


def downgrade():
    op.drop_table("event_cache")
