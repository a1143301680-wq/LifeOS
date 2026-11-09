"""add manual project logs without source backfill

Revision ID: 20261015_0010
Revises: 20261015_0009
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261015_0010"
down_revision: str | None = "20261015_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.String(4000)),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("length(trim(title)) BETWEEN 1 AND 200", name="ck_project_logs_title_length"),
        sa.CheckConstraint("content IS NULL OR length(content) <= 4000", name="ck_project_logs_content_length"),
        sa.CheckConstraint("version > 0", name="ck_project_logs_version"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_logs_owner_project_deleted_created_id", "project_logs", ["user_id", "project_id", "deleted_at", "created_at", "id"])


def downgrade() -> None:
    op.drop_index("ix_project_logs_owner_project_deleted_created_id", table_name="project_logs")
    op.drop_table("project_logs")
