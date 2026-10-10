"""add project-linked AI sessions

Revision ID: 20261010_0006
Revises: 20261009_0005
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261010_0006"
down_revision: str | None = "20261009_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("goal", sa.String(length=500), nullable=False),
        sa.Column("completed_work", sa.String(length=4000)),
        sa.Column("modified_files", sa.String(length=4000)),
        sa.Column("verification_result", sa.String(length=4000)),
        sa.Column("remaining_issues", sa.String(length=4000)),
        sa.Column("next_step", sa.String(length=4000)),
        sa.Column("recommended_next_prompt", sa.String(length=4000)),
        sa.Column("ai_tool", sa.String(length=100)),
        sa.Column("user_note", sa.String(length=4000)),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(goal) BETWEEN 1 AND 500", name="ck_ai_sessions_goal_length"),
        sa.CheckConstraint("ended_at IS NULL OR ended_at >= started_at", name="ck_ai_sessions_time_order"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_sessions_user_project_started_id", "ai_sessions", ["user_id", "project_id", "started_at", "id"]
    )


def downgrade() -> None:
    op.drop_index("ix_ai_sessions_user_project_started_id", table_name="ai_sessions")
    op.drop_table("ai_sessions")
