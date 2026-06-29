"""Supabase client singleton for the Python eval harness.

All tools and nodes import get_client() rather than instantiating their own
client. Uses the service role key so it bypasses RLS — same as Edge Functions.
Never used in mock mode; tools guard with MOCK_LLM env check before calling.
"""

from __future__ import annotations

import os
from functools import lru_cache

from supabase import create_client, Client


@lru_cache(maxsize=1)
def get_client() -> Client:
    """Return the singleton Supabase client (service role, bypasses RLS)."""
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env "
            "before running in real mode. Use MOCK_LLM=true to skip."
        )
    return create_client(url, key)
