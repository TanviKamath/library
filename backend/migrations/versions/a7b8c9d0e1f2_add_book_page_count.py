"""add book page_count

Revision ID: a7b8c9d0e1f2
Revises: f1a2b3c4d5e6
Create Date: 2026-07-07 15:00:00.000000

Adds ``page_count`` to ``book`` so the recommender can match a reader's
declared skill level / pace preference against book length:

    * advanced readers / slow-burn pace  -> nudge toward longer books
    * beginner readers / fast-read pace   -> nudge toward shorter books

Nullable — a book with an unknown page count simply contributes no
length signal (the term is skipped), exactly like publish_year.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a7b8c9d0e1f2'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('book', schema=None) as batch_op:
        batch_op.add_column(sa.Column('page_count', sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table('book', schema=None) as batch_op:
        batch_op.drop_column('page_count')
