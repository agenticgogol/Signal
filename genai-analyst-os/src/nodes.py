"""Pipeline node functions for the GenAI Analyst eval harness.

Each function maps to one Edge Function node from AGENTS.md. In production these
run as Supabase Edge Functions (Deno/TypeScript). This Python layer is for local
evals and scripts only — it mirrors the production logic using PipelineState.

Real-mode DB writes (MOCK_LLM != true):
  crawler      → opens crawl_runs row; reads user_sources
  summarise    → inserts/upserts articles with gte-small embedding
  rank         → reads topic_weights from user_profiles; inserts user_feed_items
  ideas        → inserts daily_ideas; closes crawl_runs
  feedback     → delegates entirely to supabase.rpc (in feedback.py)
"""

from __future__ import annotations

import math
import os
import re
from datetime import date, timezone, datetime
from typing import Any
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

import structlog

from src.state import PipelineState
from src.tools.crawl import crawl_sources, resolve_rss_url, UserSource
from src.tools.summarise import summarise_article, embed_article
from src.tools.score import score_article
from src.tools.ideas import generate_daily_ideas, ArticleSummary
from src.tools.digests import generate_daily_digest, send_daily_digest_email
from src.tools.feedback import update_topic_weights

logger = structlog.get_logger()

_IS_MOCK = lambda: os.getenv("MOCK_LLM", "false").lower() == "true"


# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------

def log_event(event: dict[str, Any]) -> None:
    """Emit a structured pipeline event to the SSE queue or stdout; never raises."""
    try:
        from src.api.log_stream import put_event
        put_event(event)
    except Exception:
        pass
    try:
        structlog.get_logger().info("pipeline_event", **event)
    except Exception:
        pass


def _start(node: str, preview: str = "") -> None:
    log_event({"type": "node_start", "node": node, "input_preview": preview})


def _end(node: str, summary: str = "") -> None:
    log_event({"type": "node_end", "node": node, "output_summary": summary})


# ---------------------------------------------------------------------------
# Node: crawler
# ---------------------------------------------------------------------------

def crawler(state: PipelineState) -> dict:
    """Read user_sources from Supabase (real) or use state.sources (mock/passed-in).
    Opens a crawl_runs row, fetches RSS, returns raw_articles.
    """
    logger.info("node_start", node="crawler", session_id=state.user_id)
    _start("crawler", f"user={state.user_id}, sources={len(state.sources)}")

    crawl_run_id = ""
    sources = list(state.sources)

    if not _IS_MOCK():
        try:
            from src.db import get_client
            db = get_client()

            # Open a crawl_runs row so monitoring can detect hung crawls
            run_resp = db.table("crawl_runs").insert({
                "status": "running",
                "user_id": state.user_id,
            }).execute()
            crawl_run_id = run_resp.data[0]["id"] if run_resp.data else ""

            # Load user's sources from Supabase if none passed via state
            if not sources:
                src_resp = (
                    db.table("user_sources")
                    .select("id, url, rss_url, source_tier")
                    .eq("user_id", state.user_id)
                    .execute()
                )
                sources = src_resp.data or []
                logger.info("sources_loaded", count=len(sources), user_id=state.user_id)
        except Exception as db_err:
            logger.error("crawler_db_error", error=str(db_err), user_id=state.user_id)
            log_event({"type": "error", "node": "crawler", "error": str(db_err)})

    resolved_sources: list[UserSource] = []
    for src in sources:
        if not src.get("rss_url"):
            result = resolve_rss_url(src["url"])
            src = {**src, "rss_url": result["rss_url"]}
            # Persist resolved rss_url back to Supabase
            if not _IS_MOCK() and src.get("rss_url") and src.get("id"):
                from src.db import get_client
                get_client().table("user_sources").update(
                    {"rss_url": src["rss_url"], "rss_detection_method": result["method"]}
                ).eq("id", src["id"]).execute()
        resolved_sources.append(src)

    raw = crawl_sources(state.user_id, resolved_sources)

    output = {"sources": resolved_sources, "raw_articles": raw, "crawl_run_id": crawl_run_id}
    logger.info("node_end", node="crawler", session_id=state.user_id, output_keys=list(output.keys()))
    _end("crawler", f"fetched={len(raw)} articles")
    return output


# ---------------------------------------------------------------------------
# Node: summarise
# ---------------------------------------------------------------------------

