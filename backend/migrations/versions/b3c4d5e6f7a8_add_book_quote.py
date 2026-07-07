"""add book quote fields

Revision ID: b3c4d5e6f7a8
Revises: a7b8c9d0e1f2
Create Date: 2026-07-07 16:00:00.000000

Adds a short pull-quote to ``book`` so the Spotlight card can show a quote
from the currently spotlighted book:

    * quote_text     -> the quote itself (240-char cap)
    * quote_source   -> optional context, e.g. "Ch. 3"
    * quote_verified -> admin has confirmed accuracy / attribution

quote_text / quote_source are nullable — a book without a quote simply
hides the quote block on the card.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b3c4d5e6f7a8'
down_revision = 'a7b8c9d0e1f2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('book', schema=None) as batch_op:
        batch_op.add_column(sa.Column('quote_text', sa.String(length=240), nullable=True))
        batch_op.add_column(sa.Column('quote_source', sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column(
            'quote_verified', sa.Boolean(), nullable=False, server_default=sa.false()
        ))


def downgrade():
    with op.batch_alter_table('book', schema=None) as batch_op:
        batch_op.drop_column('quote_verified')
        batch_op.drop_column('quote_source')
        batch_op.drop_column('quote_text')
