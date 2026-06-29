import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import settings
from app.models.generation import Generation
from app.schemas.generation import GenerationCreate, GenerationResponse
from app.services import sd_service

router = APIRouter(prefix="/generations", tags=["generations"])


def _image_url(request: Request, filename: str | None) -> str | None:
    if not filename:
        return None
    return str(request.base_url) + f"images/{filename}"


def _to_response(gen: Generation, request: Request) -> GenerationResponse:
    return GenerationResponse(
        id=gen.id,
        prompt=gen.prompt,
        negative_prompt=gen.negative_prompt,
        model=gen.model,
        aspect_ratio=gen.aspect_ratio,
        cfg_scale=gen.cfg_scale,
        steps=gen.steps,
        seed=gen.seed,
        actual_seed=gen.actual_seed,
        generation_type=gen.generation_type,
        strength=gen.strength,
        status=gen.status,
        image_url=_image_url(request, gen.image_filename),
        input_image_url=_image_url(request, gen.input_image_filename),
        error_message=gen.error_message,
        created_at=gen.created_at,
        completed_at=gen.completed_at,
        duration_ms=gen.duration_ms,
    )


async def _run_generation(generation_id: uuid.UUID, data: GenerationCreate) -> None:
    from app.core.database import AsyncSessionLocal

    images_dir = Path(settings.IMAGES_DIR)

    async with AsyncSessionLocal() as session:
        gen = await session.get(Generation, generation_id)
        if not gen:
            return

        gen.status = "generating"
        await session.commit()

        start = datetime.now(timezone.utc)
        try:
            result = await sd_service.generate_image(
                prompt=data.prompt,
                negative_prompt=data.negative_prompt,
                aspect_ratio=data.aspect_ratio,
                num_inference_steps=data.steps,
                guidance_scale=data.cfg_scale,
                seed=data.seed,
                images_dir=images_dir,
            )
            end = datetime.now(timezone.utc)
            gen.status = "completed"
            gen.image_filename = result["filename"]
            gen.actual_seed = result.get("actual_seed")
            gen.completed_at = end
            gen.duration_ms = int((end - start).total_seconds() * 1000)
        except Exception as exc:
            end = datetime.now(timezone.utc)
            gen.status = "failed"
            gen.error_message = str(exc)
            gen.completed_at = end
            gen.duration_ms = int((end - start).total_seconds() * 1000)

        await session.commit()


async def _run_img2img_generation(
    generation_id: uuid.UUID,
    image_bytes: bytes,
    prompt: str,
    negative_prompt: Optional[str],
    strength: float,
    cfg_scale: float,
    steps: int,
    seed: Optional[int],
) -> None:
    from app.core.database import AsyncSessionLocal

    images_dir = Path(settings.IMAGES_DIR)

    async with AsyncSessionLocal() as session:
        gen = await session.get(Generation, generation_id)
        if not gen:
            return

        gen.status = "generating"
        await session.commit()

        start = datetime.now(timezone.utc)
        try:
            result = await sd_service.generate_image_to_image(
                prompt=prompt,
                negative_prompt=negative_prompt,
                image_bytes=image_bytes,
                strength=strength,
                num_inference_steps=steps,
                guidance_scale=cfg_scale,
                seed=seed,
                images_dir=images_dir,
            )
            end = datetime.now(timezone.utc)
            gen.status = "completed"
            gen.image_filename = result["filename"]
            gen.actual_seed = result.get("actual_seed")
            gen.completed_at = end
            gen.duration_ms = int((end - start).total_seconds() * 1000)
        except Exception as exc:
            end = datetime.now(timezone.utc)
            gen.status = "failed"
            gen.error_message = str(exc)
            gen.completed_at = end
            gen.duration_ms = int((end - start).total_seconds() * 1000)

        await session.commit()


@router.post("/", response_model=GenerationResponse, status_code=201)
async def create_generation(
    data: GenerationCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> GenerationResponse:
    status = sd_service.get_status()
    if status["status"] != "ready":
        raise HTTPException(
            status_code=503,
            detail=f"Model is not ready (status: {status['status']}). Please wait.",
        )

    gen = Generation(
        prompt=data.prompt,
        negative_prompt=data.negative_prompt,
        model=settings.MODEL_ID,
        aspect_ratio=data.aspect_ratio,
        cfg_scale=data.cfg_scale,
        steps=data.steps,
        seed=data.seed,
        generation_type="txt2img",
        status="pending",
    )
    db.add(gen)
    await db.commit()
    await db.refresh(gen)

    background_tasks.add_task(_run_generation, gen.id, data)
    return _to_response(gen, request)


@router.post("/img2img/", response_model=GenerationResponse, status_code=201)
async def create_img2img_generation(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    image: UploadFile = File(...),
    prompt: str = Form(..., min_length=1, max_length=10000),
    negative_prompt: Optional[str] = Form(None),
    strength: float = Form(0.75),
    cfg_scale: float = Form(7.0),
    steps: int = Form(28),
    seed: Optional[int] = Form(None),
) -> GenerationResponse:
    status = sd_service.get_status()
    if status["status"] != "ready":
        raise HTTPException(
            status_code=503,
            detail=f"Model is not ready (status: {status['status']}). Please wait.",
        )

    image_bytes = await image.read()

    # Save the input image so the frontend can display it alongside the result
    images_dir = Path(settings.IMAGES_DIR)
    input_filename = f"input_{uuid.uuid4()}.png"
    from PIL import Image as PILImage
    import io
    pil = PILImage.open(io.BytesIO(image_bytes)).convert("RGB")
    pil.save(images_dir / input_filename)

    gen = Generation(
        prompt=prompt,
        negative_prompt=negative_prompt,
        model=settings.MODEL_ID,
        aspect_ratio="1:1",  # not applicable for img2img but column is non-null
        cfg_scale=cfg_scale,
        steps=steps,
        seed=seed,
        generation_type="img2img",
        strength=strength,
        input_image_filename=input_filename,
        status="pending",
    )
    db.add(gen)
    await db.commit()
    await db.refresh(gen)

    background_tasks.add_task(
        _run_img2img_generation,
        gen.id,
        image_bytes,
        prompt,
        negative_prompt,
        strength,
        cfg_scale,
        steps,
        seed,
    )
    return _to_response(gen, request)


@router.get("/", response_model=list[GenerationResponse])
async def list_generations(
    request: Request,
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
) -> list[GenerationResponse]:
    result = await db.execute(
        select(Generation).order_by(desc(Generation.created_at)).limit(limit).offset(offset)
    )
    return [_to_response(g, request) for g in result.scalars().all()]


@router.get("/{generation_id}", response_model=GenerationResponse)
async def get_generation(
    generation_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> GenerationResponse:
    gen = await db.get(Generation, generation_id)
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")
    return _to_response(gen, request)


@router.delete("/{generation_id}", status_code=204)
async def delete_generation(
    generation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    gen = await db.get(Generation, generation_id)
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")

    images_dir = Path(settings.IMAGES_DIR)
    for filename in (gen.image_filename, gen.input_image_filename):
        if filename:
            path = images_dir / filename
            if path.exists():
                path.unlink()

    await db.delete(gen)
    await db.commit()
