# Project Structure — GenAI Analyst OS

Two runtime environments: **Next.js on Vercel** (user-facing frontend + API routes) and **Supabase Edge Functions** (autonomous overnight pipeline). The `src/` Python layer is tooling-only — evals, local scripts, and mock-mode testing.

```
genai-analyst-os/
│
├── app/                              ← Next.js 14 App Router root
│   ├── layout.tsx                    ← Root layout: Supabase Auth provider, global styles
│   ├── page.tsx                      ← Root redirect → /feed
│   ├── feed/
│   │   └── page.tsx                  ← Daily feed: ranked article cards + 5 idea cards + sidebar
│   ├── create/
│   │   └── page.tsx                  ← Content creation: angle context + POV input + TipTap editor
│   ├── drafts/
│   │   └── page.tsx                  ← Draft history: paginated list, reopen in editor
│   ├── settings/
│   │   └── page.tsx                  ← Settings: source management, topic interests, billing
│   └── api/
│       ├── feed/
│       │   └── route.ts              ← GET /api/feed — return ranked user_feed_items for a date
│       ├── ideas/
│       │   └── route.ts              ← GET /api/ideas — return daily_ideas; set blurred flag server-side
│       ├── feedback/
│       │   └── route.ts              ← POST /api/feedback — record like/dislike, trigger topic_weights update
│       ├── sources/
│       │   └── route.ts              ← POST/DELETE /api/sources — add/remove user_sources, run RSS detection
│       ├── draft/
│       │   └── stream/
│       │       └── route.ts          ← POST /api/draft/stream — Vercel AI SDK streamText() to TipTap
│       ├── stripe/
│       │   └── webhook/
│       │       └── route.ts          ← POST /api/stripe/webhook — verify + handle subscription events
│       └── health/
│           └── route.ts              ← GET /api/health — uptime check
│
├── components/                       ← Shared React components (all client-safe, no DB access)
│   ├── feed/
│   │   ├── ArticleCard.tsx           ← Article card: TL;DR bullets, topic tags, depth badge, like/dislike
│   │   ├── IdeaCard.tsx              ← Angle idea card: title, format badge, hook sentence, source chips
│   │   ├── TopicWeightSidebar.tsx    ← Bar chart of user's current topic_weights jsonb
│   │   └── FeedFilters.tsx           ← Filter bar: topic tag filter, depth score filter, date picker
│   ├── create/
│   │   ├── TipTapEditor.tsx          ← TipTap rich-text editor with streaming text insertion support
│   │   ├── PovBulletInput.tsx        ← Structured input for 2–3 POV bullet notes
│   │   └── CharacterCounter.tsx      ← Live character counter for LinkedIn format (warn at 900, max 1200)
│   └── shared/
│       ├── PlanGate.tsx              ← Wrapper that enforces plan limits; renders upgrade prompt if exceeded
│       ├── BlurredAngle.tsx          ← Blurred idea card overlay for positions 4–5 on Free plan
│       └── UpgradeCTA.tsx            ← Upgrade to Pro call-to-action button + modal
│
├── lib/                              ← Pure utility modules (no React, imported by API routes + components)
│   ├── supabase.ts                   ← Supabase JS client factory (browser + server variants)
│   ├── anthropic.ts                  ← Anthropic SDK client + streamText wrapper for API routes
│   ├── scoring.ts                    ← Blend score formula: 0.35×recency + 0.45×cosine + 0.20×tier
│   ├── rss.ts                        ← RSS detection: <link rel=alternate> → path probes → article scrape
│   └── stripe.ts                     ← Stripe client, webhook signature verification, plan helpers
│
├── types/
│   ├── index.ts                      ← Shared TypeScript types: IdeaAngle, ArticleSummary, DraftFormat, etc.
│   └── database.ts                   ← Supabase-generated DB types (auto-updated via supabase gen types)
│
├── supabase/                         ← Supabase project: migrations, Edge Functions, seed data
│   ├── config.toml                   ← Supabase CLI project config (project ref, regions)
│   ├── migrations/
│   │   ├── 001_schema.sql            ← All tables: user_profiles, articles, user_feed_items, etc. + vector(384)
│   │   ├── 002_rls.sql               ← Row Level Security policies for all tables (user_id-scoped)
│   │   └── 003_cron.sql              ← pg_cron job: POST to /functions/v1/crawler at 02:00 UTC
│   ├── seed/
│   │   └── topic_taxonomy.sql        ← Insert 11 canonical GenAI subdomain tags (agents, evals, hardware, …)
│   └── functions/                    ← Deno Edge Functions (TypeScript)
│       ├── crawler/
│       │   ├── index.ts              ← Orchestrator: loop users → sources → fetch → deduplicate → fan-out
│       │   └── rss.ts                ← RSS fetch + parse (Deno-native fetch, no BeautifulSoup)
│       ├── summarise/
│       │   └── index.ts              ← Claude Haiku: tldr_bullets + topic_tags + depth_score + pgai.embed
│       ├── rank/
│       │   └── index.ts              ← Blend score SQL + INSERT user_feed_items ON CONFLICT DO NOTHING
│       ├── ideas/
│       │   ├── index.ts              ← Claude Sonnet structured output → 5 IdeaAngle rows per user
│       │   └── schema.ts             ← Zod schema for IdeaAngle structured output validation
│       ├── feedback/
│       │   └── index.ts              ← INSERT user_feedback + recompute + UPDATE topic_weights jsonb
│       └── stripe-webhook/
│           └── index.ts              ← Verify Stripe signature + idempotent plan UPDATE
│
├── src/                              ← Python tooling layer (NOT production; evals + local scripts only)
│   ├── __init__.py
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── crawl.py                  ← Python mirror of crawler logic for local testing
│   │   ├── summarise.py              ← Python mirror of summarise logic; uses LiteLLM cheap tier
│   │   ├── score.py                  ← Python blend score implementation for eval assertions
│   │   ├── ideas.py                  ← Python mirror of ideas logic; uses LiteLLM primary tier
│   │   └── draft.py                  ← Python mirror of draft streaming for eval harness
│   ├── llm/
│   │   ├── __init__.py
│   │   └── provider.py               ← LiteLLM wrapper: get_model(tier), call_llm(), stream_llm(), MOCK_LLM
│   └── evals/
│       ├── __init__.py
│       ├── eval_summarise.py          ← Assert: 2–4 bullets, tags in taxonomy, depth 1–5
│       ├── eval_ideas.py              ← Assert: exactly 5 IdeaAngle objects, all fields populated
│       └── eval_draft.py             ← Assert: word count (substack) / char count (linkedin), style match
│
├── knowledge/                        ← Eval results and human feedback artefacts (committed)
│   ├── .gitkeep
│   └── test-results.md               ← Running log of eval suite outcomes
│
├── data/                             ← Mock data for local eval runs (no real user data committed)
│   ├── mock_articles.json            ← Sample article objects with pre-filled summaries and embeddings
│   └── mock_user_profiles.json       ← Sample user_profiles rows with topic_weights and style_seed
│
├── .claude/
│   └── skills/
│       ├── run-as-agent.md           ← Skill: simulate overnight pipeline locally using Python tools
│       └── validate-specs.md         ← Skill: cross-check AGENTS.md / TOOLS.md against implementation
│
├── PROJECT_BRIEF.yaml                ← Source of truth for project metadata and stack decisions
├── requirements.md                   ← Functional and non-functional requirements
├── prd.md                            ← Full product requirements document
├── technical_design.md               ← Architecture, pipeline nodes, tool signatures, API endpoints
├── project_structure.md              ← This file
├── requirements.txt                  ← Python dependencies for src/ tooling layer
├── .env.example                      ← All required env vars with placeholder values
└── .gitignore                        ← Excludes .venv/, .env, __pycache__, *.pyc
```

## Runtime boundary summary

| Layer | Runtime | Deployed to | LLM access |
|-------|---------|-------------|------------|
| `app/` pages | React / Next.js | Vercel (CDN) | None (client only) |
| `app/api/` routes | Node.js / Next.js | Vercel Serverless | Anthropic SDK (draft stream only) |
| `supabase/functions/` | Deno | Supabase Edge | Anthropic SDK (summarise, ideas) |
| `supabase/migrations/` | SQL | Supabase Postgres | pgai (gte-small embed) |
| `src/` | Python 3.11 | Local only | LiteLLM / MOCK_LLM |
