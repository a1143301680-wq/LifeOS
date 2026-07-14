"""add todos

Revision ID: 20260713_0004
Revises: 20260711_0003
Create Date: 2026-07-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260713_0004"
down_revision: str | None = "20260711_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "todos",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("recurring_template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("planned_date", sa.Date(), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("generated_for_date", sa.Date(), nullable=True),
        sa.Column("source_client_id", sa.String(length=120), nullable=True),
        sa.Column("client_created_id", sa.String(length=120), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('pending', 'completed', 'canceled')", name="ck_todos_status"),
        sa.CheckConstraint("priority IN ('high', 'medium', 'low')", name="ck_todos_priority"),
        sa.ForeignKeyConstraint(["category_id"], ["todo_categories.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_todos_user_id"), "todos", ["user_id"], unique=False)
    op.create_index("ix_todos_user_status_planned_date", "todos", ["user_id", "status", "planned_date"], unique=False)
    op.create_index("ix_todos_user_due_at", "todos", ["user_id", "due_at"], unique=False)
    op.create_index("ix_todos_user_category_id", "todos", ["user_id", "category_id"], unique=False)
    op.create_index("ix_todos_user_updated_at", "todos", ["user_id", "updated_at"], unique=False)
    op.create_index(
        "ix_todos_recurring_template_generated_date",
        "todos",
        ["recurring_template_id", "generated_for_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_todos_recurring_template_generated_date", table_name="todos")
    op.drop_index("ix_todos_user_updated_at", table_name="todos")
    op.drop_index("ix_todos_user_category_id", table_name="todos")
    op.drop_index("ix_todos_user_due_at", table_name="todos")
    op.drop_index("ix_todos_user_status_planned_date", table_name="todos")
    op.drop_index(op.f("ix_todos_user_id"), table_name="todos")
    op.drop_table("todos")
