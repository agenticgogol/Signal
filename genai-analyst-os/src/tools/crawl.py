"""Fetch RSS/HTML from user sources and return new unseen article objects."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import TypedDict
from urllib.parse import urljoin, urlparse


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class UserSource(TypedDict):
    id: str
    url: str
    rss_url: str | None
    source_tier: int


class RawArticle(TypedDict):
    url: str
    title: str
    full_text: str
    published_at: str  # ISO 8601
    source_id: str
    og_image_url: str  # best image from RSS media/enclosures, empty if none


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_MOCK_DATA_PATH = Path(__file__).parent.parent.parent / "data" / "mock_articles.json"


def _load_mock_articles() -> list[RawArticle]:
    if _MOCK_DATA_PATH.exists():
        articles = json.loads(_MOCK_DATA_PATH.read_text())
        return [
            RawArticle(
                url=a["url"],
                title=a["title"],
                full_text=a.get("full_text", ""),
                published_at=a["published_at"],
                source_id=a["source_id"],
                og_image_url=a.get("og_image_url", ""),
            )
            for a in articles[:3]
        ]
    return [
        RawArticle(url="https://example.com/post/1", title="Mock Article 1",
                   full_text="Mock full text.", published_at="2026-06-28T10:00:00Z", source_id="src-01", og_image_url=""),
        RawArticle(url="https://example.com/post/2", title="Mock Article 2",
                   full_text="Mock full text.", published_at="2026-06-28T12:00:00Z", source_id="src-02", og_image_url=""),
        RawArticle(url="https://example.com/post/3", title="Mock Article 3",
                   full_text="Mock full text.", published_at="2026-06-28T14:00:00Z", source_id="src-03", og_image_url=""),
    ]


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

def _parse_date(raw: str) -> str:
    """Normalise any RSS date string to ISO 8601 UTC. Returns empty string on failure."""
    if not raw:
        return ""
    try:
        dt = parsedate_to_datetime(raw)
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        pass
    try:
        # ISO 8601 already — just normalise
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return ""


def _first_content_image(html: str, article_url: str) -> str:
    """Return the first usable image embedded in an RSS summary/content body."""
    if not html:
        return ""
    from html.parser import HTMLParser

    class ImageParser(HTMLParser):
        src = ""

        def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
            if tag.lower() != "img" or self.src:
                return
            values = dict(attrs)
            candidate = values.get("src") or values.get("data-src") or ""
            if candidate and not candidate.startswith("data:"):
                self.src = urljoin(article_url, candidate)

    parser = ImageParser()
    try:
        parser.feed(html)
    except Exception:
        return ""
    return parser.src


def crawl_sources(user_id: str, sources: list[UserSource]) -> list[RawArticle]:
    """Fetch RSS/HTML for all user_sources; return new unseen articles."""
    if os.getenv("MOCK_LLM", "false").lower() == "true":
        return _load_mock_articles()

    try:
        import feedparser  # type: ignore
        import httpx
    except ImportError as e:
        return []  # optional deps not installed in this env

    max_per_source = int(os.getenv("CRAWL_MAX_PER_SOURCE", "5"))
    lookback_days = int(os.getenv("CRAWL_LOOKBACK_DAYS", "7"))
    cutoff_dt = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ) - timedelta(days=lookback_days)

    results: list[RawArticle] = []
    for source in sources:
        feed_url = source.get("rss_url") or source["url"]
        try:
            resp = httpx.get(feed_url, timeout=10.0, follow_redirects=True)
            resp.raise_for_status()
            feed = feedparser.parse(resp.text)
            for entry in feed.entries[:max_per_source]:
                url = entry.get("link", "")
                if not url:
                    continue
                raw_date = entry.get("published") or entry.get("updated") or ""
                pub_iso = _parse_date(raw_date)
                if pub_iso:
                    try:
                        pub_dt = datetime.fromisoformat(pub_iso.replace("Z", "+00:00"))
                        if pub_dt < cutoff_dt:
                            continue  # older than lookback window
                    except Exception:
                        pass
                content_list = entry.get("content", [])
                full_text = (
                    content_list[0].get("value", "") if content_list
                    else entry.get("summary", "")
                )
                # Extract best image from RSS media/enclosure fields (no extra HTTP request)
                og_image_url = ""
                media_thumbnails = entry.get("media_thumbnail", [])
                media_content = entry.get("media_content", [])
                enclosures = entry.get("enclosures", [])
                if media_thumbnails:
                    og_image_url = media_thumbnails[0].get("url", "")
                elif media_content:
                    for mc in media_content:
                        if "image" in mc.get("type", "") or mc.get("url", "").lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                            og_image_url = mc.get("url", "")
                            break
                elif enclosures:
                    for enc in enclosures:
                        if "image" in enc.get("type", ""):
                            og_image_url = enc.get("url", "")
                            break
                if not og_image_url:
                    og_image_url = _first_content_image(full_text, url)

                results.append(RawArticle(
                    url=url,
                    title=entry.get("title", ""),
                    full_text=full_text,
                    published_at=_parse_date(entry.get("published") or entry.get("updated") or ""),
                    source_id=source["id"],
                    og_image_url=og_image_url,
                ))
        except httpx.TimeoutException:
            # log and continue — partial crawl is acceptable
            pass
        except Exception:
            pass

    return results


def resolve_rss_url(site_url: str) -> dict:
    """Probe site_url for RSS via link tag, 4 path probes, then article-scrape fallback."""
    if os.getenv("MOCK_LLM", "false").lower() == "true":
        return {"rss_url": "https://example.com/feed", "method": "path_probe"}

    try:
        import httpx
    except ImportError:
        return {"rss_url": None, "method": "not_found"}

    from html.parser import HTMLParser

    _PATH_PROBES = ["/feed", "/rss", "/feed.xml", "/rss.xml"]

    class _LinkTagParser(HTMLParser):
        found: str | None = None

        def handle_starttag(self, tag: str, attrs: list) -> None:
            if tag != "link":
                return
            attr_map = dict(attrs)
            if (attr_map.get("rel") == "alternate"
                    and "rss" in attr_map.get("type", "").lower()
                    and attr_map.get("href")):
                self.found = attr_map["href"]

    parsed = urlparse(site_url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    try:
        resp = httpx.get(site_url, timeout=10.0, follow_redirects=True)
    except Exception:
        return {"rss_url": None, "method": "not_found"}

    # 1 — <link rel=alternate type=.../rss...>
    parser = _LinkTagParser()
    parser.feed(resp.text[:8192])
    if parser.found:
        href = parser.found
        if href.startswith("http"):
            rss = href
        elif href.startswith("/"):
            rss = base + href
        else:
            # relative path like "feed.xml" — prepend base + slash
            rss = base + "/" + href
        # Sanity check: must look like a URL
        if "://" in rss and "." in rss.split("://", 1)[1]:
            return {"rss_url": rss, "method": "link_tag"}

    # 2 — path probes
    for path in _PATH_PROBES:
        try:
            probe = httpx.get(base + path, timeout=5.0, follow_redirects=True)
            ct = probe.headers.get("content-type", "")
            if probe.status_code == 200 and ("xml" in ct or probe.text.lstrip().startswith("<?xml")):
                return {"rss_url": base + path, "method": "path_probe"}
        except Exception:
            continue

    # 3 — article tag scrape (signals direct-HTML source, no feed URL)
    if "<article" in resp.text:
        return {"rss_url": None, "method": "article_scrape"}

    return {"rss_url": None, "method": "not_found"}


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    os.environ["MOCK_LLM"] = "true"
    mock_sources: list[UserSource] = [
        {"id": "src-01", "url": "https://example.com", "rss_url": "https://example.com/feed", "source_tier": 2}
    ]
    articles = crawl_sources("mock-user-01", mock_sources)
    print(f"crawl_sources → {len(articles)} articles")
    for a in articles:
        print(f"  [{a['source_id']}] {a['title']} — {a['url']}")

    rss = resolve_rss_url("https://example.com")
    print(f"\nresolve_rss_url → {rss}")
