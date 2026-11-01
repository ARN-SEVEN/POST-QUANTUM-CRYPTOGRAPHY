"""Request and response models for the auth endpoints."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

# bcrypt rejects inputs longer than 72 bytes and raises instead of truncating.
MAX_PASSWORD_BYTES = 72


def _check_password_bytes(password: str) -> str:
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes long.")
    return password


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=MAX_PASSWORD_BYTES)
    display_name: str | None = Field(default=None, max_length=80)

    _validate_password = field_validator("password")(_check_password_bytes)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_BYTES)

    _validate_password = field_validator("password")(_check_password_bytes)


class UserOut(BaseModel):
    id: str
    email: EmailStr
    display_name: str | None = None
    created_at: datetime | None = None


class MessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class SenderInfo(BaseModel):
    display_name: str | None = None


class MessageOut(BaseModel):
    id: str
    sender_id: str
    content: str
    sent_at: datetime
    sender: SenderInfo | None = None


class MessagesList(BaseModel):
    messages: list[MessageOut]


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
