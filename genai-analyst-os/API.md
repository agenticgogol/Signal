# API Specification

All endpoints are Next.js 14 App Router Route Handlers under `app/api/`. All authenticated endpoints require a Supabase JWT in the `Authorization: Bearer <token>` header. The Supabase client verifies the JWT and enforces Row Level Security — no endpoint bypasses RLS.

---

## GET /api/health

No authentication required.

**Response `200 OK`:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-29T08:00:00Z",
  "provider": "anthropic",
  "mock": false
}
```

`mock` is `true` when `MOCK_LLM=true` in the server environment.

---

## GET /api/feed

Returns the user's ranked feed items for a given date.

**Auth:** Required  
**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `date` | `string` (ISO date) | today (UTC) | Feed date to fetch |
| `limit` | `integer` | `20` | Max items to return |
| `offset` | `integer` | `0` | Pagination offset |

**Response `200 OK`:**
```json
{
  "items": [
    {
      "feed_item_id": "uuid",
      "blend_score": 0.87,
      "feed_date": "2026-06-29",
      "article": {
        "id": "uuid",
        "url": "https://example.com/article",
        "title": "string",
        "tldr_bullets": ["string", "string"],
        "topic_tags": ["agents", "evals"],
        "depth_score": 4,
        "published_at": "2026-06-28T14:00:00Z",
        "source": {
          "id": "uuid",
          "url": "https://example.com",
          "source_tier": 2
        }
      }
    }
  ],
  "total": 34,
  "date": "2026-06-29"
}
```

**Error responses:**
```json
// 401 — missing or invalid JWT
{ "error": "unauthorized" }

// 404 — no feed computed for this date yet (crawl hasn't run)
{ "error": "no_feed_for_date", "date": "2026-06-29" }
```

---

## GET /api/ideas

Returns the user's daily idea cards. Sets `blurred: true` server-side for positions 4–5 on Free plan.

**Auth:** Required  
**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `date` | `string` (ISO date) | today (UTC) | Idea generation date |
| `format` | `"substack" \| "linkedin"` | omit for all | Filter ideas by format; any other value returns 400 |

**Response `200 OK`:**
```json
{
  "ideas": [
    {
      "id": "uuid",
      "position": 1,
      "angle_title": "string",
      "format": "substack",
      "hook_sentence": "string",
      "rationale": "string",
      "blurred": false,
      "source_articles": [
        {
          "id": "uuid",
          "title": "string",
          "topic_tags": ["agents"]
        }
      ]
    },
    {
      "id": "uuid",
      "position": 4,
      "angle_title": "Why most RAG pipelines fail in production",
      "format": "substack",
      "hook_sentence": "",
      "rationale": "",
      "blurred": true,
      "source_articles": []
    }
  ],
  "date": "2026-06-29",
  "plan": "free"
}
```

**Blur rule (server-side):** If `user_profiles.plan = 'free' AND user_profiles.is_admin = false`, ideas with `position > 3` are returned with:
- `angle_title`: **returned as-is** — the title is visible to tease the content and motivate upgrade
- `hook_sentence`: set to `""` — redacted; the hook is the money line that Free users can't see
- `rationale`: set to `""` — redacted
- `source_articles`: set to `[]` — redacted
- `blurred: true`

The frontend renders a blur overlay over the body of the card; the title remains legible above it. The frontend never receives the actual `hook_sentence` or `rationale` for blurred cards — they are stripped server-side, not just visually hidden.

**Error responses:**
```json
// 400 — format query param provided but not a valid value
{ "error": "invalid_format", "detail": "format must be 'substack' or 'linkedin' if provided" }

// 404 — ideas not yet generated for this date
{ "error": "no_ideas_for_date", "date": "2026-06-29" }
```

**Note:** The `format` query param is optional — omit it to return all 5 ideas regardless of format. If provided, it filters the returned ideas to the specified format. Any value outside `['substack', 'linkedin']` is a hard 400 — fail loud at the boundary rather than silently returning an empty array that the frontend misinterprets as "no ideas today".

---

## POST /api/feedback

Records a like or dislike signal and triggers an async `topic_weights` update.

**Auth:** Required  
**Request body:**
```json
{
  "article_id": "uuid",
  "signal": "like" | "dislike"
}
```

**Validation:**
- `article_id` must be a valid UUID and exist in `articles` table
- `signal` must be exactly `"like"` or `"dislike"`

**Response `200 OK`:**
```json
{
  "ok": true,
  "updated_weights": {
    "agents": 0.82,
    "evals": 0.71,
    "fine-tuning": 0.40,
    "rag": 0.35,
    "multimodal": 0.20,
    "reasoning": 0.60,
    "infrastructure": 0.45,
    "safety": 0.30,
    "hardware": 0.15,
    "products": 0.25,
    "research": 0.55
  }
}
```

**Error responses:**
```json
// 400 — invalid input
{ "error": "invalid_input", "detail": "signal must be 'like' or 'dislike'" }

// 404 — article not found
{ "error": "article_not_found", "article_id": "uuid" }

