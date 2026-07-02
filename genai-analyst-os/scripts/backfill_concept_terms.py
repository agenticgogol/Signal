"""Backfill concept_terms for articles crawled before the AI Tutor feature
existed. Deliberately NOT a full re-summarization — articles already have
good tldr_bullets/why_it_matters/topic_tags; this only extracts the
missing concept_terms field, using the same platform-level fallback model
as the normal crawl pipeline (not any user's personal API key, since
articles are shared/global content, not user-billed).

Usage:
    .venv/bin/python -m scripts.backfill_concept_terms
    .venv/bin/python -m scripts.backfill_concept_terms --limit 50
    .venv/bin/python -m scripts.backfill_concept_terms --dry-run

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (same as
add_source.py), plus whatever platform LLM key the crawl pipeline
already uses (ANTHROPIC_API_KEY / OPENAI_API_KEY / etc).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

BATCH_SIZE = 20


def _strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    return re.sub(r"\s+", " ", text).strip()[:4000]


def extract_concept_terms(title: str, text: str) -> list[str]:
    """One small, cheap call — concept_terms only, not a full re-summary."""
    if os.getenv("MOCK_LLM", "false").lower() == "true":
        return ["mock term"]

    from src.llm.provider import call_llm

    system = (
        "You extract AI/technical terminology from an article for a glossary feature. "
        "Return ONLY a valid JSON object: {\"concept_terms\": [\"term1\", \"term2\"]}. "
        "0-6 genuine AI/technical terms a reader might not know and would benefit from a "
        "standalone explanation (e.g. 'RAG', 'LoRA fine-tuning', 'attention mechanism'). "
        "Empty list if none apply. No markdown fences, no commentary."
    )
    messages = [{"role": "user", "content": f"Title: {title}\n\nArticle text:\n{_strip_html(text)}"}]

    for attempt in range(2):
        try:
            resp = call_llm(messages=messages, system=system, tier="cheap")
            raw = (resp.choices[0].message.content or "").strip()
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw).strip()
            data = json.loads(raw)
            terms = [str(t).strip() for t in data.get("concept_terms", []) if str(t).strip()]
            return terms[:6]
        except (json.JSONDecodeError, KeyError, ValueError, AttributeError, IndexError):
            if attempt == 0:
                messages[0]["content"] += '\n\nReturn ONLY JSON, e.g. {"concept_terms":["RAG"]}'
            continue
        except Exception as exc:
            print(f"    LLM call failed: {exc}")
            return []
    return []


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill concept_terms for existing articles.")
    parser.add_argument("--limit", type=int, default=200, help="Max articles to process this run")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be extracted, don't write")
    args = parser.parse_args()

    from src.db import get_client
    db = get_client()

    processed = updated = skipped_empty = 0
    offset = 0

    while processed < args.limit:
        batch_limit = min(BATCH_SIZE, args.limit - processed)
        resp = (
            db.table("articles")
            .select("id, title, full_text, concept_terms")
            .or_("concept_terms.is.null,concept_terms.eq.{}")
            .range(offset, offset + batch_limit - 1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            break

        for row in rows:
            processed += 1
            title = row.get("title") or ""
            text = row.get("full_text") or ""
            if not text.strip():
                skipped_empty += 1
                continue

            terms = extract_concept_terms(title, text)
            print(f"  [{processed}] {title[:60]!r} → {terms}")

            if terms and not args.dry_run:
                db.table("articles").update({"concept_terms": terms}).eq("id", row["id"]).execute()
                updated += 1
            time.sleep(0.3)  # gentle pacing, not a burst against the LLM API

        offset += len(rows)

    print(f"\n{'─' * 55}")
    print(f"  Processed: {processed}   Updated: {updated}   Skipped (no text): {skipped_empty}")
    if args.dry_run:
        print("  (dry run — nothing was written)")


if __name__ == "__main__":
    main()
