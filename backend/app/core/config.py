from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://sduser:sdpassword@db:5432/sddb"

    # HuggingFace token — required for gated SD 3.5 models.
    # Accept the license at https://huggingface.co/stabilityai/stable-diffusion-3.5-medium
    # then create a token at https://huggingface.co/settings/tokens
    HF_TOKEN: str = ""

    # HuggingFace model repo to load
    MODEL_ID: str = "stabilityai/stable-diffusion-3.5-medium"

    # Inference device: "cuda", "mps", or "cpu". Leave empty to auto-detect.
    DEVICE: str = ""

    # Enable model CPU offloading to reduce VRAM usage (CUDA only, slower)
    LOW_VRAM: bool = False

    IMAGES_DIR: str = "/app/images"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
