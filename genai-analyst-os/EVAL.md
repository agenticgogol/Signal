# Evaluation Specification

Evals cover the three LLM-facing tools plus the two pure-logic tools with non-trivial behaviour. All run against `data/mock_articles.json` and `data/mock_user_profiles.json` with `MOCK_LLM=false` for golden tests (real API) and `MOCK_LLM=true` for CI structural tests.

---

## Golden Test Cases

### TC-01: Article Summarisation — Deep Technical Article

- **Input**: Full text of a 2,500-word article titled *"Implementing Speculative Decoding in a Production vLLM Cluster"* (stored in `data/mock_articles.json` as `article_id: "tc01"`)
- **Setup**: `MOCK_LLM=false`; `PipelineState` with `raw_articles = [mock_articles["tc01"]]`
- **Expected tool calls**: `summarise_article(article_text=<full text>, title=<title>)`
- **Expected output**:
  - `tldr_bullets`: array of 2–4 items, each ≤ 20 words, covering: what speculative decoding is, the production implementation approach, and the measured latency improvement
  - `topic_tags`: must include `"infrastructure"` and/or `"reasoning"`; must NOT include `"hardware"` or `"products"`
  - `depth_score`: must be 4 or 5
- **Failure signals**:
  - `depth_score` ≤ 3 (model undershooted a highly technical article)
  - `topic_tags` contains values outside the 11-item taxonomy
  - Any bullet longer than 25 words
  - Response is not valid JSON

---

### TC-02: Article Summarisation — News / Product Announcement

- **Input**: 300-word article titled *"Anthropic Launches Claude for Enterprise with SOC 2 Compliance"* (stored as `article_id: "tc02"`)
- **Setup**: `MOCK_LLM=false`; `PipelineState` with `raw_articles = [mock_articles["tc02"]]`
- **Expected tool calls**: `summarise_article(article_text=<text>, title=<title>)`
- **Expected output**:
  - `depth_score`: 1 or 2 (news announcement, no technical depth)
  - `topic_tags`: must include `"products"`; may include `"safety"` or `"infrastructure"`
  - `tldr_bullets`: 2 items sufficient; should mention enterprise, SOC 2, and pricing/availability
- **Failure signals**:
  - `depth_score` ≥ 4 (model inflated depth for a press release)
  - Bullets that assert technical claims not in the article (hallucination)
  - `topic_tags` includes `"research"` or `"fine-tuning"` (off-topic)

---

### TC-03: Daily Idea Generation — Practitioner Style

- **Input**: `top_articles` = 10 articles from `data/mock_articles.json` covering `agents` (4 articles), `evals` (3 articles), `rag` (2 articles), `products` (1 article); `style_seed = "practitioner"`
- **Setup**: `MOCK_LLM=false`; `PipelineState` with `feed_items` pre-populated, `style_seed = "practitioner"`
- **Expected tool calls**: `generate_daily_ideas(user_id=<id>, top_articles=<10 articles>, style_seed="practitioner")`
- **Expected output**:
  - Exactly 5 `IdeaAngle` objects
  - At least 2 angles tagged `format: "substack"` and at least 1 tagged `format: "linkedin"`
  - At least 3 angles reference `agents` or `evals` articles (reflecting their dominance in the input)
  - `angle_title` values: each must stake a specific position (e.g. *"Eval-driven development is the next TDD — most teams aren't there yet"*), not a generic label
  - `hook_sentence` for each: must be a standalone first sentence, not a description
  - All `source_article_ids` must be valid UUIDs from the provided article list
- **Failure signals**:
  - Fewer than 5 objects returned
  - Any `source_article_ids` value not in the input article list (hallucinated reference)
  - All 5 angles reference the same article
  - `angle_title` values are generic topic labels without a stated position
  - `rationale` is identical or near-identical across multiple angles

---

### TC-04: Draft Generation — Substack Format, Practitioner Style

- **Input**:
  - `angle`: `{ angle_title: "Why evals are the new unit tests — and most teams are failing them", format: "substack", hook_sentence: "Most teams discover regressions in prod, not in CI.", source_article_ids: ["tc01", "tc04", "tc07"] }`
  - `pov_bullets`: `["I've seen teams ship GPT-4 fine-tunes with zero eval harness — they discover regressions in prod", "The right mental model: evals are contracts, not scores"]`
  - `style_seed`: `"practitioner"`