# Tracking-param / trailing-slash variants of the same URL used to create
# distinct `articles` rows even though the `url` column is unique — e.g.
# "example.com/post?utm_source=x" and "example.com/post" both pass the
# constraint but are the same story. Normalizing before the upsert collapses
# these into one row instead of relying on the DB to catch them.
_TRACKING_PARAM_PREFIXES = ("utm_", "ref", "fbclid", "gclid", "mc_", "igshid", "s=")

def normalize_article_url(url: str) -> str:
    if not url:
        return url
    try:
        parts = urlsplit(url.strip())
        kept_params = [
            (k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
            if not any(k.lower().startswith(p) for p in _TRACKING_PARAM_PREFIXES)
        ]
        path = parts.path.rstrip("/") or "/"
        return urlunsplit((
            parts.scheme.lower(),
            parts.netloc.lower(),
            path,
            urlencode(kept_params),
            "",  # drop fragment
        ))
    except Exception:
        return url


_TITLE_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
    "is", "are", "was", "were", "how", "why", "what", "new", "after", "over",
    "into", "its", "it", "as", "from", "by", "at", "this", "that", "will", "can",
}

def _title_tokens(title: str) -> set[str]:
    words = re.findall(r"[a-z0-9][a-z0-9'-]{2,}", title.lower())
    return {w for w in words if w not in _TITLE_STOPWORDS}


