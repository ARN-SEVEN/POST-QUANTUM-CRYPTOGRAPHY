"""QuantumChat auth API: sign up, log in, and send messages against Supabase Postgres."""

import logging
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from postgrest.exceptions import APIError
from supabase import Client

from . import db
from .config import get_settings
from .schemas import AuthResponse, LoginRequest, MessageIn, MessageOut, MessagesList, SignUpRequest, UserOut
from .security import create_access_token, decode_access_token, hash_password, verify_password

USERS_TABLE = "users"
USER_COLUMNS = "id, email, display_name, created_at, password_hash"

MESSAGES_TABLE = "messages"
MESSAGES_COLUMNS = "id, sender_id, content, sent_at"
MESSAGES_SELECT = "id, sender_id, content, sent_at, sender:users(display_name)"

DUPLICATE_ACCOUNT_MESSAGE = "An account with that email already exists."
INVALID_TOKEN_MESSAGE = "Invalid access token."

logger = logging.getLogger("quantumchat.auth")

app = FastAPI(title="QuantumChat auth API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_client() -> Client:
    try:
        return db.get_supabase()
    except db.DatabaseNotConfigured as error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(error)) from error


ClientDep = Annotated[Client, Depends(get_client)]


def normalize_email(email: str) -> str:
    return email.strip().lower()


def find_user_by_email(client: Client, email: str) -> dict[str, Any] | None:
    response = client.table(USERS_TABLE).select(USER_COLUMNS).eq("email", email).limit(1).execute()
    return response.data[0] if response.data else None


def to_user_out(row: dict[str, Any]) -> UserOut:
    return UserOut(
        id=str(row["id"]),
        email=row["email"],
        display_name=row.get("display_name"),
        created_at=row.get("created_at"),
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
        client.table(USERS_TABLE).update(
            {"last_login_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", record["id"]).execute()
    except APIError:
        # The login itself succeeded; a failed timestamp write should not reject it.
        logger.warning("Could not record last_login_at for user %s", record["id"], exc_info=True)

    return AuthResponse(access_token=create_access_token(str(record["id"])), user=to_user_out(record))


def bearer_token(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Provide a Bearer access token.")
    return authorization[len("bearer "):].strip()


@app.get("/messages", response_model=MessagesList)
def get_messages(
    token: Annotated[str, Depends(bearer_token)],
    client: ClientDep,
) -> MessagesList:
    decode_access_token(token)  # raises 401 for an invalid/expired token
    rows = client.table(MESSAGES_TABLE).select(MESSAGES_SELECT).order("sent_at").execute().data
    logger.info("get_messages returned %d rows", len(rows))
    return MessagesList(messages=[MessageOut(**row) for row in rows])


@app.post("/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def create_message(
    payload: MessageIn,
    token: Annotated[str, Depends(bearer_token)],
    client: ClientDep,
) -> MessageOut:
    sender_id = decode_access_token(token)
    if not sender_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_TOKEN_MESSAGE)

    row = {"sender_id": sender_id, "content": payload.content}
    try:
        created = client.table(MESSAGES_TABLE).insert(row).execute().data
    except APIError as error:
        if "duplicate key" in str(error) or "23505" in str(error):
            raise HTTPException(status.HTTP_409_CONFLICT, DUPLICATE_ACCOUNT_MESSAGE) from error
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not send the message.") from error

    if not created:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not send the message.")

    full = client.table(MESSAGES_TABLE).select(MESSAGES_SELECT).eq("id", created[0]["id"]).single().execute().data
    logger.info("create_message select returned: %s", full)
    return MessageOut(**full)
