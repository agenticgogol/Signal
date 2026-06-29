"""Stream a Claude Sonnet draft (Substack or LinkedIn) given an angle and POV bullets."""

from __future__ import annotations

import os
from collections.abc import Generator
from typing import Literal, TypedDict


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class IdeaAngle(TypedDict):
    angle_title: str
    format: Literal["substack", "linkedin"]
    hook_sentence: str
    source_article_ids: list[str]
    rationale: str
    position: int


class ArticleSummary(TypedDict):
    id: str
    title: str
    tldr_bullets: list[str]
    topic_tags: list[str]
    depth_score: int
    published_at: str


# ---------------------------------------------------------------------------
# Mock response
# ---------------------------------------------------------------------------

_MOCK_SENTENCES = [
    "The teams shipping reliable LLM products aren't better at prompting.",
    "They're better at interface design.",
    "Every brittle prompt is a missing schema or guardrail.",
    "The best practitioners think about failure modes, not magic words.",
    "Start with the contract, not the call.",
]


# ---------------------------------------------------------------------------
# System prompt builders
# ---------------------------------------------------------------------------

def _build_system_prompt(format: Literal["substack", "linkedin"], style_seed: str) -> str:
    style_guide = {
        "technical": "precise terminology, concrete code or architecture examples, direct tone",
        "practitioner": "opinionated, assumes working knowledge, focuses on tradeoffs and implications",
        "business": "outcome-focused, avoids jargon, uses analogies and ROI framing",
        "beginner-friendly": "explains concepts from first principles, welcoming, uses relatable analogies",
    }.get(style_seed, "clear and direct")

    if format == "substack":
        return (
            f"You are a ghostwriter helping a {style_seed} GenAI practitioner publish on Substack. "
            f"Write in their voice, not yours. Style: {style_guide}. "
            "Target: 800–1200 words. Structure: hook (1-2 paras), context (2-3 paras), "
            "practitioner's take (2-3 paras), implications (1-2 paras), punchy close (1 para). "
            "Integrate POV bullets as the author's own voice — do not quote them verbatim. "
            "No title line. No self-referential phrases. No [N] citations."
        )
    else:  # linkedin
        return (
            f"You are a ghostwriter helping a {style_seed} GenAI practitioner publish on LinkedIn. "
            f"Write in their voice. Style: {style_guide}. "
            "Target: 900–1200 characters (not words). "
            "Line 1: hook ≤140 chars. Lines 2-8: 3-5 short paragraphs. Final line: question or CTA. "
            "No markdown. No hashtags. Single line breaks between paragraphs."
        )


def _build_user_message(
    angle: IdeaAngle,
    pov_bullets: list[str],
    source_articles: list[ArticleSummary],
    format: Literal["substack", "linkedin"],
) -> str:
    pov_block = "\n".join(f"- {b}" for b in pov_bullets)
    sources_block = "\n".join(
        f"- {a['title']} ({a['published_at']}): {a['tldr_bullets'][0] if a['tldr_bullets'] else ''}"
        for a in source_articles
    )
    return (
        f"Angle: {angle['angle_title']}\n"
        f"Format: {format}\n"
        f"Opening hook: {angle['hook_sentence']}\n\n"
        f"My POV notes:\n{pov_block}\n\n"
        f"Source articles:\n{sources_block}\n\n"
        f"Write the {format} post now."
    )


# ---------------------------------------------------------------------------
# Tool
# ---------------------------------------------------------------------------

def generate_draft(
    angle: IdeaAngle,
    pov_bullets: list[str],
    source_articles: list[ArticleSummary],
    format: Literal["substack", "linkedin"],
    style_seed: str,
) -> Generator[str, None, None]:
    """Stream a Claude Sonnet draft; yields text chunks. Caller assembles and persists on completion."""
    if os.getenv("MOCK_LLM", "false").lower() == "true":
        yield from _MOCK_SENTENCES
        return

    from src.llm.provider import stream_llm

    system = _build_system_prompt(format, style_seed)
    messages = [{"role": "user", "content": _build_user_message(angle, pov_bullets, source_articles, format)}]
    yield from stream_llm(messages=messages, system=system, tier="primary")


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    os.environ["MOCK_LLM"] = "true"
    angle = IdeaAngle(
        angle_title="Eval harnesses are the unit tests your LLM pipeline is missing",
        format="substack",
        hook_sentence="Most teams find regressions in prod, not in CI — because they never built the CI.",
        source_article_ids=["art-01", "art-08"],
        rationale="Evals are having a moment.",
        position=1,
    )
    pov = ["I've seen teams ship with zero eval harness", "Evals are contracts, not scores"]
    sources = [ArticleSummary(id="art-01", title="Implementing an Eval Harness for RAG Pipelines",
                              tldr_bullets=["Mock bullet 1"], topic_tags=["evals"], depth_score=4,
                              published_at="2026-06-28T10:00:00Z")]

    chunks = list(generate_draft(angle, pov, sources, "substack", "practitioner"))
    assembled = " ".join(chunks)
    print(f"generate_draft → {len(chunks)} chunks, {len(assembled.split())} words")
    print(f"Content: {assembled}")
