"""QuantumChat auth API: sign up, log in, and the shared messaging room.

Accounts are stored in a Supabase Postgres table (`public.users`) with bcrypt
password hashes. Messages are stored in `public.messages`. Both tables are open
to the service-role key only; the anon client can authenticate with the JWT
returned at login.
"""

import logging
from datetime import datetime, timezone
from typing import Annotated, Any

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from postgrest.exceptions import APIError
from supabase import Client

from . import db
from .config import get_settings
from .schemas import AuthResponse, LoginRequest, SignUpRequest, UserOut
from .schemas_messages import ChatOut, MessageCreate, MessageOut
from .security import decode_access_token, create_access_token, hash_password, verify_password

USERS_TABLE = "users"
MESSAGES_TABLE = "messages"
USER_COLUMNS = "id, email, display_name, created_at, password_hash"
USER_SUMMARY_COLUMNS = "id, email, display_name"
MESSAGE_COLUMNS = "id, sender_id, recipient_id, content, sent_at"
GENERAL_CHAT = "general"
MAX_MESSAGES = 200
DUPLICATE_ACCOUNT_MESSAGE = "An account with that email already exists."

logger = logging.getLogger("quantumchat.auth")

app = FastAPI(title="QuantumChat auth API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_security = HTTPBearer(auto_error=False)


@app.exception_handler(httpx.HTTPError)
def handle_supabase_transport_error(request: Request, exc: httpx.HTTPError) -> JSONResponse:
    """Answer 503 when Supabase is unreachable.

    An unhandled exception escapes CORSMiddleware, so the browser sees a 500
    with no CORS headers and reports a network failure instead of the real
    cause. Returning a normal JSON response here keeps the headers intact.
    """
    logger.warning("Supabase request failed: %s", exc, exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "detail": (
                "Could not reach Supabase. Check SUPABASE_URL and "
                "SUPABASE_SERVICE_ROLE_KEY in backend/.env."
            )
        },
    )


def get_client() -> Client:
    try:
        return db.get_supabase()
    except db.DatabaseNotConfigured as error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(error)) from error


def get_client_from_context() -> Client:
    """Return the Supabase client for the current request."""
    return get_client()


ClientDep = Annotated[Client, Depends(get_client)]


def normalize_email(email: str) -> str:
    return email.strip().lower()


