#!/usr/bin/env python3
"""Download SD 3.5 model weights from HuggingFace into the local models/ folder.

Files are stored in the standard HuggingFace cache layout so that the Docker
container finds them automatically — no MODEL_ID change required.

How it works:
  HF_HOME is set to ./models/ before downloading.
  snapshot_download writes to ./models/hub/models--<repo>/snapshots/<hash>/.
  docker-compose mounts ./models → /root/.cache/huggingface inside the container.
  from_pretrained("stabilityai/stable-diffusion-3.5-medium") checks that path
  first and loads from disk, skipping the internet entirely.
"""

import argparse
import os
import sys
from pathlib import Path

MODELS = {
    "medium":      "stabilityai/stable-diffusion-3.5-medium",
    "large":       "stabilityai/stable-diffusion-3.5-large",
    "large-turbo": "stabilityai/stable-diffusion-3.5-large-turbo",
}

# Only fetch diffusers-format component folders + config/tokenizer files.
# Root-level *.safetensors are single-file ComfyUI checkpoints — skip them.
DIFFUSERS_ALLOW_PATTERNS = [
    "model_index.json",
    "scheduler/**",
    "tokenizer/**",
    "tokenizer_2/**",
    "tokenizer_3/**",
    "text_encoder/**",
    "text_encoder_2/**",
    "text_encoder_3/**",
    "transformer/**",
    "vae/**",
]

MODELS_ROOT = Path(__file__).parent.parent / "models"
ENV_FILE = Path(__file__).parent.parent / ".env"


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download Stable Diffusion 3.5 model weights (diffusers format only).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="\n".join([
            "Examples:",
            "  python scripts/download_models.py                 # medium (default, ~6 GB)",
            "  python scripts/download_models.py --variant large",
            "  python scripts/download_models.py --variant large-turbo --token hf_xxx",
            "  python scripts/download_models.py --list",
        ]),
    )
    parser.add_argument(
        "--variant",
        choices=list(MODELS.keys()),
        default="medium",
        help="Which SD 3.5 variant to download (default: medium)",
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("HF_TOKEN", ""),
        help="HuggingFace access token (or set HF_TOKEN in .env). "
             "Required — models are gated. Create one at https://huggingface.co/settings/tokens",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available variants and their repo IDs, then exit",
    )
    return parser.parse_args()


def list_variants() -> None:
    print("Available variants:")
    sizes = {"medium": "~6 GB", "large": "~24 GB", "large-turbo": "~24 GB"}
    for name, repo in MODELS.items():
        print(f"  {name:<14} {repo}  ({sizes[name]})")


def ensure_huggingface_hub() -> None:
    try:
        import huggingface_hub  # noqa: F401
    except ImportError:
        print("huggingface_hub is not installed. Run:  pip install huggingface-hub")
        sys.exit(1)


def download(repo_id: str, token: str) -> str:
    from huggingface_hub import snapshot_download
    from huggingface_hub.utils import HfHubHTTPError

    # Write into models/ using the standard HF cache layout so the Docker
    # volume mount (./models → /root/.cache/huggingface) exposes the files
    # at the exact path from_pretrained expects inside the container.
    MODELS_ROOT.mkdir(parents=True, exist_ok=True)
    os.environ["HF_HOME"] = str(MODELS_ROOT)

    print(f"Repo      : {repo_id}")
    print(f"Cache dir : {MODELS_ROOT}")
    print(f"Components: {[p.rstrip('/**') for p in DIFFUSERS_ALLOW_PATTERNS if '**' in p]}")
    print()

    try:
        path = snapshot_download(
            repo_id=repo_id,
            token=token or None,
            allow_patterns=DIFFUSERS_ALLOW_PATTERNS,
        )
        return path
    except HfHubHTTPError as exc:
        if "401" in str(exc) or "403" in str(exc):
            print(
                "\nAccess denied. Make sure you have:\n"
                "  1. Accepted the license at https://huggingface.co/stabilityai/stable-diffusion-3.5-medium\n"
                "  2. Passed a valid --token (or set HF_TOKEN in .env)"
            )
        else:
            print(f"\nHTTP error: {exc}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nInterrupted — partial download left in place; re-run to resume.")
        sys.exit(1)


def main() -> None:
    load_dotenv(ENV_FILE)
    args = parse_args()

    if args.list:
        list_variants()
        return

    ensure_huggingface_hub()

    if not args.token:
        print(
            "No HuggingFace token found.\n"
            "SD 3.5 models are gated — you must:\n"
            "  1. Accept the license at https://huggingface.co/stabilityai/stable-diffusion-3.5-medium\n"
            "  2. Set HF_TOKEN in your .env or pass --token <value>"
        )
        sys.exit(1)

    repo_id = MODELS[args.variant]
    path = download(repo_id, args.token)

    print(
        f"\nDownload complete: {path}"
        f"\n\nNo .env changes needed — docker-compose mounts ./models into the"
        f"\ncontainer's HF cache, so MODEL_ID={repo_id} will load from disk."
    )


if __name__ == "__main__":
    main()
