"""Drop unused policies table (saved-policy feature removed)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "003_drop_policies"
down_revision = "002_job_params"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "policies" not in inspector.get_table_names():
        return
    for name in (
        "ix_policies_created_at",
        "ix_policies_delete_after",
        "ix_policies_job_id",
        "ix_policies_session_id",
        "ix_policies_user_id",
    ):
        try:
            op.drop_index(op.f(name), table_name="policies")
        except Exception:
            pass
    op.drop_table("policies")


def downgrade() -> None:
    op.create_table(
        "policies",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("job_id", sa.String(), nullable=False),
        sa.Column("tree_id", sa.Integer(), nullable=False),
        sa.Column("constraints_json", sa.Text(), nullable=False),
        sa.Column("policy_json", sa.Text(), nullable=False),
        sa.Column("search_document", sa.Text(), nullable=False),
        sa.Column("session_id", sa.String(), nullable=True),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("delete_after", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_policies_created_at"), "policies", ["created_at"], unique=False)
    op.create_index(op.f("ix_policies_delete_after"), "policies", ["delete_after"], unique=False)
    op.create_index(op.f("ix_policies_job_id"), "policies", ["job_id"], unique=False)
    op.create_index(op.f("ix_policies_session_id"), "policies", ["session_id"], unique=False)
    op.create_index(op.f("ix_policies_user_id"), "policies", ["user_id"], unique=False)
