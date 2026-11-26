# Provider comparison — documentation checked 2026-11-26

No authenticated provider requests, paid calls or scraping performed. DOCUMENTED is
not REAL_VERIFIED. All account-specific coverage, accuracy and commercial permissions
remain NOT_VERIFIED until a separate approved probe. Prices are not purchase approval.

| Source / games | History, teams, players, rosters | Maps, H2H, BO, tournaments, IDs/time | Limits/cost/legal | Decision |
|---|---|---|---|---|
| PandaScore: all four | Fixtures include schedules/results/context; detailed historical statistics depend on plan. Team/player entities do not prove historical lineup membership | Per-game endpoints plan-dependent; stable provider IDs; BO and results must be validated per record; H2H derived only from verified finished series | Official pricing: free fixtures 1,000 requests/hour; historical from €400/game/month, 10,000/hour; listed stats plans non-betting use. Exact title/league/retention rights require agreement | Candidate catalogue for four games; no implied free detailed stats or permanent final selection |
| OpenDota: Dota 2 | Open replay-derived matches, player/team history; current-team flag is not roster-at-match-time. Missing parsed stats remain missing | Dota match ID is a game, not automatically a series. Preserve radiant/dire, series/league fields when present; never infer BO from game count | Official 2018 post says 50,000 free calls/month; current API-key page returned 403 to research tool. Current quota/price/license NOT_VERIFIED | Best low-cost Dota research candidate, with ID registry and field validation; PR #1 needs corrections before use |
| GRID: CS2/Dota 2 and Riot LoL/Valorant | Official game-server feeds, contracted coverage. Historical depth and roster granularity depend on granted feeds | Central Data/series state not interchangeable with public match APIs; exact GraphQL schema must come from authorized docs | Current plans page scopes products per agreement/custom quote. Do not rely on older broad free-access announcements | Strong licensed alternative; no invented schema or assumed account access |
| Riot Open Access powered by GRID: LoL/Valorant | Official page announces Central Data, Series State and Loopfeed; exact retained history/sample coverage untested | Series/game distinction and game-server events promising; keys/docs required for field-level contract | Page announces launch 12 Nov 2026; free non-commercial experimentation, delayed data, no betting; commercial custom pricing | Candidate for closed research ONLY if intended usage qualifies; public Premium requires separate rights |
| Riot developer APIs: LoL/Valorant | Player-match products and account APIs; not evidence of full professional tournament history | Riot game/PUUID identities differ from esports catalogue IDs; competitive league schedules/BO not guaranteed | Product registration, approved access/RSO where required; policy restricts gambling functionality; quotas depend on key | Supplemental player research with consent, not automatic pro-data replacement |
| FACEIT: CS2 | FACEIT-specific players, matches and statistics; not global professional CS2 coverage | Documented matches/stats/history and competitions; preserve FACEIT IDs, map scope and timestamps | API key; API license proprietary. Exact current request allowance and redistribution rights NOT_VERIFIED | Useful separate-domain dataset; must not merge ladder and pro records silently |
| Oracle's Elixir: LoL | Historical CSV candidate; current download page returned 403 during research | Game-level schema, coverage/corrections and license must be inspected before import | Current terms/availability NOT_VERIFIED; no download or training performed | Optional approved offline dataset after provenance/license manifest |
| Bayes Esports | Commercial esports-data candidate; public material not account-specific schema | Depth, roster/maps, IDs/series and coverage NOT_VERIFIED | Current quote/terms/limits NOT_VERIFIED; no purchase | Request documentation only if cheaper candidates fail quality/rights gates |
| Groq / Artemox | Language-model inference, not verified roster/H2H/results source | Generated numbers and quoted source names prove nothing | Model/account-specific pricing and rate limits; never send user secrets/PII; explicit budget required | Groq optional explanation only; remove Artemox as factual fallback |

## Recommended staged selection (inference, not a purchase)

- Dota 2: first validate OpenDota game history plus a separately licensed catalogue;
  require exact cross-provider team/series mapping. Current lineup is distinct from past lineup.
- CS2: compare granted PandaScore historical coverage with GRID; FACEIT only for its
  own domain. If free data cannot support map/roster features, abstain rather than fabricate.
- LoL/Valorant: assess Riot/GRID Open Access eligibility and delays first for research;
  PandaScore fixtures for catalogue if permitted. A commercial product needs different rights.
- No universal zero-cost supplier has been proven sufficient for four games. Start
  result-only baseline research per discipline; expose no calibrated probability until validation.

## Acceptance probe (NOT_RUN)

Owner approves source, purpose, key location and maximum attempts. Sample leagues,
IDs, dates, completed/unfinished games and roster changes; log only aggregates and
schema codes. Measure missing fields, contradictions, latency, duplicate IDs, history
depth, lineup effective dates, map granularity, BO and timezone correctness. Freeze a
licensed versioned dataset manifest before backtesting. Do not infer accuracy from HTTP 200.

## Primary sources

- [PandaScore pricing](https://www.pandascore.co/pricing), [plan reference](https://developers.pandascore.co/docs/plan-reference), [terms](https://www.pandascore.co/terms-and-condition).
- [OpenDota docs](https://docs.opendota.com/), [official historical quota announcement](https://blog.opendota.com/2018/04/17/changes-to-the-api/), [open-source ingestion](https://github.com/odota/core).
- [GRID plans](https://grid.gg/plans/), [Riot Open Access](https://grid.gg/riot-open-access/).
- [Riot LoL docs](https://developer.riotgames.com/docs/lol), [Valorant policy](https://developer.riotgames.com/docs/valorant).
- [FACEIT Data API](https://docs.faceit.com/api/data/), [Oracle's Elixir downloads](https://oracleselixir.com/tools/downloads).
- [Groq models/pricing](https://console.groq.com/docs/models), [project limits](https://console.groq.com/docs/projects).

No undocumented live endpoint is treated as established. Source-code licensing does
not automatically license provider datasets or onward redistribution.