// 500 — DB transaction failed (both feedback insert and weights update rolled back)
{ "error": "feedback_failed", "detail": "transaction rolled back" }
```

**Implementation note:** This route calls `supabase.rpc('update_feedback_and_weights', {...})` — a single Postgres function that atomically writes both `user_feedback` and `user_profiles.topic_weights`. See `TOOLS.md → update_topic_weights` for the required pattern.

---

## POST /api/sources

Adds a new source URL for the authenticated user, with automatic RSS detection.

**Auth:** Required  
**Request body:**
```json
{ "url": "https://simonwillison.net" }
```

**Response `201 Created`:**
```json
{
  "id": "uuid",
  "url": "https://simonwillison.net",
  "rss_url": "https://simonwillison.net/atom/everything/",
  "rss_detection_method": "link_tag" | "path_probe" | "article_scrape" | "not_found",
  "source_tier": 2,
  "created_at": "2026-06-29T08:00:00Z"
}
```

**Error responses:**
```json
// 400 — invalid URL
{ "error": "invalid_url", "detail": "URL must include scheme (https://)" }

// 409 — source already added by this user
{ "error": "source_exists", "source_id": "uuid" }

// 403 — Free plan source limit reached
{
  "error": "plan_limit_exceeded",
  "limit": 5,
  "current": 5,
  "plan": "free",
  "upgrade_url": "/settings?upgrade=true"
}
```

---

## DELETE /api/sources/[id]

Removes a source from the user's list. Does not delete articles already ingested from that source.

**Auth:** Required  
**Response `204 No Content`** (no body)

**Error responses:**
```json
// 404 — source not found or belongs to different user (RLS prevents cross-user access)
{ "error": "source_not_found" }
```

---

## POST /api/draft/stream

Streams a Claude Sonnet draft into the client. Uses Vercel AI SDK `streamText()`.

**Auth:** Required  
**Request body:**
```json
{
  "idea_id": "uuid",
  "pov_bullets": ["string", "string"],
  "format": "substack" | "linkedin"
}
```

**Validation:**
- `idea_id` must exist in `daily_ideas` and belong to the authenticated user
- `pov_bullets`: 1–3 items, each ≤ 280 characters
- `format` must match `daily_ideas.format` for the given `idea_id`

**Response:** `Content-Type: text/event-stream` (Vercel AI SDK streaming response)

SSE event format (emitted by Vercel AI SDK automatically):
```
data: {"type":"text-delta","textDelta":"The teams shipping"}
data: {"type":"text-delta","textDelta":" reliable LLM products"}
...
data: {"type":"finish","finishReason":"stop","usage":{"promptTokens":450,"completionTokens":980}}
data: [DONE]
```

On stream completion, the route handler persists the assembled draft:
```json
// Written to drafts table after stream closes:
{
  "user_id": "uuid",
  "idea_id": "uuid",
  "format": "substack",
  "pov_bullets": ["...", "..."],
  "content": "<full assembled text>"
}
```

**Error responses (returned before stream opens):**
```json
// 403 — Free plan monthly draft limit
{
  "error": "draft_limit_exceeded",
  "limit": 3,
  "used": 3,
  "resets_at": "2026-07-01T00:00:00Z",
  "plan": "free",
  "upgrade_url": "/settings?upgrade=true"
}

// 404 — idea_id not found
{ "error": "idea_not_found", "idea_id": "uuid" }

// 400 — format mismatch
{ "error": "format_mismatch", "expected": "substack", "received": "linkedin" }
```

**Mid-stream error:** If the stream is interrupted after opening, the SSE connection closes without `[DONE]`. The client detects this via the `onError` callback in the Vercel AI SDK `useChat` hook. The draft is NOT persisted on partial stream. No `drafts` row is written.

---

## POST /api/stripe/webhook

Handles Stripe subscription lifecycle events. Must respond within 5 seconds (Stripe timeout).

**Auth:** Stripe HMAC signature (`Stripe-Signature` header) — verified against `STRIPE_WEBHOOK_SECRET` env var. No JWT required or checked.

**Request body:** Raw Stripe event JSON (Stripe sends this directly)

**Handled event types:**

| Stripe event | Action |
|---|---|
| `customer.subscription.created` | Set `plan = 'pro'`, store `stripe_customer_id` |
| `customer.subscription.updated` | Re-evaluate status; set `plan = 'pro'` or `'free'` based on `status` field |
| `customer.subscription.deleted` | Set `plan = 'free'` |
| `checkout.session.completed` | Backfill `stripe_customer_id` if not already set |

**Response `200 OK`:**
```json
{ "received": true }
```

**Error responses:**
```json
// 400 — invalid Stripe signature (do not process)
{ "error": "invalid_signature" }

// 200 — duplicate event (idempotent, already processed)
{ "received": true, "duplicate": true }
```

**Idempotency:** Before processing any event, the handler checks `processed_stripe_events` for the `event.id`. If found, returns `200` immediately with `"duplicate": true`. Both the `processed_stripe_events` INSERT and the `user_profiles` UPDATE are committed in a single Postgres transaction.

---

## Supabase Edge Function Endpoints (internal)

These are called by pg_cron or by the Next.js API routes — not directly by the browser. Documented here for completeness.

| Endpoint | Caller | Auth |
|----------|--------|------|
| `POST /functions/v1/crawler` | pg_cron | `SUPABASE_SERVICE_ROLE_KEY` in Authorization header |
| `POST /functions/v1/summarise` | crawler (internal) | Service role key |
| `POST /functions/v1/rank` | crawler (internal) | Service role key |
| `POST /functions/v1/ideas` | crawler (internal) | Service role key |
| `POST /functions/v1/feedback` | `app/api/feedback` route | Service role key |
| `POST /functions/v1/stripe-webhook` | Stripe | Stripe HMAC signature |
