"""Request and response models for the auth endpoints.

Message models live in a separate file so the auth schema is not polluted.
"""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


MAX_MESSAGE_BYTES = 4000


def _check_content_bytes(content: str) -> str:
    if len(content.encode("utf-8")) > MAX_MESSAGE_BYTES:
        raise ValueError(f"Message must be at most {MAX_MESSAGE_BYTES} bytes long.")
    return content


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_BYTES)

    _validate_content = field_validator("content")(_check_content_bytes)


class MessageOut(BaseModel):
    id: str
    sender_id: str
    sender_name: str | None
    content: str
    sent_at: datetime

    model_config = {"from_attributes": True}
