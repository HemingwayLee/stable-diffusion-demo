---
name: project-sd-demo
description: Stable Diffusion 3.5 demo webapp — stack, structure, and key design decisions
metadata:
  type: project
---

Full-stack webapp for demoing Stable Diffusion 3.5 via the Stability AI API.

**Stack:**
- Frontend: React 18 + TypeScript + MUI v6 + TanStack Query v5 + Vite 6, served on port 5173
- Backend: Python 3.12 + FastAPI + SQLAlchemy (async) + asyncpg + PostgreSQL 16, served on port 8000
- Dev environment: Docker Compose with hot reload (uvicorn --reload + Vite polling watcher)

**Key design decisions:**
- SD 3.5 is called via Stability AI REST API (`/v2beta/stable-image/generate/sd3`), requires `STABILITY_API_KEY` in `.env`
- Turbo models don't support negative prompts — handled in `stability_service.py`
- Generation is async: POST creates a DB record (status=pending), background task calls the API, frontend polls GET every 1.5s until completed/failed
- Images saved as PNG to a named Docker volume (`images_data:/app/images`), served by FastAPI StaticFiles at `/images/`
- `Path(settings.IMAGES_DIR).mkdir()` called at module load in `main.py` so StaticFiles mount doesn't fail on cold start

**How to apply:** When adding features, keep the async polling pattern for any long-running AI operations. The images directory must exist before the app starts (already handled at module level).
