from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import TypedDict

import httpx

from src.tools.ideas import ArticleSummary
from src.user_llm import get_user_llm_settings
from src.llm.provider import call_llm


class DailyDigest(TypedDict):
    headline: str
    signal: str
    highlights: list[dict[str, str]]
    takeaway: str


def _as_article_block(top_articles: list[ArticleSummary]) -> str:
    return "\n\n".join(
        f"[{idx + 1}] {article['title']}\n"
        f"Tags: {', '.join(article['topic_tags'])}\n"
        f"Published: {article['published_at']}\n"
        f"Summary:\n" + "\n".join(f"- {bullet}" for bullet in article["tldr_bullets"][:3])
        for idx, article in enumerate(top_articles[:10])
    )


def _validate_digest(obj: object) -> DailyDigest | None:
    if not isinstance(obj, dict):
        return None
    headline = str(obj.get("headline") or "").strip()
    signal = str(obj.get("signal") or "").strip()
    takeaway = str(obj.get("takeaway") or "").strip()
    highlights_raw = obj.get("highlights")
    if not headline or not signal or not takeaway or not isinstance(highlights_raw, list):
        return None
    highlights: list[dict[str, str]] = []
    for item in highlights_raw[:4]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        why = str(item.get("why") or "").strip()
        if title and why:
            highlights.append({"title": title, "why": why})
    if len(highlights) < 3:
        return None
    return DailyDigest(headline=headline, signal=signal, highlights=highlights[:4], takeaway=takeaway)


def generate_daily_digest(user_id: str, top_articles: list[ArticleSummary], style_seed: str) -> DailyDigest | None:
    if not top_articles:
        return None
    user_llm = get_user_llm_settings(user_id)
    if not user_llm.api_key:
        return None

    system = (
        f"You are an elite editor writing a fabulous daily AI intelligence brief for a {style_seed} GenAI practitioner. "
        "Write with narrative energy and sharp synthesis, not bullet sludge. "
        "Return only valid JSON with keys: headline (string), signal (string), highlights (array of 3-4 objects with title and why), takeaway (string)."
    )
    prompt = (
        "Turn these top-ranked articles into a consolidated daily story. "
        "Explain what moved today, what pattern connects the stories, and what a serious AI builder should pay attention to next.\n\n"
        f"{_as_article_block(top_articles)}"
    )
    try:
        resp = call_llm(
            messages=[{"role": "user", "content": prompt}],
            system=system,
            tier="primary",
            provider=user_llm.provider,
            model=user_llm.model,
            api_key=user_llm.api_key,
        )
        raw = (resp.choices[0].message.content or "").strip()
        import json
        cleaned = raw.replace("```json", "").replace("```", "").strip()
        return _validate_digest(json.loads(cleaned))
    except Exception:
        return None


def send_daily_digest_email(to_email: str, digest: DailyDigest, article_count: int, dominant_topics: list[str]) -> bool:
    resend_key = os.getenv("RESEND_API_KEY", "").strip()
    email_from = os.getenv("EMAIL_FROM", "").strip()
    if not resend_key or not email_from or not to_email:
        return False

    topic_line = " · ".join(dominant_topics[:3]) if dominant_topics else "AI daily highlights"
    highlight_html = "".join(
        f"<li style='margin:0 0 12px'><strong>{item['title']}</strong><br/><span style='color:#52525b'>{item['why']}</span></li>"
        for item in digest["highlights"]
    )
    html = f"""
      <div style="font-family:Inter,Arial,sans-serif;background:#fafafa;padding:32px;color:#111827">
        <div style="max-width:720px;margin:0 auto;background:white;border:1px solid #e5e7eb;border-radius:20px;padding:32px">
          <p style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#7c3aed;margin:0 0 12px">Signal Daily Digest</p>
          <h1 style="font-size:28px;line-height:1.15;margin:0 0 10px">{digest['headline']}</h1>
          <p style="font-size:13px;color:#71717a;margin:0 0 24px">{article_count} ranked articles reviewed · {topic_line}</p>
          <div style="font-size:15px;line-height:1.75;color:#27272a;white-space:pre-wrap;margin-bottom:24px">{digest['signal']}</div>
          <div style="border-radius:16px;background:#f5f3ff;padding:20px;margin-bottom:24px">
            <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7c3aed">Top highlights</p>
            <ol style="padding-left:18px;margin:0">{highlight_html}</ol>
          </div>
          <div style="border-top:1px solid #e5e7eb;padding-top:20px">
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f766e">Why this matters</p>
            <p style="margin:0;font-size:15px;line-height:1.75;color:#27272a">{digest['takeaway']}</p>
          </div>
        </div>
      </div>
    """

    payload = {
        "from": email_from,
        "to": [to_email],
        "subject": f"Signal Daily Digest · {datetime.now(timezone.utc).strftime('%b %d')}",
        "html": html,
    }
    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {resend_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=20.0,
        )
        return response.status_code < 300
    except Exception:
        return False
