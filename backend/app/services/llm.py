import json
import logging

import httpx

from app.config import settings
from app.models import Match
from app.services.match_analytics import build_llm_context, match_has_analytics

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """Ты — аналитик киберспорта. Пиши на русском, Markdown.

Правила:
- Используй ТОЛЬКО данные из JSON и отчёта PandaScore ниже.
- НЕ выдумывай игроков, статистику, матчи, карты или факты.
- Если данных для вывода нет — напиши одну фразу «Недостаточно данных для аналитического вывода» и больше ничего.
- Составы уже из PandaScore — не дополняй их из памяти.
- Структура (если данных достаточно):
  ## Аналитический вывод
  ### Составы и роли
  ### Ключевые факторы
  ### Рекомендация"""


def _build_user_prompt(
    match: Match,
    base_report: str,
    team_a_prob: float,
    team_b_prob: float,
    confidence: float,
    key_arguments: list[str],
) -> str:
    ta, tb = match.team_a, match.team_b
    args = "\n".join(f"- {a}" for a in key_arguments) if key_arguments else "- (нет)"
    context = build_llm_context(match)

    return f"""Дополни отчёт аналитикой на основе ТОЛЬКО этих данных.

## Отчёт PandaScore
{base_report}

## Прогноз модели
- {ta.name}: {round(team_a_prob * 100)}%
- {tb.name}: {round(team_b_prob * 100)}%
- Уверенность: {round(confidence * 100)}%

## Аргументы
{args}

## Сырые данные (JSON)
{json.dumps(context, ensure_ascii=False, indent=2)}"""


async def generate_llm_report(
    match: Match,
    base_report: str,
    team_a_prob: float,
    team_b_prob: float,
    confidence: float,
    key_arguments: list[str],
) -> str | None:
    if not settings.openai_api_key:
        return None
    if not base_report or not base_report.strip():
        logger.info("LLM skip: пустой базовый отчёт")
        return None
    if not match_has_analytics(match):
        logger.info("LLM skip: нет данных PandaScore")
        return None

    user_prompt = _build_user_prompt(
        match, base_report, team_a_prob, team_b_prob, confidence, key_arguments
    )

    url = f"{settings.openai_base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": settings.openai_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 4000,
    }

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if response.status_code == 401:
                logger.error("LLM: неверный API-ключ")
                return None
            if response.status_code >= 400:
                logger.error("LLM %s: %s", response.status_code, response.text[:300])
                return None
            content = response.json()["choices"][0]["message"]["content"]
            if not content or not content.strip():
                return None
            if "недостаточно данных" in content.lower():
                return base_report
            return f"{base_report}\n\n---\n\n{content.strip()}"
    except (httpx.HTTPError, KeyError, IndexError) as exc:
        logger.error("LLM request failed: %s", exc)
        return None
