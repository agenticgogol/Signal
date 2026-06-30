"""Execute the daily pipeline for every registered user, or for a single user
when PIPELINE_USER_ID is set (used by manual "Get Latest Feed" triggers and
single-user scheduled runs so they don't reprocess every other account).
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from src.db import get_client
from src.graph import get_graph
from src.state import PipelineState


def main() -> None:
    only_user_id = (os.environ.get("PIPELINE_USER_ID") or "").strip()

    query = get_client().table("user_profiles").select("id, style_seed")
    if only_user_id:
        query = query.eq("id", only_user_id)
    response = query.execute()
    users = response.data or []
    if not users:
        if only_user_id:
            print(f"No matching user_profiles row for PIPELINE_USER_ID={only_user_id}.")
        else:
            print("No registered users; pipeline has nothing to run.")
        return

    graph = get_graph()
    failed: list[str] = []
    run_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    for user in users:
        user_id = str(user["id"])
        state = PipelineState(user_id=user_id, style_seed=user.get("style_seed") or "practitioner")
        try:
            graph.invoke(
                state,
                config={"configurable": {"thread_id": f"daily-{run_stamp}-{user_id}"}},
            )
            print(f"Pipeline completed for user {user_id}")
        except Exception as exc:
            failed.append(user_id)
            print(f"Pipeline failed for user {user_id}: {exc}")

    if failed:
        raise RuntimeError(f"Pipeline failed for {len(failed)} user(s): {', '.join(failed)}")


if __name__ == "__main__":
    main()
