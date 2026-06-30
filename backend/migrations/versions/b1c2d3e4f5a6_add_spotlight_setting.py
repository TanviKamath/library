"""add spotlight setting

Revision ID: b1c2d3e4f5a6
Revises: d50bb92718aa
Create Date: 2026-06-30 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'b1c2d3e4f5a6'
down_revision = 'd50bb92718aa'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'spotlight_setting',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('book_id', sa.Integer(), nullable=False),
        sa.Column('set_at', sa.DateTime(), nullable=False),
        sa.Column('is_admin_override', sa.Boolean(), nullable=False),
        sa.Column('set_by_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['book_id'], ['book.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['set_by_id'], ['app_user.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('spotlight_setting')
