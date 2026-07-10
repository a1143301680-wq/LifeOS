"""phase1a backend foundation

Revision ID: 20260710_0001
Revises:
Create Date: 2026-07-10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260710_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(sa.text("CREATE SEQUENCE sync_changes_cursor_seq AS BIGINT START WITH 1 INCREMENT BY 1"))

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("alias", sa.String(length=32), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("bootstrap_token_hash", sa.String(length=512), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("alias"),
    )
    op.create_index(op.f("ix_users_alias"), "users", ["alias"], unique=False)

    op.create_table(
        "idempotency_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("method", sa.String(length=16), nullable=False),
        sa.Column("path", sa.String(length=512), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("response_status", sa.Integer(), nullable=False),
        sa.Column("response_body", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "key", name="uq_idempotency_user_key"),
    )
    op.create_index(op.f("ix_idempotency_keys_user_id"), "idempotency_keys", ["user_id"], unique=False)
    op.create_index("ix_idempotency_keys_expires_at", "idempotency_keys", ["expires_at"], unique=False)

    op.create_table(
        "sync_changes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "cursor",
            sa.BigInteger(),
            server_default=sa.text("nextval('sync_changes_cursor_seq')"),
            nullable=False,
        ),
        sa.Column("change_type", sa.String(length=80), nullable=False),
        sa.Column("entity_type", sa.String(length=80), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("entity_version", sa.Integer(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sync_changes_cursor"), "sync_changes", ["cursor"], unique=True)
    op.create_index(op.f("ix_sync_changes_user_id"), "sync_changes", ["user_id"], unique=False)
    op.create_index(
        "ix_sync_changes_user_entity",
        "sync_changes",
        ["user_id", "entity_type", "entity_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_sync_changes_user_entity", table_name="sync_changes")
    op.drop_index(op.f("ix_sync_changes_user_id"), table_name="sync_changes")
    op.drop_index(op.f("ix_sync_changes_cursor"), table_name="sync_changes")
    op.drop_table("sync_changes")
    op.execute(sa.text("DROP SEQUENCE sync_changes_cursor_seq"))
    op.drop_index("ix_idempotency_keys_expires_at", table_name="idempotency_keys")
    op.drop_index(op.f("ix_idempotency_keys_user_id"), table_name="idempotency_keys")
    op.drop_table("idempotency_keys")
    op.drop_index(op.f("ix_users_alias"), table_name="users")
    op.drop_table("users")
