# Skill: validate-specs

Read the following files in full before running any checks:
- `AGENTS.md`
- `TOOLS.md`
- `STATE.md`
- `skills.md`
- `EVAL.md`
- `PROMPTS.md`

Then run all 7 checks below in sequence. Print PASS or FAIL for each with a brief explanation. At the end, write the full results to `knowledge/validation-report.md`.

---

## Check 1 — Every tool in TOOLS.md is referenced in at least one node in AGENTS.md

Extract the list of tool names defined in `TOOLS.md` (each `## tool_name` heading).
For each tool name, search `AGENTS.md` for a reference (either by name in the Action description or in the Skills Registry section).

Print per tool:
```
  ☑ crawl_sources       — referenced in node: crawler
  ☑ resolve_rss_url     — referenced in node: crawler
  ☒ [tool_name]         — NOT referenced in any node
```

**PASS** if all tools are referenced. **FAIL** if any tool has no node reference — it is either dead code or a missing node.

---

## Check 2 — Every STATE.md Postgres table is read or written by at least one node

Extract the list of tables from `STATE.md → Pipeline State (Postgres Tables)`.
For each table, check `AGENTS.md` node descriptions and `STATE.md → State Transitions` table to confirm at least one node reads or writes it.

Print per table:
```
  ☑ user_sources         — read by: crawler
  ☑ articles             — written by: summarise; read by: rank, ideas
  ☒ [table_name]         — NOT referenced by any node
```

**PASS** if all tables are referenced. **FAIL** if any table is orphaned.

---

## Check 3 — Every skill in skills.md uses at least one tool from TOOLS.md

Extract skill names from `skills.md` (each `## skill_name` heading).
For each skill, read its `**Tools used**` field and verify each listed tool exists in `TOOLS.md`.

Print per skill:
```
  ☑ daily_feed_curation     — tools: crawl_sources ✓, summarise_article ✓, embed_article ✓, score_article ✓
  ☑ preference_adaptation   — tools: update_topic_weights ✓
  ☒ [skill_name]            — lists tool "[name]" which does NOT exist in TOOLS.md
```

**PASS** if all tool references resolve. **FAIL** if any skill references a tool not in TOOLS.md (renamed, deleted, or typo).

---

## Check 4 — Every golden test case in EVAL.md exercises at least one tool

Extract test case names from `EVAL.md` (each `### TC-N:` heading).
For each test case, read its `**Expected tool calls**` field and verify each listed tool exists in `TOOLS.md`.

Print per test case:
```
  ☑ TC-01 — exercises: summarise_article ✓
  ☑ TC-03 — exercises: generate_daily_ideas ✓
  ☒ TC-[N] — lists tool "[name]" which does NOT exist in TOOLS.md
```

**PASS** if all tool references resolve. **FAIL** if any test case references a non-existent tool.

---

## Check 5 — PROMPTS.md covers all LLM-facing tools

Identify which tools in `TOOLS.md` make an LLM call (those whose **Side effects** field mentions "Anthropic API call" or similar).
For each such tool, verify that `PROMPTS.md` contains a dedicated prompt section for it.

LLM-facing tools to check: `summarise_article`, `generate_daily_ideas`, `generate_draft`.

Print:
```
  ☑ summarise_article    — Prompt 1 defined in PROMPTS.md
  ☑ generate_daily_ideas — Prompt 2 defined in PROMPTS.md
  ☑ generate_draft       — Prompt 3 defined in PROMPTS.md
  ☒ [tool_name]          — makes LLM calls but has no prompt in PROMPTS.md
```

**PASS** if all LLM-facing tools have a prompt. **FAIL** if any are missing.

---

## Check 6 — Temperature and max_tokens set for every LLM-facing tool

Verify that `PROMPTS.md → Cross-cutting Prompt Constraints` specifies both `temperature` and `max_tokens` for each LLM-facing tool.

Print:
```
  ☑ summarise_article    — temperature: 0, max_tokens: 300
  ☑ generate_daily_ideas — temperature: 0, max_tokens: 1500
  ☑ generate_draft       — temperature: 0.7, max_tokens: 2000 (substack) / 500 (linkedin)
  ☒ [tool_name]          — missing temperature or max_tokens setting
```

**PASS** if all settings present. **FAIL** if any LLM tool has an unspecified temperature or max_tokens.

---

## Check 7 — crawl_runs table present in STATE.md and referenced in AGENTS.md crawler node

This is a targeted check for the degraded-crawl detection pattern agreed in the spec review.

- Verify `crawl_runs` table exists in `STATE.md`
- Verify `crawl_runs` appears in `STATE.md → State Transitions` table
- Verify `AGENTS.md → crawler` node description references `crawl_runs` (INSERT on start, UPDATE on complete)

Print:
```
  ☑ crawl_runs in STATE.md tables        — found
  ☑ crawl_runs in State Transitions      — read by: —, written by: crawler
  ☑ crawl_runs in AGENTS.md crawler node — referenced in Action description
```

**PASS** if all three present. **FAIL** with specific missing item if any are absent.

---

## Print summary

After all 7 checks:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPEC VALIDATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Check 1 — Tool ↔ Node coverage:         PASS / FAIL
Check 2 — State table coverage:         PASS / FAIL
Check 3 — Skill ↔ Tool references:      PASS / FAIL
Check 4 — Eval ↔ Tool references:       PASS / FAIL
Check 5 — LLM tools have prompts:       PASS / FAIL
Check 6 — Temperature & max_tokens set: PASS / FAIL
Check 7 — crawl_runs wired correctly:   PASS / FAIL
───────────────────────────────────
Overall: [N/7 checks passed]
```

If any check FAILs, list the specific items to fix before proceeding to code generation.

---

## Write results

Write the full output (all check details + summary) to `knowledge/validation-report.md` with a timestamp header:

```markdown
# Spec Validation Report — [YYYY-MM-DD HH:MM UTC]

[full check output]
```

If `knowledge/validation-report.md` already exists, append the new report below the existing content with a horizontal rule separator (`---`).
