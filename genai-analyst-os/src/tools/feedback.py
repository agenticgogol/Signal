"""Recompute topic_weights from feedback history; in production runs via supabase.rpc()."""

from __future__ import annotations

import os
from typing import Literal

from src.tools.summarise import TOPIC_TAXONOMY

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_LIKE_DELTA = 0.10
_DISLIKE_DELTA = -0.05
_DEFAULT_WEIGHT = 0.5


# ---------------------------------------------------------------------------
# Tool
# ---------------------------------------------------------------------------

def update_topic_weights(
    user_id: str,
    article_id: str,
    signal: Literal["like", "dislike"],
    article_tags: list[str],
    current_weights: dict[str, float] | None = None,
) -> dict[str, float]:
    """Recompute topic_weights from a new feedback signal; returns updated weights clamped to [0.0, 1.0].

    In production this runs as supabase.rpc('update_feedback_and_weights', {...}) — a single
    Postgres transaction. This Python implementation is for local evals only.
    """
    if os.getenv("MOCK_LLM", "false").lower() == "true":
        # Mock: return input weights unchanged (or defaults if none provided)
        return current_weights or {tag: _DEFAULT_WEIGHT for tag in TOPIC_TAXONOMY}

    # Real mode: single atomic Postgres transaction via the RPC function.
    # This writes user_feedback AND updates user_profiles.topic_weights together —
    # never call them as two separate operations (silent rollback risk on interruption).
    from src.db import get_client
    db = get_client()
    resp = db.rpc(
        "update_feedback_and_weights",
        {
            "p_user_id":    user_id,
            "p_article_id": article_id,
            "p_signal":     signal,
        },
    ).execute()
    updated: dict[str, float] = resp.data
    if not updated:
        return current_weights or {tag: _DEFAULT_WEIGHT for tag in TOPIC_TAXONOMY}
    return {k: float(v) for k, v in updated.items()}


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    os.environ["MOCK_LLM"] = "true"
    result = update_topic_weights(
        user_id="mock-user-01",
        article_id="art-01",
        signal="like",
        article_tags=["agents", "evals"],
        current_weights={"agents": 0.8, "evals": 0.7},
    )
    print(f"update_topic_weights (mock) → {result}")

    del os.environ["MOCK_LLM"]
    weights_before = {tag: 0.5 for tag in TOPIC_TAXONOMY}
    result_real = update_topic_weights(
        user_id="mock-user-01",
        article_id="art-01",
        signal="like",
        article_tags=["agents", "evals"],
        current_weights=weights_before,
    )
    print(f"update_topic_weights (real, like agents+evals) →")
    for tag, w in result_real.items():
        marker = " ←" if tag in ("agents", "evals") else ""
        print(f"  {tag}: {w:.2f}{marker}")