def find_user_by_email(client: Client, email: str) -> dict[str, Any] | None:
    response = client.table(USERS_TABLE).select(USER_COLUMNS).eq("email", email).limit(1).execute()
    return response.data[0] if response.data else None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_security),
    client: ClientDep = None,
) -> dict[str, Any]:
    """Return the authenticated user record, or 401 for a missing/invalid token."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required.")

    try:
        payload = decode_access_token(credentials.credentials)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired access token.") from None

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired access token.")

    client = get_client_from_context()
    response = client.table(USERS_TABLE).select("id, email, display_name").eq("id", user_id).limit(1).execute()
    if not response.data:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists.")

    return response.data[0]


def to_user_out(row: dict[str, Any]) -> UserOut:
    return UserOut(
        id=str(row["id"]),
        email=row["email"],
        display_name=row.get("display_name"),
        created_at=row.get("created_at"),
    )


def to_message_out(row: dict[str, Any], sender_name: str | None) -> MessageOut:
    return MessageOut(
            id=str(row["id"]),
            sender_id=str(row["sender_id"]),
            sender_name=sender_name,
            content=row["content"],
            sent_at=row["sent_at"],
        )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def sign_up(payload: SignUpRequest, client: ClientDep) -> AuthResponse:
    email = normalize_email(str(payload.email))

    if find_user_by_email(client, email) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, DUPLICATE_ACCOUNT_MESSAGE)

    row = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "display_name": payload.display_name or email.split("@")[0],
    }

    try:
        created = client.table(USERS_TABLE).insert(row).execute().data
    except APIError as error:
        # The unique index on email is the real guard against concurrent signups.
        if "duplicate key" in str(error) or "23505" in str(error):
            raise HTTPException(status.HTTP_409_CONFLICT, DUPLICATE_ACCOUNT_MESSAGE) from error
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not save the account.") from error

    if not created:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not save the account.")

    user = to_user_out(created[0])
    return AuthResponse(access_token=create_access_token(user.id), user=user)


@app.post("/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, client: ClientDep) -> AuthResponse:
    email = normalize_email(str(payload.email))
    record = find_user_by_email(client, email)

    # Same response for an unknown email and a wrong password.
    if record is None or not verify_password(payload.password, record["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")

    try:
        client.table(USERS_TABLE).update({"last_login_at": datetime.now(timezone.utc).isoformat()}).eq("id", record["id"]).execute()
    except APIError:
        # The login itself succeeded; a failed timestamp write should not reject it.
        logger.warning("Could not record last_login_at for user %s", record["id"], exc_info=True)

    return AuthResponse(access_token=create_access_token(str(record["id"])), user=to_user_out(record))


def list_known_users(client: Client) -> list[dict[str, Any]]:
    return client.table(USERS_TABLE).select(USER_SUMMARY_COLUMNS).execute().data or []


def display_name_for(user: dict[str, Any]) -> str:
    return user.get("display_name") or user["email"]


def recent_messages(client: Client) -> list[dict[str, Any]]:
    """Oldest-first slice of every chat's messages.

    Filtering per conversation happens in Python: it keeps the same code path
    for Supabase and the local SQLite fallback, and the prototype's volume is
    small enough that this is cheaper than two query dialects.
    """
    rows = (
        client.table(MESSAGES_TABLE)
        .select(MESSAGE_COLUMNS)
        .order("sent_at", desc=False)
        .execute()
        .data
        or []
    )
    return rows[-MAX_MESSAGES:]


def in_chat(row: dict[str, Any], user_id: str, chat_id: str) -> bool:
    if chat_id == GENERAL_CHAT:
        return not row.get("recipient_id")
    return (row["sender_id"] == user_id and row.get("recipient_id") == chat_id) or (
        row["sender_id"] == chat_id and row.get("recipient_id") == user_id
    )


def ensure_chat_exists(users: dict[str, dict[str, Any]], chat_id: str) -> None:
    if chat_id != GENERAL_CHAT and chat_id not in users:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such chat.")


def chat_preview(rows: list[dict[str, Any]], user_id: str, chat_id: str) -> dict[str, Any]:
    matching = [row for row in rows if in_chat(row, user_id, chat_id)]
    if not matching:
        return {"last_message": None, "last_message_at": None}

    last = matching[-1]
    return {"last_message": last["content"], "last_message_at": last["sent_at"]}


@app.get("/chats", response_model=list[ChatOut])
def list_chats(current_user: dict[str, Any] = Depends(get_current_user)) -> list[ChatOut]:
    """Chats the picker offers: the shared room plus one per other account."""
    client = get_client_from_context()
    users = list_known_users(client)
    rows = recent_messages(client)
    user_id = current_user["id"]

    chats = [
        ChatOut(
            id=GENERAL_CHAT,
            name="General",
            is_group=True,
            **chat_preview(rows, user_id, GENERAL_CHAT),
        )
    ]

    direct = [
        ChatOut(id=user["id"], name=display_name_for(user), **chat_preview(rows, user_id, user["id"]))
        for user in users
        if user["id"] != user_id
    ]

    # Most recent conversation first, then everyone with no history yet.
    oldest = datetime.min.replace(tzinfo=timezone.utc)
    direct.sort(
        key=lambda chat: (chat.last_message_at is not None, chat.last_message_at or oldest),
        reverse=True,
    )

    return [*chats, *direct]


@app.get("/messages", response_model=list[MessageOut])
def list_messages(
    chat: str = GENERAL_CHAT,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[MessageOut]:
    client = get_client_from_context()
    users = {user["id"]: user for user in list_known_users(client)}
    ensure_chat_exists(users, chat)

    rows = [row for row in recent_messages(client) if in_chat(row, current_user["id"], chat)]

    messages = []
    for row in rows:
        sender = users.get(row["sender_id"])
        messages.append(to_message_out(row, display_name_for(sender) if sender else None))

    return messages


@app.post("/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def post_message(
    payload: MessageCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> MessageOut:
    client = get_client_from_context()
    users = {user["id"]: user for user in list_known_users(client)}
    ensure_chat_exists(users, payload.chat_id)

    if len(payload.content.encode("utf-8")) > 4000:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Message must be at most 4000 bytes long.")

    row = {
        "sender_id": current_user["id"],
        "content": payload.content.strip(),
        "recipient_id": None if payload.chat_id == GENERAL_CHAT else payload.chat_id,
    }

    try:
        created = client.table(MESSAGES_TABLE).insert(row).execute().data
    except APIError as error:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not save the message.") from error

    if not created:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not save the message.")

    return to_message_out(
        created[0], current_user.get("display_name") or current_user.get("email") or None
    )
