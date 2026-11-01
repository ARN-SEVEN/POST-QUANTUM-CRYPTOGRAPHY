from datetime import datetime, timedelta, timezone
from typing import Any
import bcrypt
import jwt
from jwt import PyJWTError

from .config import get_settings


ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed stored hash: treat it as a failed credential check.
        return False


def create_access_token(user_id: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expires_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate the JWT without touching the database.

    Raises PyJWTError for an expired or otherwise invalid token.
    """
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[ALGORITHM],
            options={"require": ["sub", "exp", "iat"]},
        )
    except PyJWTError as error:
        raise PyJWTError("Invalid or expired access token.") from error
