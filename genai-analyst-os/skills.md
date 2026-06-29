# Agent Skills Registry

High-level capabilities the GenAI Analyst Pipeline exposes to users. Each skill is composed of one or more tools from `TOOLS.md`.

---

## daily_feed_curation

- **What it does**: Autonomously crawls all of the user's configured sources overnight, summarises new articles with AI-generated TL;DR bullets and topic tags, and delivers a ranked, personalised feed ready for the user each morning.
- **Tools used**: `crawl_sources` → `summarise_article` → `embed_article` → `score_article`
- **Example invocation**: Triggered automatically by pg_cron at 02:00 UTC — no user action required. User sees the output when they open the feed page.
- **Expected output format**: Ranked list of article cards, each with title, source, depth badge (1–5), topic tags (`[agents]`, `[evals]`), and 2–4 TL;DR bullet points. Ordered by `blend_score DESC`.

---

## preference_adaptation

- **What it does**: Learns the user's evolving topic interests from explicit like/dislike signals and updates their relevance weights so future feed rankings reflect their current priorities.
- **Tools used**: `update_topic_weights`
- **Example invocation**: User clicks 👍 on an article tagged `[agents]` or 👎 on one tagged `[hardware]`.
- **Expected output format**: Updated `topic_weights` jsonb (visible in the Topic Weight Sidebar as a bar chart). Change takes effect in the next overnight crawl's `score_article` computation.

---

## content_angle_generation

- **What it does**: Analyses the day's top-ranked articles and generates five publishing-ready content angle ideas tailored to the user's writing style, each with a hook sentence, format recommendation, and rationale.
- **Tools used**: `generate_daily_ideas`
- **Example invocation**: Runs automatically after feed ranking completes each night. Displayed above the feed as idea cards. Example output card: *"Why evals are the new unit tests — Substack — 'Most teams discover regressions in prod, not in CI.'"*
- **Expected output format**: 5 idea cards, each with: angle title, format badge (Substack / LinkedIn), hook sentence, 2–3 linked source article chips, rationale paragraph. Cards at positions 4–5 are blurred for Free plan users.

---

## draft_generation

- **What it does**: Given a selected angle and the user's POV bullet notes, streams a complete, voice-matched content draft — a 800–1200 word Substack post or a ≤1200-character LinkedIn post — directly into the TipTap editor.
- **Tools used**: `generate_draft`
- **Example invocation**: User selects an idea card, types two POV notes, clicks "Write this." Draft streams token-by-token into the editor within 2 seconds of clicking.
- **Expected output format**: Streaming rich text in TipTap. Substack: ~1000 words with intro hook, 3 structured sections, conclusion. LinkedIn: single-post format, punchy hook, 3–5 short paragraphs, CTA. Saved to `drafts` table on completion.

---

## rss_source_discovery

- **What it does**: Automatically discovers the RSS or Atom feed URL for any site URL the user pastes in, using a cascade of detection strategies — no manual feed URL entry required.
- **Tools used**: `resolve_rss_url`
- **Example invocation**: User adds `https://simonwillison.net` in Settings → Sources. System resolves it to `https://simonwillison.net/atom/everything/` automatically.
- **Expected output format**: Resolved `rss_url` stored in `user_sources` and displayed next to the source URL in Settings. If resolution fails, a "couldn't find feed — try pasting the RSS URL directly" inline error.

---

## plan_enforcement

- **What it does**: Transparently enforces Free vs Pro plan limits at every gate — source count, daily article cap, monthly draft quota, and angle visibility — while surfacing contextual upgrade prompts rather than silent failures.
- **Tools used**: none (SQL + API route middleware); reads `user_profiles.plan` and `is_admin`
- **Example invocation**: Free user tries to add a 6th source in Settings, or tries to generate a 4th draft in the current month, or clicks a blurred angle card.
- **Expected output format**: Inline gate UI: for blurred angles, a blurred card overlay with "Upgrade to Pro to unlock" CTA. For hard limits (source/draft count), an inline banner with usage status (`3/3 drafts used this month`) and a Pro upgrade button.

---

## eval_harness

- **What it does**: Runs each pipeline tool in isolation against fixture data, asserting structural and semantic correctness of outputs — used for CI and pre-deployment validation without consuming API credits.
- **Tools used**: All tools in `TOOLS.md` (via `MOCK_LLM=true`)
- **Example invocation**: `python -m pytest src/evals/` — runs `eval_summarise`, `eval_ideas`, `eval_draft` against `data/mock_articles.json`.
- **Input contract**: Each eval function accepts a `PipelineState` dataclass instance (defined in `STATE.md`) pre-populated with the fixture data relevant to that tool. The eval populates only the fields the tool under test reads; all other fields stay at their defaults. Example: `eval_summarise` populates `state.raw_articles` from `mock_articles.json` and asserts on `state.summaries` after calling `summarise_article()`.
- **Output contract**: Each eval function returns a `ScoredTrace` dataclass:
  ```python
  @dataclass
  class ScoredTrace:
      tool: str              # tool name being evaluated
      passed: bool           # True if all assertions pass
      assertions: list[str]  # human-readable assertion descriptions
      failures: list[str]    # descriptions of any failed assertions (empty if passed)
      latency_ms: float      # wall-clock time of the tool call
      mock_mode: bool        # always True in CI; False means real API was used
  ```
  Pytest collects `ScoredTrace` objects and appends a summary row to `knowledge/test-results.md` on each run.
- **Expected output format**: Pytest pass/fail per assertion plus `knowledge/test-results.md` append with date, tool, passed count, and any failures.
