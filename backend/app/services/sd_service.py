"""FastAPI service wrapper around infer.py — manages pipeline singleton and async execution."""

import asyncio
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

import infer
from app.core.config import settings

# ── module-level state ────────────────────────────────────────────────────────

_txt2img_pipe = None
_img2img_pipe = None
_status: str = "not_started"
_error: Optional[str] = None
_device: str = "cpu"
_progress: dict = {"loaded_components": 0, "total_components": 0}

# Single-worker executor so GPU is never called from two threads at once
_executor = ThreadPoolExecutor(max_workers=1)

# ── tqdm patch: surface per-component loading progress to the status endpoint ──

try:
    import diffusers.pipelines.pipeline_utils as _du

    _OrigTqdm = _du.tqdm

    class _ProgressTqdm(_OrigTqdm):  # type: ignore[misc]
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            if self.desc and "Loading pipeline components" in self.desc:
                _progress["total_components"] = self.total or 0
                _progress["loaded_components"] = 0

        def update(self, n=1):
            super().update(n)
            if self.desc and "Loading pipeline components" in self.desc:
                _progress["loaded_components"] = self.n

    _du.tqdm = _ProgressTqdm
except Exception:
    pass

# ── public API ─────────────────────────────────────────────────────────────────

def get_status() -> dict:
    return {
        "model_id": settings.MODEL_ID,
        "status": _status,
        "device": _device,
        "error": _error,
        "is_turbo": "turbo" in settings.MODEL_ID.lower(),
        "progress": {
            "loaded_components": _progress["loaded_components"],
            "total_components": _progress["total_components"],
        } if _status == "loading" else None,
    }


async def load_model() -> None:
    global _txt2img_pipe, _img2img_pipe, _status, _error, _device

    _status = "loading"
    _progress["loaded_components"] = 0
    _progress["total_components"] = 0
    try:
        _txt2img_pipe, _img2img_pipe, _device = await asyncio.get_event_loop().run_in_executor(
            _executor,
            infer.load_pipeline,
            settings.MODEL_ID,
            settings.DEVICE,
            settings.HF_TOKEN,
        )
        _status = "ready"
    except Exception as exc:
        _status = "error"
        _error = str(exc)
        raise


def _txt2img_sync(
    prompt: str,
    negative_prompt: Optional[str],
    width: int,
    height: int,
    steps: int,
    cfg: float,
    seed: Optional[int],
    images_dir: Path,
) -> dict:
    image, actual_seed = infer.txt2img(
        pipe=_txt2img_pipe,
        prompt=prompt,
        negative_prompt=negative_prompt or "",
        width=width,
        height=height,
        steps=steps,
        cfg=cfg,
        seed=seed,
    )
    filename = f"{uuid.uuid4()}.png"
    image.save(images_dir / filename)
    return {"filename": filename, "actual_seed": actual_seed}


async def generate_image(
    prompt: str,
    negative_prompt: Optional[str],
    aspect_ratio: str,
    num_inference_steps: int,
    guidance_scale: float,
    seed: Optional[int],
    images_dir: Path,
) -> dict:
    if _status != "ready":
        raise RuntimeError(f"Model is not ready (status: {_status})")

    width, height = infer.ASPECT_TO_DIMS.get(aspect_ratio, (1024, 1024))

    return await asyncio.get_event_loop().run_in_executor(
        _executor,
        _txt2img_sync,
        prompt, negative_prompt, width, height, num_inference_steps, guidance_scale, seed, images_dir,
    )


def _img2img_sync(
    prompt: str,
    negative_prompt: Optional[str],
    image_bytes: bytes,
    strength: float,
    steps: int,
    cfg: float,
    seed: Optional[int],
    images_dir: Path,
) -> dict:
    image, actual_seed = infer.img2img(
        pipe=_img2img_pipe,
        image=image_bytes,
        prompt=prompt,
        negative_prompt=negative_prompt or "",
        strength=strength,
        steps=steps,
        cfg=cfg,
        seed=seed,
    )
    filename = f"{uuid.uuid4()}.png"
    image.save(images_dir / filename)
    return {"filename": filename, "actual_seed": actual_seed}


async def generate_image_to_image(
    prompt: str,
    negative_prompt: Optional[str],
    image_bytes: bytes,
    strength: float,
    num_inference_steps: int,
    guidance_scale: float,
    seed: Optional[int],
    images_dir: Path,
) -> dict:
    if _status != "ready":
        raise RuntimeError(f"Model is not ready (status: {_status})")

    return await asyncio.get_event_loop().run_in_executor(
        _executor,
        _img2img_sync,
        prompt, negative_prompt, image_bytes, strength, num_inference_steps, guidance_scale, seed, images_dir,
    )
