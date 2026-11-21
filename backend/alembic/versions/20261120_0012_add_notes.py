"""Add owner-scoped Notes."""

import sqlalchemy as sa
from alembic import op

revision = "20261120_0012"
down_revision = "20261109_0011"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "notes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id", ondelete="SET NULL")),
        sa.Column("todo_id", sa.Uuid(), sa.ForeignKey("todos.id", ondelete="SET NULL")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.String(10000)),
        sa.Column("external_url", sa.String(2048)),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("length(trim(title)) BETWEEN 1 AND 200", name="ck_notes_title"),
        sa.CheckConstraint("length(content) <= 10000", name="ck_notes_content"),
        sa.CheckConstraint("length(external_url) <= 2048", name="ck_notes_external_url"),
        sa.CheckConstraint("version > 0", name="ck_notes_version"),
    )
    for scope, columns in (("", []), ("project_", ["project_id"]), ("todo_", ["todo_id"])):
        op.create_index(f"ix_notes_owner_{scope}updated", "notes",
                        ["user_id", *columns, "deleted_at", sa.text("updated_at DESC"), "id"])


def downgrade():
    op.drop_table("notes")
