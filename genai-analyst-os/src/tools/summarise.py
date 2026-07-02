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
    why_it_matters: str       # ≤20 words, practitioner implication
    key_takeaways: list[str]  # exactly 3 actionable bullets
    concept_terms: list[str]  # 0–6 AI/technical terms worth an inline explanation (AI Tutor)


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
            why_it_matters="This changes how practitioners build agentic pipelines.",
            key_takeaways=["Core fact: mock article describes a new technique.", "Impact: reduces latency by an order of magnitude.", "Action: evaluate this approach for your next RAG build."],
            concept_terms=["RAG", "agentic pipeline"],
        )

    from src.llm.provider import call_llm

    system = (
        "You are a precise content analyst specialising in the GenAI and Agentic AI space. "
        "Return ONLY a valid JSON object with these keys:\n"
        "  tldr_bullets: list of 2-4 strings, each ≤20 words\n"
        "  topic_tags: list of 1-4 strings from the allowed taxonomy only\n"
        "  depth_score: integer 1-5\n"
        "  why_it_matters: single string ≤20 words — the practitioner implication (e.g. 'This changes how you architect RAG pipelines going forward')\n"
        "  key_takeaways: list of exactly 3 strings — bullet 1: core fact/development, bullet 2: specific impact or mechanism, bullet 3: what a practitioner should do or watch\n"
        "  concept_terms: list of 0-6 strings — AI/technical terms or concepts used in this article that a reader might not know and would benefit from a standalone explanation (e.g. 'RAG', 'LoRA fine-tuning', 'attention mechanism'). Only include genuine technical terminology, not generic words. Empty list if none apply.\n"
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
            why = str(data.get("why_it_matters", ""))[:200]
            takeaways = [str(t) for t in data.get("key_takeaways", [])][:3]
            concept_terms = [str(t).strip() for t in data.get("concept_terms", []) if str(t).strip()][:6]
            # Accept 1+ bullets and 1+ tags (relaxed from 2-4 / 1-4)
            if bullets and tags:
                return SummaryResult(
                    tldr_bullets=bullets[:5],
                    topic_tags=tags[:4],
                    depth_score=depth,
                    why_it_matters=why,
                    key_takeaways=takeaways,
                    concept_terms=concept_terms,
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
