"""Database client access.

Supabase is used when credentials are configured; otherwise the API falls back
to a local SQLite file so it can be run without any external service. Both
clients expose the same `table(...)` query builder, so the handlers do not care
which one they get.
"""

from functools import lru_cache
from pathlib import Path

from supabase import Client, create_client

from .config import get_settings
from .local_db import LocalClient

BACKEND_ROOT = Path(__file__).resolve().parent.parent

DatabaseClient = Client | LocalClient


class DatabaseNotConfigured(RuntimeError):
    """Raised when Supabase credentials are missing and the local fallback is off."""


@lru_cache
def get_supabase() -> DatabaseClient:
    """Return a cached client using the service-role key, or the local fallback.

    The service-role key bypasses row level security, so it must only ever be
    read server-side. It is never sent to the browser.
    """
    settings = get_settings()

    if settings.supabase_url and settings.supabase_service_role_key:
        return create_client(settings.supabase_url, settings.supabase_service_role_key)

    if settings.local_database:
        path = Path(settings.local_database)
        if not path.is_absolute():
            path = BACKEND_ROOT / path
        return LocalClient(path)

    raise DatabaseNotConfigured(
        "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env before signing in."
    )
