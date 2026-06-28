"""Local Stable Diffusion 3.5 inference using diffusers."""

import asyncio
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

import torch
from diffusers import StableDiffusion3Pipeline

from app.core.config import settings

# ── module-level state ───────────────────────────────────────────────────────

_pipeline: Optional[StableDiffusion3Pipeline] = None
_status: str = "not_started"   # "loading" | "ready" | "error"
_error: Optional[str] = None
_device: str = "cpu"

# Single-worker executor so GPU is never called from two threads at once
_executor = ThreadPoolExecutor(max_workers=1)

# ── aspect-ratio → (width, height) ──────────────────────────────────────────

ASPECT_TO_DIMS: dict[str, tuple[int, int]] = {
    "1:1":   (1024, 1024),
    "16:9":  (1280, 720),
    "9:16":  (720, 1280),
    "4:5":   (832, 1040),
    "5:4":   (1040, 832),
    "3:2":   (1152, 768),
    "2:3":   (768, 1152),
    "21:9":  (1344, 576),
    "9:21":  (576, 1344),
}

# ── helpers ──────────────────────────────────────────────────────────────────

def _detect_device() -> str:
    if settings.DEVICE:
        return settings.DEVICE
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _load_pipeline_sync() -> StableDiffusion3Pipeline:
    device = _detect_device()

    dtype_map: dict[str, torch.dtype] = {
        "cuda": torch.float16,
        "mps":  torch.bfloat16,
        "cpu":  torch.float32,
    }
    torch_dtype = dtype_map.get(device, torch.float32)

    pipe = StableDiffusion3Pipeline.from_pretrained(
        settings.MODEL_ID,
        torch_dtype=torch_dtype,
        token=settings.HF_TOKEN or None,
    )

    if device == "cuda":
        if settings.LOW_VRAM:
            pipe.enable_model_cpu_offload()
        else:
            pipe = pipe.to("cuda")
    else:
        pipe = pipe.to(device)

    return pipe

# ── public API ────────────────────────────────────────────────────────────────

def get_status() -> dict:
    return {
        "model_id": settings.MODEL_ID,
        "status": _status,
        "device": _device,
        "error": _error,
        "is_turbo": "turbo" in settings.MODEL_ID.lower(),
    }


async def load_model() -> None:
    """Called once at startup; runs the heavy work in a thread."""
    global _pipeline, _status, _error, _device

    _status = "loading"
    _device = _detect_device()
    try:
        _pipeline = await asyncio.get_event_loop().run_in_executor(
            _executor, _load_pipeline_sync
        )
        _status = "ready"
    except Exception as exc:
        _status = "error"
        _error = str(exc)
        raise


def _infer_sync(
    prompt: str,
    negative_prompt: Optional[str],
    width: int,
    height: int,
    num_inference_steps: int,
    guidance_scale: float,
    seed: Optional[int],
    images_dir: Path,
) -> dict:
    if _pipeline is None:
        raise RuntimeError("Model not loaded")

    actual_seed = seed if seed is not None else int(torch.randint(0, 2**31 - 1, (1,)).item())
    generator = torch.Generator(device="cpu").manual_seed(actual_seed)

    result = _pipeline(
        prompt=prompt,
        negative_prompt=negative_prompt or "",
        width=width,
        height=height,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        generator=generator,
    )

    filename = f"{uuid.uuid4()}.png"
    result.images[0].save(images_dir / filename)
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

    width, height = ASPECT_TO_DIMS.get(aspect_ratio, (1024, 1024))

    return await asyncio.get_event_loop().run_in_executor(
        _executor,
        _infer_sync,
        prompt,
        negative_prompt,
        width,
        height,
        num_inference_steps,
        guidance_scale,
        seed,
        images_dir,
    )
