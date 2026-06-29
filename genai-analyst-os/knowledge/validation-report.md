# Spec Validation Report — 2026-06-29

## Results after auto-fixes applied

| Check | Result | Notes |
|-------|--------|-------|
| 1 — Tool ↔ Node coverage | **PASS** | All 8 tools covered by prose in AGENTS.md nodes. Recommend adding explicit "Tools invoked" lines to nodes for future machine-readability. |
| 2 — State table coverage | **PASS** | All 9 tables read or written by at least one node. `crawl_runs` present in STATE.md with full field spec and status transitions. |
| 3 — Skill ↔ Tool references | **FIXED → PASS** | `daily_feed_curation` in skills.md referenced stale name `generate_embedding`; updated to `embed_article`. |
| 4 — Eval ↔ Tool references | **PASS** | All 5 test cases reference tools that exist in TOOLS.md. |
| 5 — LLM tools have prompts | **PASS** | All 3 LLM-facing tools have dedicated prompt sections in PROMPTS.md. |
| 6 — Temperature & max_tokens | **PASS** | All 3 LLM tools have explicit temperature and max_tokens in PROMPTS.md cross-cutting constraints. |
| 7 — crawl_runs wired correctly | **FIXED → PASS** | AGENTS.md crawler node Action now explicitly mentions INSERT on start and UPDATE on completion of `crawl_runs`. STATE.md and State Transitions were already correct. |

**Final: 7/7 PASS**

## Items fixed during this run

1. `skills.md` → `daily_feed_curation` Tools used: `generate_embedding` → `embed_article`
2. `AGENTS.md` → `crawler` node Action: added `crawl_runs` INSERT on start and UPDATE on complete

## Advisory (non-blocking)

- ~~AGENTS.md nodes use prose descriptions rather than exact tool function names.~~ **Resolved 2026-06-29**: All 6 nodes now have explicit `**Tools invoked:**` lines with exact tool names from TOOLS.md. Future grep-based validation checks will pass without semantic matching.
