"""Apply backend/supabase/schema.sql to the Supabase Postgres database.

Run from the backend directory:

    python -m scripts.init_db

The connection string comes from DATABASE_URL in the environment or backend/.env
(the Supabase dashboard's "Connect > Session pooler" URI, with your database
password). Re-running is safe: every statement in schema.sql is idempotent.
"""

import sys
from pathlib import Path

import psycopg

from app.config import get_settings

SCHEMA_FILE = Path(__file__).resolve().parent.parent / "supabase" / "schema.sql"


def split_statements(sql: str) -> list[str]:
    """Split a DDL script into statements, dropping comment-only chunks."""
    statements = []
    for chunk in sql.split(";"):
        lines = [line for line in chunk.splitlines() if not line.strip().startswith("--")]
        statement = "\n".join(lines).strip()
        if statement:
            statements.append(statement)
    return statements


def main() -> int:
    settings = get_settings()

    if not settings.database_url:
        print("DATABASE_URL is not set. Add the Supabase connection string to backend/.env.", file=sys.stderr)
        return 1

    statements = split_statements(SCHEMA_FILE.read_text(encoding="utf-8"))

    try:
        # Fail fast on a wrong host or password instead of hanging on retries.
        with psycopg.connect(settings.database_url, connect_timeout=10) as connection:
            for statement in statements:
                connection.execute(statement)
            connection.commit()
    except psycopg.Error as error:
        print(f"Could not apply {SCHEMA_FILE.name}: {error}", file=sys.stderr)
        return 1

    print(f"Applied {len(statements)} statements from {SCHEMA_FILE.name}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
