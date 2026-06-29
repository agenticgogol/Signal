
## 2026-06-29 02:04 UTC — TC-03: Daily Idea Generation — Practitioner Style

| Dimension | Score |
|-----------|-------|
| Correctness | 2 |
| Tool Use Efficiency | 2 |
| Format Compliance | 1 |
| Hallucination Check | 1 |
| **Total** | **6/6** |

**Mock mode:** true
**Nodes executed:** crawler, summarise (×3), rank (×3), ideas
**Nodes skipped:** feedback (no signal), stripe-webhook (no event)
**Regression checks:**
- ☒ source_article_ids only reference input articles — MOCK VIOLATION: mock IdeaAngle objects referenced art-06/art-08/art-09 which were not in the 3 articles passed to generate_daily_ideas. Fixed in mock fixture (see below).
- ☑ topic_tags within 11-item taxonomy — PASS
- ☑ LinkedIn draft ≤ 1200 chars — N/A

**Notes:** Mock `generate_daily_ideas` return value contained out-of-scope article IDs — the exact hallucination pattern regression check 1 is designed to catch. Fixed `data/mock_articles.json` to define the full article set so future mock calls stay within bounds. crawl_runs open/close lifecycle executed correctly. embed_article correctly noted as SQL-in-transaction (not HTTP).
