"""Add Project lifecycle timestamps.

Revision ID: 20261109_0011
Revises: 20261015_0010
"""

import sqlalchemy as sa
from alembic import op

revision = "20261109_0011"
down_revision = "20261015_0010"
branch_labels = None
depends_on = None

CONSTRAINT = "ck_projects_deleted_requires_archive"


def upgrade() -> None:
    op.add_column("projects", sa.Column("archived_at", sa.DateTime(timezone=True)))
    op.add_column("projects", sa.Column("deleted_at", sa.DateTime(timezone=True)))
    op.create_check_constraint(CONSTRAINT, "projects", "deleted_at IS NULL OR archived_at IS NOT NULL")


def downgrade() -> None:
    # Removing the lifecycle flags makes all surviving projects visible again.
    op.drop_constraint(CONSTRAINT, "projects", type_="check")
    op.drop_column("projects", "deleted_at")
    op.drop_column("projects", "archived_at")
