# Architecture rules

- Keep Groq transport and model-availability recovery inside the prediction function's local helper; retry unavailable models only against the account's active catalog, preserving the preferred model and provider.
- Keep profile reads owner-scoped and enforce waitlist email, account ownership, and creation-time validation in database policies; guest waitlist submissions remain supported without exposing personal profiles.
## LineRadar integration foundation

- Читать `docs/audits/2026-11-22-static-audit.md` и `docs/integrations/lineradar/ARCHITECTURE.md` до integration changes.
- Делать отдельные ветки/PR, никогда напрямую не менять main без партнёрского review.
- Не экспортировать приватный LineRadar в публичный repo; запрещены API keys, private SQLite/Telegram state, raw odds до подтверждения лицензии.
- Не придумывать факты, H2H, проценты и составы: `null`/unavailable и строгий provenance.
- Документировать каждый законченный этап в `docs/reports/` по `docs/reports/README.md`; commit+push+PR comment.
- Не удалять/не перезаписывать existing `AGENTS.md` и Lovable north-star.
