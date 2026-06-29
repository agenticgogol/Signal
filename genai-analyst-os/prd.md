# Product Requirements Document — GenAI Analyst OS

---

## Problem Statement

GenAI practitioners who follow 10–30 sources face an information overload problem that no simple tool currently solves well: RSS readers surface everything equally, newsletter digests lack personalisation, and generic AI summarisers have no memory of what the user cares about or how they write. The result is that high-signal content gets buried, and turning any of it into published writing requires hours of manual reading, note-taking, and drafting. An agentic approach is essential here because the value chain has four distinct autonomous steps — crawl, summarise, rank, and generate ideas — each of which must happen overnight without user involvement, each feeding the next with structured outputs, and each improving over time through a feedback loop. A single LLM call cannot orchestrate a pipeline that runs on a schedule, learns from behaviour, and adapts relevance weights across crawls; a traditional application cannot generate personalised angle ideas or voice-matched drafts. The system needs persistent state, scheduled autonomy, streaming generation, and a preference learning loop working together — the defining characteristics of an agentic architecture.

---

## User Personas

### Persona 1 — The Practitioner Publisher
**Name:** Arjun, 34  
**Role:** Senior ML Engineer at a mid-size SaaS company  
**Technical level:** High — reads research papers, follows model release notes, writes code  
**Primary goal:** Publish one Substack post per week that establishes his POV on a specific GenAI development, without spending more than 30 minutes on it  
**Key frustration:** He already knows what he thinks; the bottleneck is finding the three relevant articles that support his angle and then writing a clean 1,000-word piece around his notes

### Persona 2 — The Educator Curator
**Name:** Priya, 29  
**Role:** Independent AI educator and LinkedIn creator (12k followers)  
**Technical level:** Medium — understands concepts deeply but does not write production code  
**Primary goal:** Post 4–5 times per week on LinkedIn with practitioner-level takes that cut through hype, staying ahead of her audience  
**Key frustration:** She reads widely but struggles to prioritise — everything feels important in the moment, and her LinkedIn drafts take 45 minutes each because she keeps second-guessing her hook

### Persona 3 — The Researcher in a Hurry
**Name:** David, 41  
**Role:** AI Research Lead at a consultancy, advises enterprise clients  
**Technical level:** Very high — tracks arXiv, model cards, and vendor blogs simultaneously  
**Primary goal:** Stay current across all GenAI subdomains with minimal reading time, and occasionally publish long-form Substack pieces for business audiences  
**Key frustration:** The signal-to-noise ratio in his RSS reader is terrible; he needs depth-scored articles (not just recency) filtered to his current client engagements

---

## Feature List

### P0 — Must Have (Launch Blockers)

- **Source onboarding**: Accept 5–10 URLs, auto-detect RSS, store in `user_sources`
- **Scheduled crawler**: pg_cron at 02:00 UTC fetches all user sources, deduplicates, writes new articles
- **Article summarisation**: Claude (Haiku tier) produces `tldr_bullets[]`, `topic_tags[]`, `depth_score` per article
- **Embedding generation**: `pgai.embed('gte-small', text)` generates `vector(384)` per article for relevance scoring
- **Feed ranking**: Blend score (`0.35 recency + 0.45 pgvector cosine + 0.20 source tier`) ranks articles per user
- **Feed UI**: Ranked article cards with TL;DR bullets, topic tags, depth badges, like/dislike controls
- **Preference learning loop**: Like/dislike updates `topic_weights`; next crawl uses updated weights
- **Daily idea generation**: Post-crawl Edge Function calls Claude (Sonnet tier) and produces 5 angle cards
- **Draft generation**: Claude streams a full Substack (800–1200 words) or LinkedIn (≤1200 chars) draft into TipTap
- **Supabase Auth**: Email/password sign-up and sign-in; RLS on all tables
- **Free plan enforcement**: 5 sources, 20 articles/day, 3 drafts/month, angles 4–5 blurred with upgrade CTA
- **Admin bypass**: `is_admin=true` on `user_profiles` shows all 5 angles unblurred regardless of plan

### P1 — Should Have (Launch Goal)

- **Stripe billing**: Free / Pro ($12/mo) plans; webhook updates `user_profiles.plan`
- **Draft history**: Paginated list of all past drafts, filterable by format; reopen any draft in TipTap
- **Live LinkedIn character count**: Real-time counter in TipTap, warning at 900 chars
- **Topic weight sidebar**: Visual breakdown of how the user's topic preferences have evolved over time
- **POV bullet input**: Structured input area for 2–3 POV notes before draft generation
- **Settings page**: Source management (add/remove/reorder), topic interest picker, writing style selector
- **Source tier system**: Manual or heuristic tier rating for sources (affects blend score)
- **Multi-article draft creation**: Select multiple source articles to ground a single draft

