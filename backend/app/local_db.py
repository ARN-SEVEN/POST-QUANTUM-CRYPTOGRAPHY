"""SQLite stand-in for Supabase, used when no Supabase credentials are set.

The API talks to Postgres through the supabase-py query builder. Rather than
rewrite every handler, this module implements just the slice of that builder
that `app/main.py` uses (select/eq/limit/order/insert/update plus the embedded
`users(...)` lookup), so the app runs with zero external services locally.

Data lives in a single SQLite file; deleting it resets every account and
message. When SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are configured,
`app/db.py` returns the real Supabase client instead and this stays unused.
"""

from __future__ import annotations

import re
import sqlite3
import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA = """
create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  display_name text,
  created_at text not null,
  last_login_at text
);

create table if not exists messages (
  id text primary key,
  sender_id text not null references users(id) on delete cascade,
  content text not null,
  sent_at text not null,
  -- null means the shared "general" room; otherwise the recipient's user id
  recipient_id text references users(id) on delete cascade
);

create index if not exists messages_sent_at_idx on messages (sent_at);
"""

# Column names are interpolated into SQL, so every one is checked against this
# whitelist instead of being trusted from the caller.
TABLES: dict[str, tuple[str, ...]] = {
    "users": ("id", "email", "password_hash", "display_name", "created_at", "last_login_at"),
    "messages": ("id", "sender_id", "content", "sent_at", "recipient_id"),
}

# Columns the database fills in itself; mirrors the SQL defaults in schema.sql.
TIMESTAMP_COLUMNS = {"users": "created_at", "messages": "sent_at"}

EMBEDDED = re.compile(r"(\w+)\(([^)]*)\)")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class LocalResponse:
    """Mirrors the `.data` attribute of a postgrest response."""

    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


def _split_columns(spec: str, table: str) -> tuple[list[str], list[str]]:
    """Split `a, b, users(display_name, email)` into plain and embedded parts."""
    allowed = TABLES[table]
    embedded = EMBEDDED.findall(spec)
    plain = [column.strip() for column in EMBEDDED.sub("", spec).split(",") if column.strip()]

    if plain == ["*"] or not plain:
        plain = list(allowed)

    for column in plain:
        if column not in allowed:
            raise ValueError(f"Unknown column {column!r} on {table!r}")

    return plain, [name for name, _ in embedded]


