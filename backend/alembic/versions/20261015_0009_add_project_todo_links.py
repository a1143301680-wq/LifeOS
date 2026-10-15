"""add ordered many-to-many Project Todo references

Revision ID: 20261015_0009
Revises: 20261014_0008
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261015_0009"
down_revision: str | None = "20261014_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_todo_links",
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("todo_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("sort_order >= 0", name="ck_project_todo_links_sort_order"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["todo_id"], ["todos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("project_id", "todo_id"),
    )
    op.create_index("ix_project_todo_links_user_project_order", "project_todo_links", ["user_id", "project_id", "sort_order", "todo_id"])


def downgrade() -> None:
    op.drop_index("ix_project_todo_links_user_project_order", table_name="project_todo_links")
    op.drop_table("project_todo_links")
