from fastapi import APIRouter
from app.services import sd_service

router = APIRouter(prefix="/status", tags=["status"])


@router.get("/")
async def get_model_status() -> dict:
    return sd_service.get_status()
