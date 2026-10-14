"""add soft-deletable project milestones

Revision ID: 20261014_0008
Revises: 20261012_0007
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261014_0008"
down_revision: str | None = "20261012_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "milestones",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=16), server_default="pending", nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("length(title) BETWEEN 1 AND 200", name="ck_milestones_title_length"),
        sa.CheckConstraint("status IN ('pending', 'completed', 'canceled')", name="ck_milestones_status"),
        sa.CheckConstraint("sort_order >= 0", name="ck_milestones_sort_order"),
        sa.CheckConstraint("version > 0", name="ck_milestones_version"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_milestones_user_project_deleted_order", "milestones", ["user_id", "project_id", "deleted_at", "sort_order", "id"])


def downgrade() -> None:
    op.drop_index("ix_milestones_user_project_deleted_order", table_name="milestones")
    op.drop_table("milestones")
