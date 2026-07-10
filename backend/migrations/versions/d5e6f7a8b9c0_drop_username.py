"""drop username column from app_user

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-07-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd5e6f7a8b9c0'
down_revision = 'c4d5e6f7a8b9'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('app_user', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_app_user_username'))
        batch_op.drop_column('username')


def downgrade():
    with op.batch_alter_table('app_user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('username', sa.String(length=50), nullable=True))
        batch_op.create_index(batch_op.f('ix_app_user_username'), ['username'], unique=True)