def _title_overlap(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    shared = len(a & b)
    return shared / min(len(a), len(b))


_SAME_STORY_TITLE_OVERLAP = 0.7


def summarise(state: PipelineState) -> dict:
    """Call summarise_article + embed_article for each raw article.
    Real mode: upserts into articles table (ON CONFLICT url → update).
    Tracks the Supabase UUID in each summary dict for downstream use.
    """
    logger.info("node_start", node="summarise", session_id=state.user_id)
    _start("summarise", f"articles={len(state.raw_articles)}")

    seen_urls: set[str] = set()
    summaries = []
    embeddings = []
    errors = list(state.errors)

    db = None
    if not _IS_MOCK():
        from src.db import get_client
        db = get_client()

    for article in state.raw_articles:
        url = normalize_article_url(article["url"])
        if url in seen_urls:
            continue
        seen_urls.add(url)

        result = summarise_article(article.get("full_text", ""), article.get("title", ""))
        if result is None:
            errors.append({"node": "summarise", "message": f"summarise_article failed for {url}", "skipped": True})
            summaries.append({**article, "tldr_bullets": None, "topic_tags": [], "depth_score": 1})
            embeddings.append(None)
            continue

        vec = embed_article(article.get("title", "") + " " + article.get("full_text", ""))
        embeddings.append(vec)

        article_db_id = article.get("id", url)  # fallback to URL in mock mode

        if db is not None:
            # pgvector expects a string "[x1,x2,...,xn]" from the Python client
            vec_str = "[" + ",".join(f"{x:.8f}" for x in vec) + "]"
            row = {
                "url":             url,
                "title":           article.get("title", ""),
                "full_text":       article.get("full_text", ""),
                "tldr_bullets":    result["tldr_bullets"],
                "topic_tags":      result["topic_tags"],
                "depth_score":     result["depth_score"],
                "why_it_matters":  result.get("why_it_matters") or None,
                "key_takeaways":   result.get("key_takeaways") or None,
                "og_image_url":    article.get("og_image_url") or None,
                "embedding":       vec_str,
                "published_at":    article.get("published_at") or None,
                "source_id":       article.get("source_id") or None,
            }
            try:
                upsert_resp = db.table("articles").upsert(row, on_conflict="url").execute()
                if upsert_resp.data:
                    article_db_id = upsert_resp.data[0]["id"]
            except Exception as exc:
                errors.append({"node": "summarise", "message": f"DB upsert failed for {url}: {exc}", "skipped": False})

        summaries.append({**article, **result, "id": article_db_id})

    output = {"summaries": summaries, "embeddings": embeddings, "errors": errors}
    logger.info("node_end", node="summarise", session_id=state.user_id, output_keys=list(output.keys()))
    _end("summarise", f"summarised={len(summaries)}, failed={sum(1 for e in errors if e['node']=='summarise')}")
    return output


# ---------------------------------------------------------------------------
# Node: rank
# ---------------------------------------------------------------------------

def _cosine_approx(topic_weights: dict[str, float], article_tags: list[str]) -> float:
    """Approximate cosine similarity by averaging tag weights (production uses pgvector)."""
    if not article_tags or not topic_weights:
        return 0.0
    scores = [topic_weights.get(tag, 0.0) for tag in article_tags]
    return sum(scores) / len(scores)


def rank(state: PipelineState) -> dict:
    """Compute blend scores; in real mode reads topic_weights from user_profiles
    and inserts ranked rows into user_feed_items (ON CONFLICT DO NOTHING).
    """
    logger.info("node_start", node="rank", session_id=state.user_id)
    _start("rank", f"articles={len(state.summaries)}, weights_set={bool(state.topic_weights)}")

    weights = state.topic_weights
    errors = list(state.errors)

    # Real mode: load topic_weights from Supabase if not already in state
    if not _IS_MOCK() and not weights:
        from src.db import get_client
        db = get_client()
        profile_resp = (
            db.table("user_profiles")
            .select("topic_weights")
            .eq("id", state.user_id)
            .maybe_single()
            .execute()
        )
        if profile_resp.data:
            weights = {k: float(v) for k, v in profile_resp.data["topic_weights"].items()}

    # Fallback to equal weights if still empty or all-zero
    if not weights or all(v == 0.0 for v in weights.values()):
        from src.tools.summarise import TOPIC_TAXONOMY
        weights = {tag: 1.0 / len(TOPIC_TAXONOMY) for tag in TOPIC_TAXONOMY}

    feed_items = []
    today = str(date.today())

    for article in state.summaries:
        # Use the Supabase UUID when available; fall back to URL-as-id in mock mode
        art_id = article.get("id", article.get("url", ""))
        cosine = _cosine_approx(weights, article.get("topic_tags") or [])
        blend = score_article(
            article_id=art_id,
            user_id=state.user_id,
            published_at=article.get("published_at", ""),
            cosine_similarity=cosine,
            source_tier=article.get("source_tier", 2),
        )
        feed_items.append({
            "article_id": art_id,
            "blend_score": blend,
            "article": article,
        })

    feed_items.sort(key=lambda x: x["blend_score"], reverse=True)

    # Two different sources can syndicate the same underlying story under
    # different URLs — each becomes its own `articles` row (unique on url),
    # but a user shouldn't see the same story twice in one feed. Since the
    # list is already sorted best-first, this keeps the highest-scoring
    # instance of each story and drops near-duplicate titles.
    seen_title_tokens: list[set[str]] = []
    deduped_feed_items = []
    for item in feed_items:
        tokens = _title_tokens(item["article"].get("title", "") or "")
        if any(_title_overlap(tokens, existing) >= _SAME_STORY_TITLE_OVERLAP for existing in seen_title_tokens):
            continue
        deduped_feed_items.append(item)
        seen_title_tokens.append(tokens)
    feed_items = deduped_feed_items

    # Real mode: persist to user_feed_items
    if not _IS_MOCK() and feed_items:
        from src.db import get_client
        db = get_client()
        rows = [
            {
                "user_id":     state.user_id,
                "article_id":  item["article_id"],
                "blend_score": item["blend_score"],
                "feed_date":   today,
            }
            for item in feed_items
        ]
        import re as _re
        _UUID_RE = _re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', _re.I)
        valid_rows = [r for r in rows if _UUID_RE.match(str(r.get("article_id", "")))]
        skipped_ids = [r["article_id"] for r in rows if r not in valid_rows]
        if skipped_ids:
            logger.warning("rank_skip_invalid_ids", count=len(skipped_ids), ids=skipped_ids[:3])
        try:
            if valid_rows:
                db.table("user_feed_items").upsert(
                    valid_rows, on_conflict="user_id,article_id,feed_date"
                ).execute()
                logger.info("rank_inserted", count=len(valid_rows))
        except Exception as exc:
            errors.append({"node": "rank", "message": f"user_feed_items insert failed: {exc}", "skipped": False})
            logger.error("rank_insert_failed", error=str(exc))

    # An empty crawl still has to close its run. Otherwise UI/status monitoring
    # sees a permanently-running job and can never report "0 new articles".
    if not _IS_MOCK() and not feed_items and state.crawl_run_id:
        from src.db import get_client
        try:
            get_client().table("crawl_runs").update({
                "completed_at": datetime.now(tz=timezone.utc).isoformat(),
                "status": "degraded" if errors else "completed",
                "articles_fetched": len(state.raw_articles),
                "articles_new": 0,
                "articles_failed": 0,
                "users_ranked": 0,
                "users_ideas_generated": 0,
                "error_log": errors,
            }).eq("id", state.crawl_run_id).execute()
        except Exception as exc:
            logger.warning("empty_crawl_run_close_failed", error=str(exc))

    output = {"feed_items": feed_items, "topic_weights": weights, "errors": errors}
    logger.info("node_end", node="rank", session_id=state.user_id, output_keys=list(output.keys()))
    _end("rank", f"ranked={len(feed_items)}")
    return output


# ---------------------------------------------------------------------------
# Node: ideas
# ---------------------------------------------------------------------------

def ideas(state: PipelineState) -> dict:
    """Generate 5 daily ideas and today's digest; in real mode persists both and closes crawl_runs."""
    logger.info("node_start", node="ideas", session_id=state.user_id)
    _start("ideas", f"feed_items={len(state.feed_items)}, style={state.style_seed}")

    # Idempotency: skip if 5 ideas already generated today. This must still
    # close THIS run's crawl_runs row — the crawl/rank steps above already
    # ran for this specific invocation; only idea-generation is redundant.
    # Skipping the close here used to leave the UI's status poll stuck on
    # "running" forever any time a user triggered a second run (manual or
    # scheduled) on a day ideas already existed for.
    if len(state.daily_ideas) == 5:
        log_event({"type": "node_start", "node": "ideas", "input_preview": "SKIPPED — already generated today"})
        if not _IS_MOCK() and state.crawl_run_id:
            from src.db import get_client
            try:
                get_client().table("crawl_runs").update({
                    "completed_at":          datetime.now(tz=timezone.utc).isoformat(),
                    "status":                "degraded" if state.errors else "completed",
                    "articles_fetched":      len(state.raw_articles),
                    "articles_new":          len(state.summaries),
                    "articles_failed":       sum(1 for e in state.errors if e.get("node") == "summarise"),
                    "users_ranked":          1 if state.feed_items else 0,
                    "users_ideas_generated": 1,
                    "error_log":             state.errors,
                }).eq("id", state.crawl_run_id).execute()
            except Exception as exc:
                logger.warning("crawl_run_close_failed_on_idea_skip", error=str(exc))
        logger.info("node_end", node="ideas", session_id=state.user_id, output_keys=[], skipped=True)
        return {}

    top_articles: list[ArticleSummary] = []
    for item in state.feed_items[:10]:
        art = item.get("article", {})
        if art.get("tldr_bullets"):
            top_articles.append(ArticleSummary(
                id=art.get("id", art.get("url", "")),
                title=art.get("title", ""),
                tldr_bullets=art.get("tldr_bullets", []),
                topic_tags=art.get("topic_tags", []),
                depth_score=art.get("depth_score", 3),
                published_at=art.get("published_at", ""),
            ))

    errors = list(state.errors)
    result_ideas = generate_daily_ideas(state.user_id, top_articles, state.style_seed)
    daily_digest = generate_daily_digest(state.user_id, top_articles, state.style_seed)

    if len(result_ideas) < 5:
        errors.append({"node": "ideas", "message": f"only {len(result_ideas)} ideas returned after retry", "skipped": True})

    today = str(date.today())

    # Real mode: insert ideas + close crawl_runs
    if not _IS_MOCK():
        from src.db import get_client
        db = get_client()

        if result_ideas:
            idea_rows = [
                {
                    "user_id":            state.user_id,
                    "idea_date":          today,
                    "position":           idea["position"],
                    "angle_title":        idea["angle_title"],
                    "format":             idea["format"],
                    "hook_sentence":      idea["hook_sentence"],
                    "rationale":          idea["rationale"],
                    "source_article_ids": idea["source_article_ids"],
                }
                for idea in result_ideas
            ]
            try:
                # Delete any partial set first (invariant: always full set or nothing)
                db.table("daily_ideas").delete().eq("user_id", state.user_id).eq("idea_date", today).execute()
                db.table("daily_ideas").insert(idea_rows).execute()
            except Exception as exc:
                errors.append({"node": "ideas", "message": f"daily_ideas insert failed: {exc}", "skipped": False})

        if daily_digest:
            topic_counts: dict[str, int] = {}
            for article in top_articles:
                for tag in article.get("topic_tags", []):
                    topic_counts[tag] = topic_counts.get(tag, 0) + 1
            dominant_topics = [tag for tag, _count in sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:3]]
            try:
                db.table("daily_digests").upsert({
                    "user_id": state.user_id,
                    "digest_date": today,
                    "narrative": daily_digest,
                    "article_count": len(top_articles),
                    "dominant_topics": dominant_topics,
                    "generated_at": datetime.now(tz=timezone.utc).isoformat(),
                }, on_conflict="user_id,digest_date").execute()
            except Exception as exc:
                errors.append({"node": "daily_digest", "message": f"daily_digests upsert failed: {exc}", "skipped": False})

            try:
                profile_resp = (
                    db.table("user_profiles")
                    .select("daily_digest_enabled, digest_email")
                    .eq("id", state.user_id)
                    .maybe_single()
                    .execute()
                )
                profile = profile_resp.data or {}
                if profile.get("daily_digest_enabled") and profile.get("digest_email"):
                    sent = send_daily_digest_email(
                        to_email=str(profile["digest_email"]),
                        digest=daily_digest,
                        article_count=len(top_articles),
                        dominant_topics=dominant_topics,
                    )
                    if sent:
                        db.table("daily_digests").update({
                            "emailed_at": datetime.now(tz=timezone.utc).isoformat(),
                        }).eq("user_id", state.user_id).eq("digest_date", today).execute()
                    else:
                        errors.append({"node": "daily_digest_email", "message": "digest email send skipped or failed", "skipped": True})
            except Exception as exc:
                errors.append({"node": "daily_digest_email", "message": f"digest email failed: {exc}", "skipped": True})

        # Close crawl_runs row
        if state.crawl_run_id:
            status = "degraded" if errors else "completed"
            try:
                db.table("crawl_runs").update({
                    "completed_at":           datetime.now(tz=timezone.utc).isoformat(),
                    "status":                 status,
                    "articles_fetched":       len(state.raw_articles),
                    "articles_new":           len(state.summaries),
                    "articles_failed":        sum(1 for e in errors if e.get("node") == "summarise"),
                    "users_ranked":           1 if state.feed_items else 0,
                    "users_ideas_generated":  1 if len(result_ideas) == 5 else 0,
                    "error_log":              errors,
                }).eq("id", state.crawl_run_id).execute()
            except Exception as exc:
                logger.warning("crawl_run_close_failed", error=str(exc))

    output = {
        "daily_ideas": [dict(i) for i in result_ideas],
        "daily_digest": dict(daily_digest) if daily_digest else None,
        "errors": errors,
    }
    logger.info("node_end", node="ideas", session_id=state.user_id, output_keys=list(output.keys()))
    _end("ideas", f"ideas={len(result_ideas)}")
    return output


