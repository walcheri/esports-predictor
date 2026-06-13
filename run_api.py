#!/usr/bin/env python3
"""Запуск API из корня проекта.

Использование:
  python run_api.py
  npm run dev:backend
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"

os.chdir(BACKEND)
sys.path.insert(0, str(BACKEND))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

if __name__ == "__main__":
    import uvicorn

    from app.config import settings

    host = "127.0.0.1" if not settings.is_production else settings.host
    uvicorn.run(
        "app.main:app",
        host=host,
        port=settings.port,
        reload=not settings.is_production,
        reload_dirs=[str(BACKEND / "app")],
    )
