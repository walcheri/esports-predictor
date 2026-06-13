"""HTTP-клиент PandaScore REST API."""

from __future__ import annotations

from typing import Any

import httpx

from app.config import settings


class PandaScoreError(Exception):
    pass


class PandaScoreClient:
    def __init__(self) -> None:
        if not settings.pandascore_api_key:
            raise PandaScoreError("PANDASCORE_API_KEY не задан в .env")
        self.base_url = settings.pandascore_base_url.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {settings.pandascore_api_key}",
            "Accept": "application/json",
        }

    async def _request(
        self, path: str, params: dict[str, Any] | None = None
    ) -> Any:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.get(
                f"{self.base_url}{path}",
                headers=self.headers,
                params=params or {},
            )
            if response.status_code == 401:
                raise PandaScoreError("Неверный PANDASCORE_API_KEY")
            if response.status_code == 429:
                raise PandaScoreError("Лимит запросов PandaScore — повторите позже")
            if response.status_code in (403, 404):
                return None
            if response.status_code >= 500:
                raise PandaScoreError(
                    f"PandaScore {response.status_code}: {path}"
                )
            response.raise_for_status()
            return response.json()

    async def _get_list(self, path: str, params: dict[str, Any] | None = None) -> list[dict]:
        data = await self._request(path, params)
        if data is None:
            return []
        if not isinstance(data, list):
            raise PandaScoreError(f"Неожиданный ответ PandaScore: {path}")
        return data

    async def _get_one(self, path: str, params: dict[str, Any] | None = None) -> dict | None:
        data = await self._request(path, params)
        if data is None:
            return None
        if not isinstance(data, dict):
            raise PandaScoreError(f"Неожиданный ответ PandaScore: {path}")
        return data

    async def get_videogames(self) -> list[dict]:
        return await self._get_list("/videogames", {"per_page": 100})

    _MATCH_INCLUDES = "opponents.opponent,league,serie,videogame,streams_list"

    async def get_upcoming_matches(
        self, videogame_slug: str, page: int = 1, per_page: int = 50
    ) -> list[dict]:
        return await self._get_list(
            "/matches/upcoming",
            {
                "filter[videogame]": videogame_slug,
                "filter[opponents_filled]": "true",
                "page": page,
                "per_page": per_page,
                "sort": "scheduled_at",
                "include": self._MATCH_INCLUDES,
            },
        )

    async def get_running_matches(
        self, videogame_slug: str, page: int = 1, per_page: int = 50
    ) -> list[dict]:
        return await self._get_list(
            "/matches/running",
            {
                "filter[videogame]": videogame_slug,
                "filter[opponents_filled]": "true",
                "page": page,
                "per_page": per_page,
                "include": self._MATCH_INCLUDES,
            },
        )

    async def get_match(self, match_id: int) -> dict | None:
        return await self._get_one(
            f"/matches/{match_id}",
            {"include": self._MATCH_INCLUDES},
        )

    async def get_match_games(self, match_id: int, videogame_slug: str) -> list[dict]:
        for path in (
            f"/matches/{match_id}/games",
            f"/{videogame_slug}/matches/{match_id}/games",
        ):
            games = await self._get_list(path)
            if games:
                return games
        return []

    async def get_team(self, team_id: int) -> dict | None:
        return await self._get_one(f"/teams/{team_id}")

    async def get_team_players(self, team_id: int) -> list[dict]:
        return await self._get_list(f"/teams/{team_id}/players", {"per_page": 50})

    async def get_team_past_matches(
        self, team_id: int, videogame_slug: str, per_page: int = 50
    ) -> list[dict]:
        params: dict[str, Any] = {
            "filter[opponent_id]": str(team_id),
            "per_page": per_page,
            "sort": "-end_at",
        }
        if videogame_slug:
            params["filter[videogame]"] = videogame_slug
        return await self._get_list("/matches/past", params)

    async def get_h2h_matches(
        self, team_a_id: int, team_b_id: int, videogame_slug: str, per_page: int = 10
    ) -> list[dict]:
        return await self._get_list(
            "/matches/past",
            {
                "filter[videogame]": videogame_slug,
                "filter[opponent_id]": f"{team_a_id},{team_b_id}",
                "per_page": per_page,
                "sort": "-end_at",
            },
        )