- **Setup**: `MOCK_LLM=false`; source articles pre-loaded from `data/mock_articles.json`
- **Expected tool calls**: `generate_draft(angle=<above>, pov_bullets=<above>, source_articles=<3 articles>, format="substack", style_seed="practitioner")`
- **Expected output**:
  - Word count: 800–1200 words (count assembled stream)
  - Opening paragraph must contain or closely echo the hook sentence
  - Both POV concepts must appear as the author's own voice (not quoted, not bullet-listed)
  - At least one reference to a source article by natural citation (not `[1]`)
  - No title line in the output
  - No self-referential phrases ("As an AI...", "I've structured this as...", "In the practitioner style...")
- **Failure signals**:
  - Word count < 750 or > 1300 (outside acceptable tolerance)
  - POV bullets appear verbatim as a bulleted list (not integrated)
  - Article references use academic citation style `[1]` or are hallucinated (author/title not in source articles)
  - Output contains a title header line

---

### TC-05: Draft Generation — LinkedIn Format, Character Limit

- **Input**:
  - `angle`: `{ angle_title: "Stop calling it prompt engineering — it's interface design", format: "linkedin", hook_sentence: "The teams shipping reliable LLM products aren't better at prompting. They're better at interface design.", source_article_ids: ["tc03", "tc06"] }`
  - `pov_bullets`: `["Every brittle prompt is a missing schema or guardrail", "The best prompt engineers I know are thinking about failure modes, not magic words"]`
  - `style_seed`: `"practitioner"`
- **Setup**: `MOCK_LLM=false`
- **Expected tool calls**: `generate_draft(angle=<above>, pov_bullets=<above>, source_articles=<2 articles>, format="linkedin", style_seed="practitioner")`
- **Expected output**:
  - Total character count (including spaces): 900–1200 chars
  - Line 1 must be the hook sentence or a close variant (≤ 140 chars)
  - No markdown headers or bold/italic syntax
  - No hashtags
  - Final line is a question or clear call to action
- **Failure signals**:
  - Character count > 1200 (hard LinkedIn limit exceeded)
  - Character count < 600 (too short to be useful)
  - Output contains markdown formatting (`##`, `**`, `_`)
  - Output contains hashtags

---

## Evaluation Dimensions

Each test case is scored on four dimensions. Maximum score per test case: **6 points**.

### Correctness (0–2)
- **2**: All expected output criteria met exactly — correct schema, correct content, within length bounds
- **1**: Minor deviation in one criterion (e.g. depth_score off by 1, word count 5% outside range) that does not affect usability
- **0**: Any hallucinated reference, incorrect schema, or output that would be misleading or unusable

### Tool Use Efficiency (0–2)
- **2**: Exactly the expected tools called in the expected order; no redundant or unexpected calls
- **1**: Correct tools called but with a retry (one validation failure + successful retry is acceptable)
- **0**: Wrong tool called, tool called with incorrect params, or more than one retry needed

### Format Compliance (0–1)
- **1**: Output matches the required format exactly — valid JSON for TC-01–03; correct word/char count and structure for TC-04–05
- **0**: Any format violation (invalid JSON, wrong field names, incorrect count, title in draft output)

### Hallucination Check (0–1)
- **1**: No invented facts, citations, article titles, author names, or article IDs that were not in the input
- **0**: Any fabricated reference or claim not grounded in the provided input data

---

## Regression Checks

These must NEVER happen. Each is a hard failure regardless of score on other dimensions.

1. **`source_article_ids` contains a UUID not in the input article list** (TC-03, TC-04, TC-05): Claude inventing article references is a trust-destroying bug that causes the create page to reference non-existent content and fail silently at the DB JOIN.

2. **`topic_tags` contains a value outside the 11-item taxonomy** (TC-01, TC-02): An out-of-taxonomy tag breaks the `topic_weights` update logic in `update_feedback_and_weights`, which iterates over known tags. An unknown tag would silently be ignored in the recompute and cause drift between actual user interests and stored weights.

3. **Draft output exceeds 1200 characters for LinkedIn format** (TC-05): The LinkedIn character limit is a hard platform constraint. A draft over the limit cannot be posted without manual truncation, which breaks the core user promise ("copy and post"). This regression check runs on every CI pass with character count asserted as a hard assertion, not a warning.