class LocalQuery:
    """Chainable query builder with the same surface as supabase-py."""

    def __init__(self, connection: sqlite3.Connection, table: str) -> None:
        self._connection = connection
        self._table = table
        self._operation = "select"
        self._payload: dict[str, Any] = {}
        self._columns = "*"
        self._filters: list[tuple[str, Any]] = []
        self._limit: int | None = None
        self._order: tuple[str, bool] | None = None

    def _column(self, column: str) -> str:
        if column not in TABLES[self._table]:
            raise ValueError(f"Unknown column {column!r} on {self._table!r}")
        return column

    def select(self, columns: str = "*") -> "LocalQuery":
        self._operation = "select"
        self._columns = columns
        return self

    def insert(self, row: dict[str, Any]) -> "LocalQuery":
        self._operation = "insert"
        self._payload = dict(row)
        return self

    def update(self, values: dict[str, Any]) -> "LocalQuery":
        self._operation = "update"
        self._payload = dict(values)
        return self

    def eq(self, column: str, value: Any) -> "LocalQuery":
        self._filters.append((self._column(column), value))
        return self

    def limit(self, count: int) -> "LocalQuery":
        self._limit = int(count)
        return self

    def order(self, column: str, desc: bool = False) -> "LocalQuery":
        self._order = (self._column(column), bool(desc))
        return self

    def execute(self) -> LocalResponse:
        if self._table not in TABLES:
            raise ValueError(f"Unknown table {self._table!r}")

        with closing(self._connection) as connection:
            if self._operation == "insert":
                data = self._insert(connection)
            elif self._operation == "update":
                data = self._update(connection)
            else:
                data = self._select(connection)
            connection.commit()

        return LocalResponse(data)

    def _where(self) -> tuple[str, list[Any]]:
        if not self._filters:
            return "", []
        clause = " and ".join(f"{column} = ?" for column, _ in self._filters)
        return f" where {clause}", [value for _, value in self._filters]

    def _select(self, connection: sqlite3.Connection) -> list[dict[str, Any]]:
        plain, embedded = _split_columns(self._columns, self._table)
        clause, params = self._where()
        sql = f"select {', '.join(plain)} from {self._table}{clause}"

        if self._order is not None:
            column, desc = self._order
            sql += f" order by {column} {'desc' if desc else 'asc'}"
        if self._limit is not None:
            sql += f" limit {self._limit}"

        rows = [dict(row) for row in connection.execute(sql, params)]

        if "users" in embedded and self._table == "messages":
            self._attach_senders(connection, rows)

        return rows

    def _attach_senders(self, connection: sqlite3.Connection, rows: list[dict[str, Any]]) -> None:
        """Resolve the embedded `users(display_name, email)` lookup."""
        sender_ids = {row["sender_id"] for row in rows}
        senders: dict[str, dict[str, Any]] = {}

        if sender_ids:
            placeholders = ", ".join("?" for _ in sender_ids)
            sql = f"select id, display_name, email from users where id in ({placeholders})"
            for row in connection.execute(sql, list(sender_ids)):
                senders[row["id"]] = {"display_name": row["display_name"], "email": row["email"]}

        for row in rows:
            row["users"] = senders.get(row["sender_id"])

    def _insert(self, connection: sqlite3.Connection) -> list[dict[str, Any]]:
        allowed = TABLES[self._table]
        values = {column: value for column, value in self._payload.items() if column in allowed}

        unknown = set(self._payload) - set(allowed)
        if unknown:
            raise ValueError(f"Unknown columns for {self._table!r}: {sorted(unknown)}")

        values.setdefault("id", str(uuid.uuid4()))
        timestamp_column = TIMESTAMP_COLUMNS[self._table]
        values.setdefault(timestamp_column, _now())

        columns = ", ".join(values)
        placeholders = ", ".join("?" for _ in values)
        connection.execute(
            f"insert into {self._table} ({columns}) values ({placeholders})",
            list(values.values()),
        )

        return self._fetch_by_id(connection, values["id"])

    def _update(self, connection: sqlite3.Connection) -> list[dict[str, Any]]:
        allowed = TABLES[self._table]
        values = {column: value for column, value in self._payload.items() if column in allowed}

        if not values:
            return []

        clause, params = self._where()
        assignments = ", ".join(f"{column} = ?" for column in values)
        connection.execute(
            f"update {self._table} set {assignments}{clause}",
            [*values.values(), *params],
        )

        matches = self._select(connection) if self._columns != "*" else self._fetch_all(connection)
        return matches

    def _fetch_all(self, connection: sqlite3.Connection) -> list[dict[str, Any]]:
        clause, params = self._where()
        sql = f"select * from {self._table}{clause}"
        return [dict(row) for row in connection.execute(sql, params)]

    def _fetch_by_id(self, connection: sqlite3.Connection, row_id: str) -> list[dict[str, Any]]:
        sql = f"select * from {self._table} where id = ?"
        return [dict(row) for row in connection.execute(sql, [row_id])]


class LocalClient:
    """Creates the schema on first use and hands out per-query builders."""

    def __init__(self, path: str | Path) -> None:
        self.path = str(path)
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as connection:
            connection.executescript(SCHEMA)
            self._migrate(connection)
            connection.commit()

    def _migrate(self, connection: sqlite3.Connection) -> None:
        """Add columns introduced after a database file was already created."""
        columns = {row["name"] for row in connection.execute("pragma table_info(messages)")}
        if "recipient_id" not in columns:
            connection.execute("alter table messages add column recipient_id text")

    def _connect(self) -> sqlite3.Connection:
        # The API is sync and one request per connection is plenty here.
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("pragma foreign_keys = on")
        return connection

    def table(self, name: str) -> LocalQuery:
        return LocalQuery(self._connect(), name)