### P2 — Nice to Have (Post-Launch)

- **Email digest**: Daily email summarising top 5 articles and today's angle ideas
- **Draft revision with Claude**: "Rewrite this section" prompt within TipTap, preserving voice
- **Angle history**: Archive of all previous daily idea cards, searchable by topic
- **Source discovery**: Suggest new sources based on current `topic_weights` and known high-quality blogs
- **Team / shared workspace**: Multiple users sharing a source list and feed (multi-seat Pro)
- **Export to Notion / Ghost**: One-click push of a finished draft to a connected CMS

---

## System Behaviour Narrative

**Morning: The ranked feed.** Utsab opens the app at 8am. Overnight, the pg_cron job ran at 02:00 UTC: it fetched RSS from his 8 sources, found 34 new articles, called Claude Haiku to summarise each one and assign topic tags and a depth score, then generated `vector(384)` embeddings via `gte-small`. The feed ranking Edge Function computed a blend score per article — weighting recency, his current `topic_weights` (heavy on "agents" and "evals", light on "hardware"), and source tier — and populated `user_feed_items`. When the page loads, Utsab sees 20 ranked article cards with 2–3 TL;DR bullets, topic tags like `[agents] [evals]`, and a depth badge (1–5). Above the feed, 5 daily idea cards sit in a horizontal row — each showing an angle title, format badge (Substack or LinkedIn), a hook sentence, and the source articles that ground it. He quickly likes 3 cards (agents content, high depth) and dismisses 2 (hardware news). Those signals fire an async Edge Function that updates his `topic_weights` jsonb — tomorrow's feed will rank agent content even higher.

**Mid-morning: Selecting an angle.** One idea card catches his eye: *"Why evals are the new unit tests — and most teams are failing them."* Format: Substack. He clicks "Write this." The create page opens with the angle's context pre-loaded: hook sentence, rationale, and the 3 linked source articles summarised. He reads the TL;DR bullets of each article, then types two POV notes: *"I've seen teams ship GPT-4 fine-tunes with zero eval harness — they discover regressions in prod"* and *"The right mental model: evals are contracts, not scores."* He hits Generate.

**Streaming draft and editing.** Within 1.5 seconds the TipTap editor starts filling with text — Claude streaming a 1,050-word Substack draft structured around his two POV bullets, grounded in the source articles, written in his "practitioner" style seed. He watches the draft build, annotates two paragraphs he wants to change, edits the intro hook to sharpen it, and copies the final text to his Substack draft. The completed draft is automatically saved to `drafts` with his `user_id`, format, and a timestamp. Next week, he can pull it back up from the draft history page, compare it against a new angle on the same topic, or use it as a style reference.

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Feed relevance (user-rated) | ≥ 70% of articles in top-10 rated "relevant" by user after 7 days of feedback | Like rate on top-10 feed items after preference loop has run ≥ 3 times |
| Draft acceptance rate | ≥ 60% of generated drafts copied or published without a full rewrite | Track `drafts.status` field; user marks draft as "used" or Stripe cohort analysis |
| Crawler reliability | ≥ 95% of scheduled crawls complete successfully within 10 minutes | pg_cron job success logs in Supabase; alert if `user_feed_items` not updated by 04:00 UTC |
| Streaming first-token latency | p95 ≤ 2 seconds from "Generate" click to first token in TipTap | Client-side timing logged to Supabase `analytics_events` table |
| Free → Pro conversion | ≥ 8% of Free users convert within 30 days | Stripe dashboard + `user_profiles.plan` change timestamps |

---

## Agentic Design Decisions

**Scheduled background agent (pg_cron crawler at 02:00 UTC)**
The crawl must be fully autonomous because users will not manually trigger it — the value of the product is that the feed is ready when they wake up. pg_cron running inside Supabase is the right orchestrator because it eliminates an external scheduler, keeps all state in one system, and the Edge Function it calls has native access to the Postgres database for deduplication and writes.

**LLM-as-summariser (Claude Haiku per article)**
Generating TL;DR bullets and topic tags at crawl time — not at feed-load time — means the expensive LLM call is amortised across all users who see the article, and the feed page loads in under 1.5 seconds from pre-computed data. Haiku is the correct tier choice here: the summarisation task is well-defined and the volume is high (up to 200 articles per crawl), keeping per-user daily LLM cost within the $0.05 guardrail.

**Preference learning loop (like/dislike → topic_weights → next crawl)**
Explicit feedback signals (likes/dislikes) are used rather than implicit signals (click-through, dwell time) because the user base is small and behavioural data is sparse in the early days. Writing preference updates to `topic_weights` as a jsonb column on `user_profiles` means the relevance scoring SQL query can read them directly in the next crawl's blend score computation — no separate recommendation service needed.

