"""Runtime configuration, loaded from environment variables or backend/.env."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Values the auth API needs; see .env.example for the expected keys."""

    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    # Only used by scripts/init_db.py to apply the schema; the API itself talks
    # to Supabase over HTTPS with the service-role key.
    database_url: str | None = None
    # Placeholder only; HS256 needs >= 32 bytes, so set a real secret in .env.
    jwt_secret: str = "dev-only-insecure-secret-please-override"
    jwt_expires_minutes: int = 60 * 24
    # Comma-separated browser origins allowed to call the API.
    cors_origins: str = "http://localhost:8443,http://127.0.0.1:8443"
    # SQLite file used when no Supabase credentials are set, so the API still
    # runs. Leave empty to require Supabase and return 503 without it.
    local_database: str = ".local-dev.db"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
