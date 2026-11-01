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
    # "general" (the shared room) or the id of the user this message is for.
    chat_id: str = Field(default="general", max_length=64)

    _validate_content = field_validator("content")(_check_content_bytes)


class ChatOut(BaseModel):
    """One entry in the chat picker: a room or a direct conversation."""

    id: str
    name: str
    is_group: bool = False
    last_message: str | None = None
    last_message_at: datetime | None = None


class MessageOut(BaseModel):
    id: str
    sender_id: str
    sender_name: str | None
    content: str
    sent_at: datetime

    model_config = {"from_attributes": True}
