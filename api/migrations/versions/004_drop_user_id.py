"""Drop leftover user_id columns after guest-only sessions."""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_drop_user_id"
down_revision: Union[str, None] = "003_drop_policies"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _drop_user_id(table: str) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if table not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns(table)}
    if "user_id" not in cols:
        return
    indexes = {ix["name"] for ix in inspector.get_indexes(table)}
    ix_name = f"ix_{table}_user_id"
    with op.batch_alter_table(table) as batch:
        if ix_name in indexes:
            batch.drop_index(ix_name)
        batch.drop_column("user_id")


def upgrade() -> None:
    _drop_user_id("datasets")
    _drop_user_id("jobs")


def downgrade() -> None:
    for table in ("datasets", "jobs"):
        with op.batch_alter_table(table) as batch:
            batch.add_column(sa.Column("user_id", sa.String(), nullable=True))
            batch.create_index(f"ix_{table}_user_id", ["user_id"], unique=False)
