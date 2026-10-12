"""add editable project stages

Revision ID: 20261012_0007
Revises: 20261010_0006
"""

from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261012_0007"
down_revision: str | None = "20261010_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TEMPLATES = {
    "development": ("Requirements", "UI design", "Development", "Testing", "Release"),
    "learning": ("Planning", "Study", "Practice", "Review"),
    "life": ("Planning", "Preparation", "Action", "Review"),
    "health": ("Baseline", "Plan", "Action", "Review"),
    "pet": ("Assessment", "Care plan", "Care", "Review"),
    "other": ("Planning", "Action", "Review"),
}


def upgrade() -> None:
    op.create_table(
        "project_stages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_current", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(name) BETWEEN 1 AND 100", name="ck_project_stages_name_length"),
        sa.CheckConstraint("sort_order >= 0", name="ck_project_stages_sort_order"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_stages_project_order", "project_stages", ["project_id", "sort_order", "id"])
    op.create_index(
        "uq_project_stages_current_project", "project_stages", ["project_id"], unique=True,
        postgresql_where=sa.text("is_current"),
    )

    connection = op.get_bind()
    projects = connection.execute(sa.text("SELECT id, user_id, type FROM projects")).mappings()
    stage_table = sa.table(
        "project_stages",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("user_id", postgresql.UUID(as_uuid=True)),
        sa.column("project_id", postgresql.UUID(as_uuid=True)),
        sa.column("name", sa.String()),
        sa.column("sort_order", sa.Integer()),
        sa.column("is_current", sa.Boolean()),
    )
    for project in projects:
        connection.execute(stage_table.insert(), [
            {
                "id": uuid4(), "user_id": project["user_id"], "project_id": project["id"],
                "name": name, "sort_order": position, "is_current": False,
            }
            for position, name in enumerate(TEMPLATES[project["type"]])
        ])


def downgrade() -> None:
    op.drop_index("uq_project_stages_current_project", table_name="project_stages")
    op.drop_index("ix_project_stages_project_order", table_name="project_stages")
    op.drop_table("project_stages")
