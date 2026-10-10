"""add user-owned projects

Revision ID: 20261009_0005
Revises: 20260713_0004
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261009_0005"
down_revision: str | None = "20260713_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(length=2000), nullable=True),
        sa.Column("type", sa.String(length=32), server_default="other", nullable=False),
        sa.Column("status", sa.String(length=32), server_default="planning", nullable=False),
        sa.Column("manual_progress", sa.Integer(), server_default="0", nullable=False),
        sa.Column("next_step", sa.String(length=1000), nullable=True),
        sa.Column("is_pinned", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(name) BETWEEN 1 AND 200", name="ck_projects_name_length"),
        sa.CheckConstraint("type IN ('development', 'learning', 'life', 'health', 'pet', 'other')", name="ck_projects_type"),
        sa.CheckConstraint("status IN ('planning', 'in_progress', 'paused', 'completed', 'abandoned')", name="ck_projects_status"),
        sa.CheckConstraint("manual_progress BETWEEN 0 AND 100", name="ck_projects_progress"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_projects_user_pin_updated_id", "projects", ["user_id", "is_pinned", "updated_at", "id"])


def downgrade() -> None:
    op.drop_index("ix_projects_user_pin_updated_id", table_name="projects")
    op.drop_table("projects")
