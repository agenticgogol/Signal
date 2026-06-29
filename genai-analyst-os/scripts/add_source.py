"""CLI tool to add content sources for a user.

Usage:
    # Add from your curated list:
    python scripts/add_source.py --file scripts/my_sources.txt --email utsab.chakraborty@gmail.com

    # Add a single URL:
    python scripts/add_source.py --url https://simonwillison.net --email utsab.chakraborty@gmail.com

    # Interactive — asks for email then prompts for URLs one by one:
    python scripts/add_source.py

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()


# ---------------------------------------------------------------------------
# URLs that can never have an RSS feed — detected and skipped immediately
# ---------------------------------------------------------------------------

_NO_RSS_DOMAINS = {
    "linkedin.com",           # no public RSS; API is paid
    "twitter.com",            # RSS removed 2023
    "x.com",                  # same
    "instagram.com",          # no RSS
    "facebook.com",           # no RSS
}

_NO_RSS_PATHS = {
    # Static pages / one-off reports — not feeds
    "cloud.google.com/transform",
    "langchain.com/state-of-agent-engineering",
}

_EMAIL_ONLY_DOMAINS = {
    "deeplearning.ai",        # The Batch — email subscription only, no public RSS
}


def _is_unsupported(url: str) -> tuple[bool, str]:
    """Return (True, reason) if this URL is known to have no RSS."""
    parsed = urlparse(url)
    domain = parsed.netloc.lstrip("www.")
    path = parsed.path.lstrip("/")
    full_path = f"{domain}/{path}"

    if domain in _NO_RSS_DOMAINS:
        return True, f"❌ {domain} has no public RSS (LinkedIn/Twitter require paid API)"
    if domain in _EMAIL_ONLY_DOMAINS:
        return True, f"❌ {domain} is email-only — no public RSS feed exists"
    for p in _NO_RSS_PATHS:
        if p in full_path:
            return True, f"❌ This is a static page, not a feed: {url}"
    return False, ""


# ---------------------------------------------------------------------------
# Verified RSS paths for known domains (confirmed 2026-06-29)
# ---------------------------------------------------------------------------

# Format: url_fragment → rss_url
# None = handled specially in _resolve_rss_hint()
_KNOWN_FEEDS: dict[str, str | None] = {
    # ── Substack (pattern: *.substack.com or custom domain with /feed) ──────
    ".substack.com":                    None,   # → subdomain.substack.com/feed
    "newsletter.swirlai.com":           "https://www.newsletter.swirlai.com/feed",
    "magazine.sebastianraschka.com":    "https://magazine.sebastianraschka.com/feed",

    # ── Personal blogs ───────────────────────────────────────────────────────
    "lilianweng.github.io":             "https://lilianweng.github.io/index.xml",
    "huyenchip.com":                    "https://huyenchip.com/feed.xml",
    "simonwillison.net":                "https://simonwillison.net/atom/everything/",
    "eugeneyan.com":                    "https://eugeneyan.com/feed.xml",
    "karpathy.github.io":               "https://karpathy.github.io/feed.xml",

    # ── Research lab blogs ────────────────────────────────────────────────────
    "huggingface.co/blog":              "https://huggingface.co/blog/feed.xml",
    "deepmind.google":                  "https://deepmind.google/blog/rss.xml",
    "blog.google/technology/ai":        "https://blog.google/technology/ai/rss/",
    "blog.google/innovation-and-ai":    "https://blog.google/technology/ai/rss/",  # same feed
    "engineering.fb.com":               "https://engineering.fb.com/feed/",

    # ── Tech company blogs ────────────────────────────────────────────────────
    "netflixtechblog.com":              "https://netflixtechblog.com/feed",
    "zenml.io/blog":                    "https://www.zenml.io/blog/rss.xml",

    # ── Medium publications ───────────────────────────────────────────────────
    "towardsdatascience.com":           "https://towardsdatascience.com/feed",
    "pub.towardsai.net":                "https://pub.towardsai.net/feed",
    "medium.com/@":                     None,   # → medium.com/feed/@username

    # ── arXiv ─────────────────────────────────────────────────────────────────
    "arxiv.org/rss/":                   None,   # already a feed URL — use as-is
    "arxiv.org/list/cs.AI":             "https://arxiv.org/rss/cs.AI",
    "arxiv.org/list/cs.LG":             "https://arxiv.org/rss/cs.LG",
    "arxiv.org/list/cs.CL":             "https://arxiv.org/rss/cs.CL",

    # ── Other ─────────────────────────────────────────────────────────────────
    "thegradient.pub":                  "https://thegradient.pub/rss/",
    "paperswithcode.com/blog":          "https://paperswithcode.com/blog/feed",
}

# Domains known to have no RSS despite being real content sources
# (we still add them; crawler will fall back to article scraping)
_NO_FEED_BUT_ADD = {
    "therundown.ai",      # no RSS confirmed; added anyway so user is aware
    "dair.ai",            # no RSS confirmed
    "sh-reya.com",        # no RSS confirmed (Shreya Shankar)
    "jxnl.co",            # no RSS confirmed (Jason Liu)
    "shopify.engineering",
    "uber.com/blog",
}


def _resolve_rss_hint(url: str) -> tuple[str | None, str]:
    """Return (rss_url, method) for known domains; (None, 'probe') to trigger full probe."""

    # If the URL itself looks like an RSS/Atom feed, use it directly
    if any(url.endswith(ext) for ext in ("/feed", "/rss", ".xml", "/atom", "/rss.xml", "/feed.xml")) \
            or "/rss/" in url:
        return url, "direct_feed_url"

    # Medium personal profile
    if "medium.com/@" in url:
        username = url.split("medium.com/@")[-1].split("/")[0].split("?")[0]
        return f"https://medium.com/feed/@{username}", "known_pattern"

    # Substack — any *.substack.com → /feed
    parsed = urlparse(url)
    if parsed.netloc.endswith(".substack.com"):
        return f"https://{parsed.netloc}/feed", "known_pattern"

    # Match against _KNOWN_FEEDS dict (longest matching key wins)
    matches = [(k, v) for k, v in _KNOWN_FEEDS.items() if k in url]
    if matches:
        key, rss = max(matches, key=lambda x: len(x[0]))
        if rss is not None:
            return rss, "known_pattern"

    return None, "probe"


# ---------------------------------------------------------------------------
# Source tier assignment
# ---------------------------------------------------------------------------

_TIER1 = {
    "arxiv.org", "openai.com", "anthropic.com", "deepmind.google",
    "ai.google", "research.google", "microsoft.com/research",
    "huggingface.co", "blog.google",
}
_TIER3 = {
    "reddit.com", "news.ycombinator.com", "medium.com",
    "towardsdatascience.com", "pub.towardsai.net",
}


def _source_tier(url: str) -> int:
    domain = urlparse(url).netloc.lstrip("www.")
    if any(d in domain for d in _TIER1):
        return 1
    if any(d in domain for d in _TIER3):
        return 3
    return 2


# ---------------------------------------------------------------------------
# Core add logic
# ---------------------------------------------------------------------------

def add_source(user_id: str, url: str, verbose: bool = True) -> dict:
    """Resolve RSS for url and insert into user_sources. Returns the inserted row."""
    from src.db import get_client
    from src.tools.crawl import resolve_rss_url

    # Normalise
    url = url.strip().split("#")[0].strip().rstrip("/")
    if not url.startswith("http"):
        url = "https://" + url

    # Hard skip for known unsupported sources
    unsupported, reason = _is_unsupported(url)
    if unsupported:
        if verbose:
            print(f"  SKIP  {url}")
            print(f"        {reason}")
        return {}

    db = get_client()

    # Duplicate check
    existing = (
        db.table("user_sources")
        .select("id, url, rss_url")
        .eq("user_id", user_id)
        .eq("url", url)
        .execute()
    )
    if existing.data:
        if verbose:
            print(f"  DUPE  {url}  (already added)")
        return existing.data[0]

    if verbose:
        print(f"  ADD   {url}", end="  ", flush=True)

    # Fast-path RSS resolution
    rss_url, method = _resolve_rss_hint(url)

    # Fall back to full probe if not in known map
    if rss_url is None and method == "probe":
        result = resolve_rss_url(url)
        rss_url = result["rss_url"]
        method  = result["method"]

    if verbose:
        if rss_url:
            print(f"→  {rss_url}  [{method}]")
        else:
            print(f"→  no RSS found [{method}] — stored without feed URL")

    row = {
        "user_id":              user_id,
        "url":                  url,
        "rss_url":              rss_url,
        "rss_detection_method": method,
        "source_tier":          _source_tier(url),
    }
    resp = db.table("user_sources").insert(row).execute()
    return resp.data[0] if resp.data else row


def get_user_id_by_email(email: str) -> str:
    """Look up auth.users by email and return the UUID."""
    from src.db import get_client
    db = get_client()
    resp = db.auth.admin.list_users()
    for user in resp:
        if hasattr(user, "email") and user.email == email:
            return str(user.id)
    raise ValueError(
        f"No Supabase account found for {email!r}. "
        "Sign up at your Supabase project URL first, then re-run."
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Add content sources for GenAI Analyst OS.")
    parser.add_argument("--url",      help="Single URL to add")
    parser.add_argument("--file",     help="Text file with one URL per line (# = comment)")
    parser.add_argument("--email",    help="Your Supabase account email")
    parser.add_argument("--user-id",  dest="user_id", help="Supabase user UUID (alternative to --email)")
    args = parser.parse_args()

    # Resolve user_id
    user_id = args.user_id
    if not user_id:
        email = args.email or input("Your account email: ").strip()
        print(f"Looking up Supabase user ID for {email} …")
        try:
            user_id = get_user_id_by_email(email)
            print(f"  ✅  Found — user_id: {user_id}\n")
        except Exception as exc:
            print(f"  ❌  {exc}")
            sys.exit(1)

    # Collect URLs
    urls: list[str] = []
    if args.url:
        urls = [args.url]
    elif args.file:
        fp = Path(args.file)
        if not fp.exists():
            print(f"❌  File not found: {args.file}")
            sys.exit(1)
        for raw in fp.read_text().splitlines():
            line = raw.split("#")[0].strip()   # strip inline comments
            if line:
                urls.append(line)
    else:
        print("Enter URLs one per line. Empty line to finish:")
        while True:
            line = input("  > ").strip()
            if not line:
                break
            urls.append(line)

    if not urls:
        print("No URLs provided.")
        sys.exit(0)

    print(f"Processing {len(urls)} URL(s) for user {user_id[:8]}…\n")
    added = skipped = failed = 0

    for url in urls:
        try:
            result = add_source(user_id, url, verbose=True)
            if not result:
                skipped += 1
            elif result.get("id"):
                added += 1
            else:
                skipped += 1
        except Exception as exc:
            print(f"  ❌  FAILED  {url}  —  {exc}")
            failed += 1

    print(f"\n{'─' * 55}")
    print(f"  Added: {added}   Skipped (unsupported/dupe): {skipped}   Failed: {failed}")
    print(f"\nNext step — run a real crawl:")
    print(f"  MOCK_LLM=false .venv/bin/python -m src.api.main")
    print(f"  curl -X POST http://localhost:8000/chat \\")
    print(f'       -H "Content-Type: application/json" \\')
    print(f'       -d \'{{"message":"{user_id}","session_id":"run-001"}}\'')


if __name__ == "__main__":
    main()
