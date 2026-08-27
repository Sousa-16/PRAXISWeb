"""Initial PRAXIS Web schema."""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "datasets",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("csv_bytes", sa.LargeBinary(), nullable=False),
        sa.Column("preview_json", sa.Text(), nullable=False),
        sa.Column("session_id", sa.String(), nullable=True),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("delete_after", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_datasets_created_at"), "datasets", ["created_at"], unique=False)
    op.create_index(op.f("ix_datasets_delete_after"), "datasets", ["delete_after"], unique=False)
    op.create_index(op.f("ix_datasets_session_id"), "datasets", ["session_id"], unique=False)
    op.create_index(op.f("ix_datasets_user_id"), "datasets", ["user_id"], unique=False)

    op.create_table(
        "jobs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("dataset_id", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("result_json", sa.Text(), nullable=True),
        sa.Column("search_document", sa.Text(), nullable=False),
        sa.Column("session_id", sa.String(), nullable=True),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("delete_after", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_jobs_created_at"), "jobs", ["created_at"], unique=False)
    op.create_index(op.f("ix_jobs_dataset_id"), "jobs", ["dataset_id"], unique=False)
    op.create_index(op.f("ix_jobs_delete_after"), "jobs", ["delete_after"], unique=False)
    op.create_index(op.f("ix_jobs_session_id"), "jobs", ["session_id"], unique=False)
    op.create_index(op.f("ix_jobs_status"), "jobs", ["status"], unique=False)
    op.create_index(op.f("ix_jobs_user_id"), "jobs", ["user_id"], unique=False)

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


def downgrade() -> None:
    op.drop_index(op.f("ix_policies_user_id"), table_name="policies")
    op.drop_index(op.f("ix_policies_session_id"), table_name="policies")
    op.drop_index(op.f("ix_policies_job_id"), table_name="policies")
    op.drop_index(op.f("ix_policies_delete_after"), table_name="policies")
    op.drop_index(op.f("ix_policies_created_at"), table_name="policies")
    op.drop_table("policies")
    op.drop_index(op.f("ix_jobs_user_id"), table_name="jobs")
    op.drop_index(op.f("ix_jobs_status"), table_name="jobs")
    op.drop_index(op.f("ix_jobs_session_id"), table_name="jobs")
    op.drop_index(op.f("ix_jobs_delete_after"), table_name="jobs")
    op.drop_index(op.f("ix_jobs_dataset_id"), table_name="jobs")
    op.drop_index(op.f("ix_jobs_created_at"), table_name="jobs")
    op.drop_table("jobs")
    op.drop_index(op.f("ix_datasets_user_id"), table_name="datasets")
    op.drop_index(op.f("ix_datasets_session_id"), table_name="datasets")
    op.drop_index(op.f("ix_datasets_delete_after"), table_name="datasets")
    op.drop_index(op.f("ix_datasets_created_at"), table_name="datasets")
    op.drop_table("datasets")
