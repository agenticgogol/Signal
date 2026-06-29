# Project Brief: GenAI Analyst OS

## What this system does
A personal intelligence OS for staying at the frontier of GenAI and Agentic AI,
and turning that knowledge into published content. It watches the sources you
trust, ranks what matters, helps you understand it fast, and turns your POV
into polished Substack articles and LinkedIn posts.

Built first for personal use; architected from day one to be a multi-user
subscription product with Stripe billing.

## Target user
A GenAI practitioner or content creator (e.g. a developer, researcher, or
educator) who follows 10–30 GenAI blogs, newsletters, and sites. Overwhelmed
by information. Wants to publish consistently on Substack and LinkedIn but
spends too long reading and drafting. Values their own voice and POV —
does not want generic AI content.

## Core user journey
1. User onboards: pastes 5–10 source URLs, picks topic interests from 11
   GenAI subdomains, sets writing style (technical / practitioner / business /
   beginner-friendly).
2. Overnight: pg_cron triggers the crawler Edge Function at 02:00 UTC. It
   fetches RSS/HTML from all user sources, identifies new articles, calls
   Claude for TL;DR + topic tags + depth score, computes a blend score
   (0.35 recency + 0.45 relevance via pgvector + 0.20 popularity), writes
   to user_feed_items.
3. Morning: User opens the app and sees their ranked feed — article cards
   with TL;DR bullets, topic tags, depth badges. They like/dislike cards;
   topic weights update async.
4. Above the feed: 5 AI-generated content angles (Edge Function runs after
   crawl). Each shows: angle title, format (Substack/LinkedIn), source articles,
   hook sentence, rationale.
5. User clicks "Write this" on an angle, adds 2–3 POV bullet notes.
6. Claude streams a full draft (Substack: 800–1200 words; LinkedIn: 900–1200
   chars) in a TipTap editor. User edits and copies to publish.

## Agentic patterns needed
- Scheduled background agent: pg_cron is the orchestrator; crawler runs
  autonomously with no user trigger
- LLM-as-summariser: Claude generates TL;DR bullets + topic tags per article
- Preference learning loop: like/dislike writes to user_feedback; Edge Function
  updates topic_weights in user_profiles; next crawl uses updated weights for
  relevance scoring
- Structured output: 5 daily idea angle cards returned as JSON from Claude
- Streaming content generation: Vercel AI SDK + Claude streaming into TipTap

## Tools / agents needed
1. crawl_sources(user_id) → fetches RSS/HTML for all user sources, deduplicates
   against seen_articles, returns new article objects
2. summarise_article(text) → calls Claude, returns tldr_bullets[], topic_tags[],
   depth_score (1–5)
3. score_article(article, user_profile) → computes blend score using pgvector
   cosine similarity for relevance + recency decay + source tier
4. generate_daily_ideas(user_id, top_articles) → calls Claude, returns 5 angle
   JSON objects with title, format, hook, source_ids, rationale
5. generate_draft(angle, pov_bullets, articles, format) → streams Claude response
   via Vercel AI SDK; format-specific system prompts for Substack vs LinkedIn

## Tech stack
- Frontend: Next.js 14 (App Router), Tailwind CSS, TipTap editor
- Backend: Supabase (Postgres + pgvector + Auth + Storage + Edge Functions + pg_cron)
- Hosting: Vercel (frontend + API routes)
- AI: Anthropic claude-sonnet-4-6 via Vercel AI SDK
- Payments: Stripe (Free / Pro $12/mo)

## Frontend A (Feed + Ideas)
Main daily feed page: ranked article cards with TL;DR, like/dislike, filter bar.
Above the feed: 5 daily angle idea cards with "Write this" CTA. Sidebar shows
topic weight breakdown (how the user's preferences have evolved).

## Frontend B (Content Creation)
Create page: article selector + POV input area + streaming TipTap editor.
Character count live for LinkedIn. Drafts history page. Settings: source
management + topic interests + account/billing.

## Data / schema (Supabase)
Key tables: user_profiles (id, plan, style_seed, topic_weights jsonb,
stripe_customer_id), user_sources (user_id, url, rss_url, source_tier),
articles (url unique, full_text, tldr_bullets[], topic_tags[], depth_score,
embedding vector(1536)), user_feed_items (user_id, article_id, blend_score,
feed_date), user_feedback (user_id, article_id, signal like|dislike),
daily_ideas (user_id, idea_date, angle_title, format, source_article_ids[],
hook_sentence), drafts (user_id, format, pov_bullets[], content, updated_at).

## Monetization
Free: 5 source URLs, 20 articles/day, 3 drafts/month, 3 of 5 daily angles.
Pro ($12/mo): unlimited everything, full draft history, multi-article creation.
Stripe webhook updates user_profiles.plan on subscription events.

## Deploy target
Vercel (frontend + API routes). Supabase cloud (DB + Edge Functions).
No Docker needed — Vercel and Supabase both deploy from Git.

## MCP
No dedicated MCP server. The Supabase Edge Functions act as the backend agents.