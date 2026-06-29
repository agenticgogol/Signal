"""Call Claude Haiku to generate tldr_bullets, topic_tags, and depth_score per article."""

from __future__ import annotations

import json
import os
import re
from typing import TypedDict


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

TOPIC_TAXONOMY = frozenset({
    "infra", "llm", "finetune", "rag", "agentic", "llmops", "eval",
})


class SummaryResult(TypedDict):
    tldr_bullets: list[str]   # 2–4 items
    topic_tags: list[str]     # subset of TOPIC_TAXONOMY
    depth_score: int          # 1–5


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

def _strip_html(text: str) -> str:
    """Remove HTML tags and collapse whitespace."""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)   # HTML entities
    return re.sub(r"\s+", " ", text).strip()[:4000]  # cap at 4k chars for Haiku


def summarise_article(article_text: str, title: str) -> SummaryResult | None:
    """Call Claude Haiku to extract tldr_bullets, topic_tags, depth_score; returns None on API failure."""
    if os.getenv("MOCK_LLM", "false").lower() == "true":
        return SummaryResult(
            tldr_bullets=["Mock bullet 1", "Mock bullet 2"],
            topic_tags=["agentic"],
            depth_score=3,
        )

    from src.llm.provider import call_llm

    system = (
        "You are a precise content analyst specialising in the GenAI and Agentic AI space. "
        "Return ONLY a valid JSON object with keys: tldr_bullets (list of 2-4 strings, each ≤20 words), "
        "topic_tags (list of 1-4 strings from the allowed taxonomy only), depth_score (integer 1-5). "
        "Taxonomy (use ONLY these 7 slugs): infra (GenAI Infrastructure), llm (LLM Advancements), finetune (Fine-tuning), rag (RAG & Agentic RAG), agentic (Agentic Systems & Usecases), llmops (LLMOps & Deployment), eval (AI Evaluation). "
        "Return ONLY the JSON object — no markdown fences, no commentary."
    )
    clean_text = _strip_html(article_text)
    messages = [{"role": "user", "content": f"Title: {title}\n\nArticle text:\n{clean_text}"}]

    for attempt in range(2):
        try:
            resp = call_llm(messages=messages, system=system, tier="cheap")
            raw = (resp.choices[0].message.content or "").strip()
            # strip markdown fences if model adds them
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw).strip()
            data = json.loads(raw)
            bullets = data.get("tldr_bullets", [])
            tags = [t for t in data.get("topic_tags", []) if t in TOPIC_TAXONOMY]
            depth = max(1, min(5, int(data.get("depth_score", 3))))
            # Accept 1+ bullets and 1+ tags (relaxed from 2-4 / 1-4)
            if bullets and tags:
                return SummaryResult(
                    tldr_bullets=bullets[:5],
                    topic_tags=tags[:4],
                    depth_score=depth,
                )
        except (json.JSONDecodeError, KeyError, ValueError):
            if attempt == 0:
                messages[0]["content"] += (
                    "\n\nReturn ONLY a JSON object. Example: "
                    '{"tldr_bullets":["point one","point two"],"topic_tags":["agents"],"depth_score":3}'
                )
            continue
        except Exception:
            return None

    return None


_embedding_model = None


def _get_embedding_model():
    """Lazy-load the gte-small model once; reuse across calls."""
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        # thenlper/gte-small is the same model Supabase uses for pgai.embed('gte-small', ...)
        _embedding_model = SentenceTransformer("thenlper/gte-small")
    return _embedding_model


def embed_article(text: str) -> list[float]:
    """Generate a 384-dim gte-small embedding for text.

    Mock mode: returns 384 zeros (no model load).
    Real mode: runs thenlper/gte-small locally — same weights Supabase pgai uses.
    The vector is stored in articles.embedding (vector(384)) via the INSERT in the summarise node.
    """
    if os.getenv("MOCK_LLM", "false").lower() == "true":
        return [0.0] * 384

    model = _get_embedding_model()
    vec = model.encode(text, normalize_embeddings=True)
    return vec.tolist()


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    os.environ["MOCK_LLM"] = "true"
    result = summarise_article(
        article_text="Most teams building RAG pipelines skip the eval harness entirely...",
        title="Implementing an Eval Harness for RAG Pipelines",
    )
    print(f"summarise_article → {result}")

    vec = embed_article("test text")
    print(f"embed_article → vector of length {len(vec)}, first value: {vec[0]}")
