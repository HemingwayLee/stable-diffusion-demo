#!/usr/bin/env python3
"""
Stable Diffusion 3.5 inference — usable as a CLI script or imported as a module.

As a module (used by the webapp):
    from infer import load_pipeline, txt2img, img2img

As a CLI:
    # Text-to-image (default)
    python infer.py --prompt "a cat reading a book" --output cat.png

    # Image-to-image
    python infer.py --mode img2img --image input.png --prompt "oil painting version" --strength 0.75

    # Inside Docker
    docker compose exec backend python infer.py --prompt "a cat"
"""

import argparse
import os
import sys
from pathlib import Path
from typing import Optional

# ── aspect-ratio presets ──────────────────────────────────────────────────────

ASPECT_TO_DIMS: dict[str, tuple[int, int]] = {
    "1:1":   (512, 512),
    "16:9":  (768, 432),
    "9:16":  (432, 768),
    "4:5":   (512, 640),
    "5:4":   (640, 512),
    "3:2":   (768, 512),
    "2:3":   (512, 768),
    "21:9":  (768, 336),
    "9:21":  (336, 768),
}

_MAX_IMG2IMG_SIDE = 1024  # cap longest side of the input image


# ── pipeline loading ──────────────────────────────────────────────────────────

def detect_device(override: str = "") -> str:
    if override:
        return override
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
    except ImportError:
        pass
    return "cpu"


def load_pipeline(model_id: str, device: str = "", hf_token: str = ""):
    """
    Load StableDiffusion3Pipeline and derive StableDiffusion3Img2ImgPipeline
    from it (shared weights — no extra VRAM).

    Returns (txt2img_pipe, img2img_pipe, resolved_device).
    """
    import torch
    from diffusers import StableDiffusion3Img2ImgPipeline, StableDiffusion3Pipeline

    device = detect_device(device)
    dtype_map = {"cuda": torch.float16, "mps": torch.bfloat16, "cpu": torch.float32}
    torch_dtype = dtype_map.get(device, torch.float32)

    print(f"Loading pipeline: {model_id}  device={device}  dtype={torch_dtype}", flush=True)

    # Drop T5-XXL encoder on CPU — saves ~9 GB RAM with minor quality loss.
    extra = {}
    if device == "cpu":
        extra["text_encoder_3"] = None
        extra["tokenizer_3"] = None
    pipe = StableDiffusion3Pipeline.from_pretrained(
        model_id,
        torch_dtype=torch_dtype,
        token=hf_token or None,
        **extra,
    )

    if device == "cuda":
        low_vram = os.environ.get("LOW_VRAM", "false").lower() == "true"
        if low_vram:
            pipe.enable_model_cpu_offload()
        else:
            pipe = pipe.to("cuda")
    else:
        pipe = pipe.to(device)

    img2img_pipe = StableDiffusion3Img2ImgPipeline.from_pipe(pipe)

    return pipe, img2img_pipe, device


# ── inference helpers ─────────────────────────────────────────────────────────

def _resolve_seed(seed: Optional[int]) -> int:
    import torch
    return seed if seed is not None else int(torch.randint(0, 2**31 - 1, (1,)).item())


def _resize_for_img2img(image):
    """Scale down so the longest side is ≤ _MAX_IMG2IMG_SIDE, multiple of 8."""
    from PIL import Image
    w, h = image.size
    if max(w, h) <= _MAX_IMG2IMG_SIDE:
        new_w = (w // 8) * 8
        new_h = (h // 8) * 8
    else:
        scale = _MAX_IMG2IMG_SIDE / max(w, h)
        new_w = round(w * scale / 8) * 8
        new_h = round(h * scale / 8) * 8
    if (new_w, new_h) == (w, h):
        return image
    return image.resize((new_w, new_h), Image.LANCZOS)


# ── public inference API ──────────────────────────────────────────────────────

def txt2img(
    pipe,
    prompt: str,
    negative_prompt: str = "",
    width: int = 512,
    height: int = 512,
    steps: int = 28,
    cfg: float = 7.0,
    seed: Optional[int] = None,
    output_path: Optional[Path] = None,
):
    """
    Run text-to-image inference.
    Returns (PIL.Image, actual_seed). Saves to output_path if given.
    """
    import torch

    actual_seed = _resolve_seed(seed)
    generator = torch.Generator(device="cpu").manual_seed(actual_seed)

    result = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt,
        width=width,
        height=height,
        num_inference_steps=steps,
        guidance_scale=cfg,
        generator=generator,
    )
    image = result.images[0]
    if output_path:
        image.save(output_path)
        print(f"Saved → {output_path}", flush=True)
    return image, actual_seed


def img2img(
    pipe,
    image,
    prompt: str,
    negative_prompt: str = "",
    strength: float = 0.75,
    steps: int = 28,
    cfg: float = 7.0,
    seed: Optional[int] = None,
    output_path: Optional[Path] = None,
):
    """
    Run image-to-image inference.
    image: PIL.Image or bytes.
    Returns (PIL.Image, actual_seed). Saves to output_path if given.
    """
    import io
    import torch
    from PIL import Image

    if isinstance(image, (bytes, bytearray)):
        image = Image.open(io.BytesIO(image)).convert("RGB")
    elif not hasattr(image, "size"):
        raise TypeError(f"image must be PIL.Image or bytes, got {type(image)}")
    else:
        image = image.convert("RGB")

    image = _resize_for_img2img(image)

    actual_seed = _resolve_seed(seed)
    generator = torch.Generator(device="cpu").manual_seed(actual_seed)

    result = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt,
        image=image,
        strength=strength,
        num_inference_steps=steps,
        guidance_scale=cfg,
        generator=generator,
    )
    out = result.images[0]
    if output_path:
        out.save(output_path)
        print(f"Saved → {output_path}", flush=True)
    return out, actual_seed


