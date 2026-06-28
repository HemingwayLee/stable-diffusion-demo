import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class GenerationCreate(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=10000)
    negative_prompt: Optional[str] = Field(None, max_length=10000)
    aspect_ratio: str = Field("1:1")
    cfg_scale: float = Field(7.0, ge=1.0, le=20.0)
    steps: int = Field(28, ge=1, le=50)
    seed: Optional[int] = Field(None, ge=0, le=4294967294)


class GenerationResponse(BaseModel):
    id: uuid.UUID
    prompt: str
    negative_prompt: Optional[str]
    model: str
    aspect_ratio: str
    cfg_scale: float
    steps: int
    seed: Optional[int]
    actual_seed: Optional[int]
    status: str
    image_url: Optional[str] = None
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    duration_ms: Optional[int]

    model_config = {"from_attributes": True}