# ---------------------------------------------------------------------------
# Node: feedback
# ---------------------------------------------------------------------------

def feedback(state: PipelineState) -> dict:
    """Apply a like/dislike signal to topic_weights.
    Real mode delegates entirely to supabase.rpc (atomic transaction in Postgres).
    """
    logger.info("node_start", node="feedback", session_id=state.user_id)
    _start("feedback", f"user={state.user_id}, angle={state.selected_angle}")

    if state.selected_angle is None:
        logger.info("node_end", node="feedback", session_id=state.user_id, output_keys=[], skipped=True)
        return {}

    signal = state.selected_angle.get("signal", "like")
    article_tags = state.selected_angle.get("article_tags", [])
    article_id = state.selected_angle.get("article_id", "")

    updated = update_topic_weights(
        user_id=state.user_id,
        article_id=article_id,
        signal=signal,
        article_tags=article_tags,
        current_weights=state.topic_weights or None,
    )
    output = {"topic_weights": updated}
    logger.info("node_end", node="feedback", session_id=state.user_id, output_keys=list(output.keys()))
    _end("feedback", f"weights updated for {len(updated)} tags")
    return output


# ---------------------------------------------------------------------------
# Node: stripe_webhook
# ---------------------------------------------------------------------------

def stripe_webhook(state: PipelineState) -> dict:
    """Stub: Stripe plan updates are handled by the Next.js API route in production."""
    logger.info("node_start", node="stripe_webhook", session_id=state.user_id)
    _start("stripe_webhook", "stub — production path only")
    _end("stripe_webhook", "no-op in eval harness")
    logger.info("node_end", node="stripe_webhook", session_id=state.user_id, output_keys=[])
    return {}


# ---------------------------------------------------------------------------
# Routing helpers (used by graph.py conditional edges)
# ---------------------------------------------------------------------------

def should_summarise(state: PipelineState) -> str:
    return "summarise" if state.raw_articles else "rank"


def should_generate_ideas(state: PipelineState) -> str:
    return "ideas" if state.feed_items else "__end__"
