"""Tools package — exports all pipeline tool functions for eval harness use."""

from src.tools.crawl import crawl_sources, resolve_rss_url
from src.tools.summarise import summarise_article, embed_article
from src.tools.score import score_article
from src.tools.ideas import generate_daily_ideas
from src.tools.draft import generate_draft
from src.tools.feedback import update_topic_weights


def get_tools_list() -> list:
    """Return all tool functions as a flat list (for LangGraph tool binding in eval harness)."""
    return [
        crawl_sources,
        resolve_rss_url,
        summarise_article,
        embed_article,
        score_article,
        generate_daily_ideas,
        generate_draft,
        update_topic_weights,
    ]


__all__ = [
    "crawl_sources",
    "resolve_rss_url",
    "summarise_article",
    "embed_article",
    "score_article",
    "generate_daily_ideas",
    "generate_draft",
    "update_topic_weights",
    "get_tools_list",
]
