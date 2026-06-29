"""Call Claude Sonnet with structured output to generate 5 daily idea angle cards."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal, TypedDict


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class ArticleSummary(TypedDict):
    id: str
    title: str
    tldr_bullets: list[str]
    topic_tags: list[str]
    depth_score: int
    published_at: str


class IdeaAngle(TypedDict):
    angle_title: str
    format: Literal["substack", "linkedin"]
    hook_sentence: str
    source_article_ids: list[str]
    rationale: str
    position: int


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_MOCK_PROFILE_PATH = Path(__file__).parent.parent.parent / "data" / "mock_user_profiles.json"


def _load_mock_ideas(top_articles: list[ArticleSummary]) -> list[IdeaAngle]:
    """Load mock ideas from fixture, constraining source_article_ids to provided article set."""
    valid_ids = {a["id"] for a in top_articles}
    if _MOCK_PROFILE_PATH.exists():
        profile = json.loads(_MOCK_PROFILE_PATH.read_text())
        raw_ideas = profile.get("mock_daily_ideas", [])
        ideas = []
        for i, idea in enumerate(raw_ideas[:5], start=1):
            safe_ids = [aid for aid in idea.get("source_article_ids", []) if aid in valid_ids]
            # Fall back to first available article if none of the fixture IDs are in scope
            if not safe_ids and top_articles:
                safe_ids = [top_articles[0]["id"]]
            ideas.append(IdeaAngle(
                angle_title=idea["angle_title"],
                format=idea["format"],
                hook_sentence=idea["hook_sentence"],
                source_article_ids=safe_ids,
                rationale=idea["rationale"],
                position=i,
            ))
        if len(ideas) == 5:
            return ideas

    # Inline fallback — generate from available article IDs
    article_ids = [a["id"] for a in top_articles[:3]] or ["art-01"]
    return [
        IdeaAngle(angle_title=f"Mock angle {i}", format="substack" if i % 2 else "linkedin",
                  hook_sentence=f"Mock hook sentence {i}.", source_article_ids=[article_ids[0]],
                  rationale="Mock rationale.", position=i)
        for i in range(1, 6)
    ]


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

_REQUIRED_KEYS = {"angle_title", "format", "hook_sentence", "source_article_ids", "rationale"}
_VALID_FORMATS = {"substack", "linkedin"}


def _validate_idea(obj: dict, valid_ids: set[str]) -> IdeaAngle | None:
    if not _REQUIRED_KEYS.issubset(obj.keys()):
        return None
    if obj["format"] not in _VALID_FORMATS:
        return None
    safe_ids = [aid for aid in obj.get("source_article_ids", []) if aid in valid_ids]
    if not safe_ids:
        return None
    return IdeaAngle(
        angle_title=str(obj["angle_title"]),
        format=obj["format"],
        hook_sentence=str(obj["hook_sentence"]),
        source_article_ids=safe_ids,
        rationale=str(obj["rationale"]),
        position=0,  # assigned by caller
    )


# ---------------------------------------------------------------------------
# Tool
# ---------------------------------------------------------------------------

def generate_daily_ideas(
    user_id: str,
    top_articles: list[ArticleSummary],
    style_seed: str,
) -> list[IdeaAngle]:
    """Call Claude Sonnet (structured output) to generate exactly 5 IdeaAngle objects."""
    if os.getenv("MOCK_LLM", "false").lower() == "true":
        return _load_mock_ideas(top_articles)

    from src.llm.provider import call_llm

    valid_ids = {a["id"] for a in top_articles}

    article_block = "\n".join(
        f"---\narticle_id: {a['id']}\ntitle: {a['title']}\n"
        f"published: {a['published_at']}\ntags: {', '.join(a['topic_tags'])}\n"
        f"depth: {a['depth_score']}/5\nsummary:\n" + "\n".join(f"- {b}" for b in a["tldr_bullets"])
        for a in top_articles
    )

    system = (
        f"You are a content strategy assistant for a {style_seed} GenAI practitioner. "
        "Generate exactly 5 content angle ideas as a JSON array. "
        "Each object must have: angle_title (string ≤80 chars), format ('substack'|'linkedin'), "
        "hook_sentence (string ≤200 chars), source_article_ids (array of 1-3 uuids from the list), "
        "rationale (string ≤300 chars). "
        "Return ONLY the JSON array — no markdown fences."
    )
    messages = [{"role": "user", "content": f"{article_block}\n\nGenerate 5 content angle ideas."}]

    for attempt in range(2):
        try:
            resp = call_llm(messages=messages, system=system, tier="primary")
            raw = resp.choices[0].message.content or ""
            data = json.loads(raw)
            if not isinstance(data, list):
                raise ValueError("expected list")
            ideas = [_validate_idea(obj, valid_ids) for obj in data]
            valid = [idea for idea in ideas if idea is not None]
            if len(valid) == 5:
                for i, idea in enumerate(valid, start=1):
                    idea["position"] = i
                return valid
        except Exception:
            if attempt == 0:
                messages[0]["content"] += (
                    "\n\nReturn ONLY a JSON array of exactly 5 objects. "
                    "Each must have angle_title, format, hook_sentence, source_article_ids, rationale."
                )
            continue

    return []


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    os.environ["MOCK_LLM"] = "true"
    import json as _json
    from pathlib import Path as _Path

    mock_path = _Path(__file__).parent.parent.parent / "data" / "mock_articles.json"
    articles: list[ArticleSummary] = []
    if mock_path.exists():
        raw = _json.loads(mock_path.read_text())
        articles = [ArticleSummary(id=a["id"], title=a["title"],
                                   tldr_bullets=a["tldr_bullets"], topic_tags=a["topic_tags"],
                                   depth_score=a["depth_score"], published_at=a["published_at"])
                    for a in raw[:10]]

    ideas = generate_daily_ideas("mock-user-01", articles, "practitioner")
    print(f"generate_daily_ideas → {len(ideas)} ideas")
    for idea in ideas:
        print(f"  [{idea['position']}] {idea['format'].upper()}: {idea['angle_title']}")
        print(f"      sources: {idea['source_article_ids']}")