# ── CLI ───────────────────────────────────────────────────────────────────────

def _load_dotenv() -> None:
    """Load .env from repo root (two levels up from this file, or one if running from backend/)."""
    candidates = [
        Path(__file__).parent / ".env",
        Path(__file__).parent.parent / ".env",
    ]
    for path in candidates:
        if path.is_file():
            for line in path.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))
            break


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Stable Diffusion 3.5 CLI inference.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="\n".join([
            "Examples:",
            "  # Text-to-image",
            "  python infer.py --prompt 'a cat reading a book' --output cat.png",
            "",
            "  # Image-to-image",
            "  python infer.py --mode img2img --image photo.jpg \\",
            "                  --prompt 'oil painting version' --strength 0.75",
            "",
            "  # Inside Docker",
            "  docker compose exec backend python infer.py --prompt 'a cat'",
        ]),
    )
    p.add_argument("--mode", choices=["txt2img", "img2img"], default="txt2img")
    p.add_argument("--prompt", required=True, help="Text prompt")
    p.add_argument("--negative-prompt", default="", metavar="TEXT")
    p.add_argument(
        "--model",
        default=os.environ.get("MODEL_ID", "stabilityai/stable-diffusion-3.5-medium"),
        help="HuggingFace repo ID or local path (default: $MODEL_ID env var)",
    )
    p.add_argument("--token", default=os.environ.get("HF_TOKEN", ""), help="HuggingFace token")
    p.add_argument("--device", default=os.environ.get("DEVICE", ""), help="cuda | mps | cpu")
    p.add_argument("--steps", type=int, default=28)
    p.add_argument("--cfg", type=float, default=7.0, metavar="SCALE")
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--output", type=Path, default=Path("output.png"), metavar="PATH")

    # txt2img options
    g = p.add_argument_group("txt2img options")
    g.add_argument(
        "--aspect-ratio",
        choices=list(ASPECT_TO_DIMS.keys()),
        default="1:1",
        metavar="RATIO",
        help="Output aspect ratio: " + " | ".join(ASPECT_TO_DIMS.keys()),
    )

    # img2img options
    g2 = p.add_argument_group("img2img options")
    g2.add_argument("--image", type=Path, default=None, metavar="PATH", help="Input image")
    g2.add_argument("--strength", type=float, default=0.75, help="0.0–1.0 (default 0.75)")

    return p.parse_args()


def main() -> None:
    _load_dotenv()
    args = _parse_args()

    if args.mode == "img2img" and args.image is None:
        print("Error: --image is required for img2img mode.", file=sys.stderr)
        sys.exit(1)

    txt2img_pipe, img2img_pipe, _ = load_pipeline(
        model_id=args.model,
        device=args.device,
        hf_token=args.token,
    )

    if args.mode == "txt2img":
        width, height = ASPECT_TO_DIMS.get(args.aspect_ratio, (1024, 1024))
        _, actual_seed = txt2img(
            pipe=txt2img_pipe,
            prompt=args.prompt,
            negative_prompt=args.negative_prompt,
            width=width,
            height=height,
            steps=args.steps,
            cfg=args.cfg,
            seed=args.seed,
            output_path=args.output,
        )
    else:
        from PIL import Image
        input_image = Image.open(args.image)
        _, actual_seed = img2img(
            pipe=img2img_pipe,
            image=input_image,
            prompt=args.prompt,
            negative_prompt=args.negative_prompt,
            strength=args.strength,
            steps=args.steps,
            cfg=args.cfg,
            seed=args.seed,
            output_path=args.output,
        )

    print(f"Done  seed={actual_seed}", flush=True)


if __name__ == "__main__":
    main()