**Structured output (5 daily idea angle cards as JSON)**
Returning angle cards as validated JSON objects (not free-text) lets the frontend render each field — title, format badge, hook sentence, source chips — independently, and lets the create page pre-populate the draft context without any additional parsing. Claude's structured output mode with a Zod schema enforces the contract and eliminates prompt injection risk in the angle data.

**Streaming content generation (Vercel AI SDK + Claude into TipTap)**
Draft generation is the highest-latency operation in the system (800–1200 words at Sonnet speed). Streaming is essential for perceived responsiveness — users see words appearing within 1.5 seconds rather than waiting 8–12 seconds for the full response. The Vercel AI SDK's `useChat`/`streamText` primitives handle backpressure and reconnection transparently, and TipTap's transaction API accepts incremental text insertions without re-rendering the full document.

---

## Data Model

### `user_profiles`
| Field | Type | Notes |
|-------|------|-------|
| `id` | `uuid` PK | = Supabase Auth `auth.users.id` |
| `plan` | `text` | `free` \| `pro` |
| `is_admin` | `boolean` | Default `false`; bypasses angle blur and all plan limits |
| `style_seed` | `text` | `technical` \| `practitioner` \| `business` \| `beginner-friendly` |
| `topic_weights` | `jsonb` | `{ "agents": 0.8, "evals": 0.7, "hardware": 0.2, … }` (11 subdomains) |
| `stripe_customer_id` | `text` | Nullable; set on first Stripe checkout |
| `created_at` | `timestamptz` | |

### `user_sources`
| Field | Type | Notes |
|-------|------|-------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `user_profiles` | |
| `url` | `text` | Original URL entered by user |
| `rss_url` | `text` | Resolved RSS/Atom feed URL (cached after first detection) |
| `source_tier` | `integer` | 1–3; affects blend score weight |
| `created_at` | `timestamptz` | |

### `articles`
| Field | Type | Notes |
|-------|------|-------|
| `id` | `uuid` PK | |
| `url` | `text` UNIQUE | Deduplication key |
| `source_id` | `uuid` FK → `user_sources` | |
| `title` | `text` | |
| `full_text` | `text` | Raw article body |
| `tldr_bullets` | `text[]` | 2–4 bullets from Claude Haiku |
| `topic_tags` | `text[]` | From Claude Haiku; values from 11 subdomain taxonomy |
| `depth_score` | `integer` | 1–5 from Claude Haiku |
| `embedding` | `vector(384)` | From `pgai.embed('gte-small', full_text)` |
| `published_at` | `timestamptz` | From RSS feed |
| `created_at` | `timestamptz` | When first ingested |

### `user_feed_items`
| Field | Type | Notes |
|-------|------|-------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `user_profiles` | |
| `article_id` | `uuid` FK → `articles` | |
| `blend_score` | `float` | Computed: `0.35×recency + 0.45×cosine_sim + 0.20×source_tier` |
| `feed_date` | `date` | Date of the crawl that surfaced this item |

**Constraint:** `UNIQUE (user_id, article_id, feed_date)` — enforced at the Postgres level, not application level. Crawler upsert must use `ON CONFLICT (user_id, article_id, feed_date) DO NOTHING`. Rationale: a pg_cron hiccup, manual re-run, or Supabase cold-start retry can trigger the crawler twice in the same UTC day; without this constraint the duplicate rows are invisible to the application and surface as repeated article cards to the user.

### `user_feedback`
| Field | Type | Notes |
|-------|------|-------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `user_profiles` | |
| `article_id` | `uuid` FK → `articles` | |
| `signal` | `text` | `like` \| `dislike` |
| `created_at` | `timestamptz` | |

### `daily_ideas`
| Field | Type | Notes |
|-------|------|-------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `user_profiles` | |
| `idea_date` | `date` | Date ideas were generated |
| `angle_title` | `text` | |
| `format` | `text` | `substack` \| `linkedin` |
| `hook_sentence` | `text` | |
| `source_article_ids` | `uuid[]` | FK array → `articles` |
| `rationale` | `text` | Why this angle was surfaced |
| `position` | `integer` | 1–5; positions 4–5 blurred for Free plan non-admins |

### `drafts`
| Field | Type | Notes |
|-------|------|-------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `user_profiles` | |
| `idea_id` | `uuid` FK → `daily_ideas` | Nullable (draft may not be tied to an idea) |
| `format` | `text` | `substack` \| `linkedin` |
| `pov_bullets` | `text[]` | User-supplied POV notes used as generation context |
| `content` | `text` | Final draft text |
| `updated_at` | `timestamptz` | |
| `created_at` | `timestamptz` | |
