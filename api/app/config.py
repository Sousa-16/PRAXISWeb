from __future__ import annotations

import os
from pathlib import Path


def _bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    database_url: str = os.environ.get("DATABASE_URL", "sqlite:///./praxis_web.db")
    frontend_origin: str = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
    sentry_dsn: str = os.environ.get("SENTRY_DSN", "").strip()
    cookie_secure: bool = _bool("COOKIE_SECURE", False)
    guest_ttl_hours: int = int(os.environ.get("GUEST_TTL_HOURS", "24"))
    max_upload_bytes: int = int(os.environ.get("MAX_UPLOAD_BYTES", str(20 * 1024 * 1024)))
    max_rows: int = int(os.environ.get("MAX_ROWS", "100000"))
    max_active_jobs: int = int(os.environ.get("MAX_ACTIVE_JOBS", "1"))
    bases_cache_dir: str = os.environ.get("BASES_CACHE_DIR", "data/bases_cache")
    object_storage_backend: str = os.environ.get("OBJECT_STORAGE_BACKEND", "local").strip().lower()
    s3_endpoint: str = os.environ.get("S3_ENDPOINT", "").strip()
    s3_bucket: str = os.environ.get("S3_BUCKET", "").strip()
    s3_access_key: str = os.environ.get("S3_ACCESS_KEY", "").strip()
    s3_secret_key: str = os.environ.get("S3_SECRET_KEY", "").strip()
    s3_region: str = os.environ.get("S3_REGION", "us-east-1").strip()
    s3_prefix: str = os.environ.get("S3_PREFIX", "bases_cache").strip().strip("/")
    redis_url: str = os.environ.get("REDIS_URL", "").strip()

    def frontend_origins(self) -> list[str]:
        extras = ["http://127.0.0.1:3000", "http://localhost:3000"]
        parts = [p.strip() for p in self.frontend_origin.split(",") if p.strip()]
        return list(dict.fromkeys(parts + extras))

    def sqlalchemy_url(self) -> str:
        url = self.database_url
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        return url

    def is_postgres(self) -> bool:
        u = self.sqlalchemy_url()
        return u.startswith("postgresql")

    def uses_s3_storage(self) -> bool:
        return self.object_storage_backend == "s3" and bool(
            self.s3_endpoint and self.s3_bucket and self.s3_access_key and self.s3_secret_key
        )

    def uses_job_queue(self) -> bool:
        return bool(self.redis_url)

    def bases_cache_path(self) -> Path:
        root = Path(__file__).resolve().parent.parent
        p = Path(self.bases_cache_dir)
        return p if p.is_absolute() else root / p


settings = Settings()
API_ROOT = Path(__file__).resolve().parent.parent


def sample_csv() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "sample.csv"
