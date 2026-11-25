# Техническое задание Codex на интеграцию
1. Прочитать `docs/audits/2026-11-22-static-audit.md`, `docs/integrations/lineradar/ARCHITECTURE.md` и существующий `AGENTS.md`; не нарушать его правила и не удалять `.lovable/north-star`.
2. Сначала закрывать **P0**: server-side auth/budget/rate for Groq, fail-closed factual integrity, RLS live verification; добавить CI. Не давать LLM придумывать составы, winrate, H2H.
3. Добавить strict UTC event identity registry и source provenance. Контракт `src/lib/lineradar/contract.ts` нужен только для types; не соединять backend до проверки data rights.
4. В дальнейшем — private signed bridge с quota, replay/idempotency, quarantine и mock tests. Не переносить LineRadar Python runtime/SQLite/secrets в публичный repo.
5. UI `/radar` — отдельным PR под выключенным флагом и auth, явно отличать 0 от отсутствующих данных и odds от model probability.
6. Согласовать с напарником и owner все изменения публичных миграций, Supabase и платного сервиса. Не делать live API запросов, deploy, switch VPS или менять production flags.
7. После каждого этапа писать `docs/reports/YYYY-MM-DD-<topic>.md`, коммитить, пушить, дать ссылку на PR/CI; замечания Codex хранить в GitHub PR/issue comments.
8. Согласовать один package manager (npm или Bun), избегая параллельных lockfile изменений без отдельного PR.
