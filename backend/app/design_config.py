"""Только визуальные токены дизайна. Названия и данные — из PandaScore."""

DESIGN_BY_PS_SLUG: dict[str, dict[str, str]] = {
    "cs-go": {
        "id": "cs2",
        "short_name": "CS2",
        "color": "#DE9B35",
        "gradient": "from-primary/30 via-primary/10 to-transparent",
    },
    "dota-2": {
        "id": "dota2",
        "short_name": "Dota 2",
        "color": "#F04747",
        "gradient": "from-red-500/30 via-red-500/10 to-transparent",
    },
    "league-of-legends": {
        "id": "lol",
        "short_name": "LoL",
        "color": "#1E96FF",
        "gradient": "from-blue-500/30 via-blue-500/10 to-transparent",
    },
    "valorant": {
        "id": "valorant",
        "short_name": "Valorant",
        "color": "#FF4654",
        "gradient": "from-red-400/30 via-red-400/10 to-transparent",
    },
}

SUPPORTED_PS_SLUGS = set(DESIGN_BY_PS_SLUG.keys())
