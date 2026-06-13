"""Entrypoint: uvicorn app.main:app (запускать из папки backend)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import uvicorn

if "--prod" in sys.argv:
    os.environ.setdefault("APP_ENV", "production")
    os.environ.setdefault("SERVE_STATIC", "true")

from app.config import settings

_BACKEND_DIR = Path(__file__).resolve().parent

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        workers=settings.workers if settings.is_production else 1,
        reload=not settings.is_production,
        reload_dirs=[str(_BACKEND_DIR / "app")] if not settings.is_production else None,
    )
