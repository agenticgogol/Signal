# Skill: run-as-agent

You are now acting as the **GenAI Analyst Pipeline** as defined in `AGENTS.md`.

This is not a ReAct agent with a reasoning loop — it is a directed pipeline of 6 nodes executed in sequence. Simulate the pipeline by walking through each node in order, printing your reasoning and tool calls at each step.

---

## Step 0 — Load context

Read the following files before starting the simulation:
- `AGENTS.md` — node responsibilities and decision rules
- `TOOLS.md` — tool signatures and mock return values
- `EVAL.md` — golden test cases for default inputs
- `data/mock_articles.json` — fixture articles
- `data/mock_user_profiles.json` — fixture user profile

Set `MOCK_LLM=true` for this simulation. All tool calls return their mock values from TOOLS.md.

---

## Step 1 — Get test input

Ask the user:
> "Which test case should I simulate? Enter TC-01 through TC-05 (from EVAL.md), or describe a custom scenario. Press Enter to use TC-03 (Daily Idea Generation — Practitioner Style) as the default."

If the user provides no input or presses Enter, use **TC-03** as the default:
- `user_id`: `"mock-user-01"`
- `style_seed`: `"practitioner"`
- `top_articles`: 10 articles from `data/mock_articles.json` (use all available mock articles)
- Pipeline stage to simulate: full overnight pipeline (crawler → summarise → rank → ideas)

For TC-04 or TC-05 (draft generation), simulate only the `generate_draft` tool call — the overnight pipeline is assumed to have already run.

---

## Step 2 — Simulate the pipeline

For each node that applies to the chosen test case, print the following blocks in order:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NODE: [node_name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THINKING: [1–3 sentences: what this node needs to do, what decision rule applies]

TOOL CALL: tool_name({
  param1: value1,
  param2: value2
})

TOOL RESULT (mock):
[paste the mock return value from TOOLS.md for this tool]

DECISION: [which decision rule from AGENTS.md applies; what happens next]

STATE WRITTEN: [which Postgres table/field this node writes, and with what value]
```

Apply the decision rules from `AGENTS.md → Decision Rules` at each step. If a rule causes a node to be skipped, print:

```
NODE: [node_name] — SKIPPED
REASON: [which decision rule caused the skip]
```

---

## Mock return values (from TOOLS.md)

Use these exact mock values for each tool call:

| Tool | Mock return |
|------|-------------|
| `crawl_sources` | 3 `RawArticle` objects from `data/mock_articles.json` |
| `resolve_rss_url` | `{ rss_url: "https://example.com/feed", method: "path_probe" }` |
| `summarise_article` | `{ tldr_bullets: ["Mock bullet 1", "Mock bullet 2"], topic_tags: ["agents"], depth_score: 3 }` |
| `embed_article` | Array of 384 zeros — SQL call inside INSERT transaction, no HTTP |
| `score_article` | `0.75` |
| `generate_daily_ideas` | 5 hardcoded `IdeaAngle` objects (load from `data/mock_user_profiles.json` if present, otherwise generate plausible mock objects with `position` 1–5) |
| `generate_draft` | Yields 5 sentences as a stream: `"The teams shipping reliable LLM products aren't better at prompting. They're better at interface design. Every brittle prompt is a missing schema or guardrail. The best practitioners think about failure modes, not magic words. Start with the contract, not the call."` |
| `update_topic_weights` | Input weights returned unchanged |

---

## Step 3 — Evaluate output

After completing the pipeline simulation, evaluate the result against the EVAL.md criteria for the chosen test case:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVALUATION: TC-[N] — [name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Correctness (0–2):         [score] — [reason]
Tool Use Efficiency (0–2): [score] — [reason]
Format Compliance (0–1):   [score] — [reason]
Hallucination Check (0–1): [score] — [reason]
───────────────────────────────────────
TOTAL: [score]/6

REGRESSION CHECKS:
☑ / ☒  source_article_ids only reference input articles
☑ / ☒  topic_tags within 11-item taxonomy
☑ / ☒  LinkedIn draft ≤ 1200 characters (if applicable)
```

---

## Step 4 — Write log entry

Append the following structured entry to `knowledge/test-results.md`:

```markdown
## [YYYY-MM-DD HH:MM UTC] — TC-[N]: [test case name]

| Dimension | Score |
|-----------|-------|
| Correctness | [0–2] |
| Tool Use Efficiency | [0–2] |
| Format Compliance | [0–1] |
| Hallucination Check | [0–1] |
| **Total** | **[0–6]** |

**Mock mode:** true
**Nodes executed:** [list]
**Nodes skipped:** [list with reason]
**Regression checks:** [PASS/FAIL for each]
**Notes:** [any observations about prompt quality, decision rule behaviour, or edge cases]
```

---

Print: `SIMULATION COMPLETE. Check knowledge/test-results.md for log.`
