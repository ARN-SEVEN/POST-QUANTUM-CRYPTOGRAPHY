"""Supabase client access."""

from functools import lru_cache

from supabase import Client, create_client

from .config import get_settings


class DatabaseNotConfigured(RuntimeError):
    """Raised when Supabase credentials are missing from the environment."""


@lru_cache
def get_supabase() -> Client:
    """Return a cached client using the service-role key.

    The service-role key bypasses row level security, so it must only ever be
    read server-side. It is never sent to the browser.
    """
    settings = get_settings()

    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise DatabaseNotConfigured(
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env before signing in."
        )

    return create_client(settings.supabase_url, settings.supabase_service_role_key)
