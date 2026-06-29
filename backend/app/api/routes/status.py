import asyncio

from fastapi import APIRouter, HTTPException

from app.services import sd_service

router = APIRouter(prefix="/status", tags=["status"])


@router.get("/")
async def get_model_status() -> dict:
    return sd_service.get_status()


@router.post("/load")
async def load_model() -> dict:
    status = sd_service.get_status()["status"]
    if status == "ready":
        raise HTTPException(status_code=400, detail="Model is already loaded.")
    if status == "loading":
        raise HTTPException(status_code=400, detail="Model is already loading.")
    asyncio.create_task(sd_service.load_model())
    return {"detail": "Model load started."}
