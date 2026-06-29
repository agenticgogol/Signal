"""Compute blend scores using recency, pgvector cosine similarity, and source tier."""

from __future__ import annotations

import math
import os
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Tool
# ---------------------------------------------------------------------------

def score_article(
    article_id: str,
    user_id: str,
    published_at: str,
    cosine_similarity: float,
    source_tier: int,
) -> float:
    """Compute blend_score = 0.35×recency + 0.45×cosine_sim + 0.20×(source_tier/3)."""
    if os.getenv("MOCK_LLM", "false").lower() == "true":
        return 0.75

    # Handle NaN cosine (article has no embedding — fallback weights)
    no_embedding = math.isnan(cosine_similarity)
    if no_embedding:
        cosine_similarity = 0.0

    # Recency: exponential decay with 72-hour half-life
    try:
        pub = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        now = datetime.now(tz=timezone.utc)
        hours_old = (now - pub).total_seconds() / 3600.0
    except (ValueError, TypeError):
        hours_old = 72.0  # treat unparseable date as 3 days old

    recency_score = math.exp(-hours_old / 72.0)
    tier_score = max(0.0, min(1.0, (source_tier - 1) / 2.0))  # normalise 1–3 → 0.0–1.0

    if no_embedding:
        # Fallback weights when embedding is missing
        blend = 0.55 * recency_score + 0.45 * tier_score
    else:
        blend = 0.35 * recency_score + 0.45 * cosine_similarity + 0.20 * tier_score

    return round(max(0.0, min(1.0, blend)), 6)


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    os.environ["MOCK_LLM"] = "true"
    score = score_article(
        article_id="art-01",
        user_id="mock-user-01",
        published_at="2026-06-28T10:00:00Z",
        cosine_similarity=0.82,
        source_tier=2,
    )
    print(f"score_article (mock) → {score}")

    # Also test real logic
    del os.environ["MOCK_LLM"]
    score_real = score_article(
        article_id="art-01",
        user_id="mock-user-01",
        published_at="2026-06-28T10:00:00Z",
        cosine_similarity=0.82,
        source_tier=2,
    )
    print(f"score_article (real, cosine=0.82, tier=2) → {score_real}")

    score_nan = score_article(
        article_id="art-02",
        user_id="mock-user-01",
        published_at="2026-06-28T14:00:00Z",
        cosine_similarity=float("nan"),
        source_tier=3,
    )
    print(f"score_article (no embedding, tier=3) → {score_nan}")
