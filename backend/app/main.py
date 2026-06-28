import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import Base, engine
from app.api.routes import generations, status
from app.services import sd_service

logger = logging.getLogger(__name__)

# Ensure images directory exists before StaticFiles mounts it
Path(settings.IMAGES_DIR).mkdir(parents=True, exist_ok=True)


async def _load_model_with_logging():
    try:
        logger.info("Starting model download/load: %s", settings.MODEL_ID)
        await sd_service.load_model()
        logger.info("Model loaded successfully")
    except Exception as exc:
        logger.error("Model failed to load: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Load the SD model in the background so the API is immediately reachable.
    # Requests will receive 503 until the model finishes loading.
    asyncio.create_task(_load_model_with_logging())

    yield
    await engine.dispose()


app = FastAPI(
    title="Stable Diffusion 3.5 Demo API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/images", StaticFiles(directory=settings.IMAGES_DIR), name="images")
app.include_router(generations.router, prefix="/api/v1")
app.include_router(status.router, prefix="/api/v1")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
