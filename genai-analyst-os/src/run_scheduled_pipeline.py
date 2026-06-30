"""Run the pipeline for every Pro user whose chosen schedule hour matches the
current UTC hour. Invoked hourly by .github/workflows/scheduled-pipeline.yml.

This is separate from run_pipeline.py's all-user daily run: that one is a
fixed 5am UTC safety net for every registered user, while this one lets each
Pro user pick their own hour in Settings ("Feed schedule").
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from src.db import get_client
from src.graph import get_graph
from src.state import PipelineState


def main() -> None:
    current_hour = datetime.now(timezone.utc).hour

    response = (
        get_client()
        .table("user_profiles")
        .select("id, style_seed, plan, scheduled_crawl_lookback_days, scheduled_crawl_max_per_source")
        .eq("scheduled_crawl_enabled", True)
        .eq("scheduled_crawl_hour_utc", current_hour)
        .execute()
    )
    users = [u for u in (response.data or []) if u.get("plan") == "pro"]

    if not users:
        print(f"No users scheduled for UTC hour {current_hour}.")
        return

    db = get_client()
    graph = get_graph()
    failed: list[str] = []
    run_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")

    for user in users:
        user_id = str(user["id"])
        # crawl_sources() reads CRAWL_LOOKBACK_DAYS / CRAWL_MAX_PER_SOURCE via
        # os.getenv() at call time, not at import time. Since this loop is
        # synchronous (one user's graph.invoke() fully completes before the
        # next starts), overriding the env per-iteration safely applies each
        # user's own crawl-depth preference instead of one shared value for
        # the whole batch.
        os.environ["CRAWL_LOOKBACK_DAYS"] = str(user.get("scheduled_crawl_lookback_days") or 7)
        os.environ["CRAWL_MAX_PER_SOURCE"] = str(user.get("scheduled_crawl_max_per_source") or 5)

        state = PipelineState(user_id=user_id, style_seed=user.get("style_seed") or "practitioner")
        try:
            graph.invoke(
                state,
                config={"configurable": {"thread_id": f"scheduled-{run_stamp}-{user_id}"}},
            )
            db.table("user_profiles").update(
                {"last_scheduled_crawl_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", user_id).execute()
            print(f"Scheduled pipeline completed for user {user_id}")
        except Exception as exc:
            failed.append(user_id)
            print(f"Scheduled pipeline failed for user {user_id}: {exc}")

    if failed:
        raise RuntimeError(f"Scheduled pipeline failed for {len(failed)} user(s): {', '.join(failed)}")


if __name__ == "__main__":
    main()
