"""GenAI Analyst OS — Dashboard UI (eval harness frontend).

Tabs:
  Pipeline  — trigger crawl/ideas run, live trace panel, topic weights
  Sources   — add/remove content sources without touching Supabase manually
  Ideas     — view today's generated idea cards

Connects to the local FastAPI backend at src/api/main.py.
"""

from __future__ import annotations

import json
import os
import queue
import sys
import threading
import uuid
from datetime import datetime
from pathlib import Path

import httpx
import streamlit as st
from dotenv import load_dotenv

# Allow importing src/ when running from project root
sys.path.insert(0, str(Path(__file__).parent))

# Load .env once at startup so Supabase keys and MOCK_LLM are available
load_dotenv(Path(__file__).parent / ".env")

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="GenAI Analyst OS — Dashboard",
    page_icon="📊",
    layout="wide",
)

# ---------------------------------------------------------------------------
# Session state
# ---------------------------------------------------------------------------

for _key, _default in [
    ("session_id", str(uuid.uuid4())),
    ("trace_events", []),
    ("trace_thread_started", False),
    ("trace_queue", queue.Queue()),
    ("last_reply", ""),
    ("last_tool_calls", []),
    ("resolved_user_id", ""),
]:
    if _key not in st.session_state:
        st.session_state[_key] = _default

# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------

with st.sidebar:
    st.title("⚙️ Settings")

    _env_mock = os.getenv("MOCK_LLM", "false").lower() == "true"
    mock_mode = st.toggle("Mock Mode (no API key needed)", value=_env_mock)
    if mock_mode:
        os.environ["MOCK_LLM"] = "true"
    else:
        os.environ.pop("MOCK_LLM", None)

    provider = st.selectbox(
        "LLM Provider",
        options=["anthropic", "openai", "groq"],
        index=0,
        disabled=mock_mode,
    )

    api_key = st.text_input(
        "API Key",
        type="password",
        placeholder="Not needed in mock mode",
        disabled=mock_mode,
    )
    if api_key and not mock_mode:
        key_env = {"anthropic": "ANTHROPIC_API_KEY", "openai": "OPENAI_API_KEY", "groq": "GROQ_API_KEY"}
        os.environ[key_env[provider]] = api_key

    backend_url = st.text_input("Backend URL", value="http://localhost:8000")

    st.divider()

    # Account email for user_id resolution (real mode only)
    account_email = st.text_input(
        "Your account email",
        value=os.getenv("ACCOUNT_EMAIL", ""),
        placeholder="utsab.chakraborty@gmail.com",
        help="Used to look up your Supabase user ID in real mode.",
        disabled=mock_mode,
    )

    st.caption(f"Session: `{st.session_state.session_id[:8]}…`")
    if st.session_state.resolved_user_id and not mock_mode:
        st.caption(f"User ID: `{st.session_state.resolved_user_id[:8]}…`")

    if st.button("Check Backend Health"):
        try:
            r = httpx.get(f"{backend_url}/health", timeout=3.0)
            d = r.json()
            st.success(
                f"✅ OK — provider: {d.get('provider')}, "
                f"mock: {d.get('mock')}, nodes: {d.get('graph_node_count')}"
            )
        except Exception as exc:
            st.error(f"❌ {exc}")


# ---------------------------------------------------------------------------
# Helpers: user ID resolution and Supabase client
# ---------------------------------------------------------------------------

def _get_user_id() -> str:
    """Return mock ID in mock mode; look up by email in real mode."""
    if mock_mode:
        return "mock-user-01"
    if st.session_state.resolved_user_id:
        return st.session_state.resolved_user_id
    if not account_email:
        st.warning("Enter your account email in the sidebar to use real mode.")
        return ""
    try:
        from src.db import get_client
        db = get_client()
        users = db.auth.admin.list_users()
        for u in users:
            if hasattr(u, "email") and u.email == account_email:
                st.session_state.resolved_user_id = str(u.id)
                return st.session_state.resolved_user_id
        st.error(f"No account found for {account_email}. Sign up at your Supabase project URL first.")
    except Exception as exc:
        st.error(f"Could not look up user: {exc}")
    return ""


def _get_db():
    """Return Supabase client or None in mock mode."""
    if mock_mode:
        return None
    try:
        from src.db import get_client
        return get_client()
    except Exception as exc:
        st.error(f"Supabase not configured: {exc}")
        return None


# ---------------------------------------------------------------------------
# SSE trace polling (background thread)
# ---------------------------------------------------------------------------

def _poll_traces(url: str, q: queue.Queue) -> None:
    try:
        with httpx.stream("GET", f"{url}/stream/traces", timeout=None) as r:
            for line in r.iter_lines():
                if line.startswith("data:"):
                    payload = line[5:].strip()
                    if payload:
                        try:
                            q.put(json.loads(payload))
                        except json.JSONDecodeError:
                            pass
    except Exception:
        pass


if not st.session_state.trace_thread_started:
    t = threading.Thread(target=_poll_traces, args=(backend_url, st.session_state.trace_queue), daemon=True)
    t.start()
    st.session_state.trace_thread_started = True

while not st.session_state.trace_queue.empty():
    try:
        st.session_state.trace_events.append(st.session_state.trace_queue.get_nowait())
    except queue.Empty:
        break
st.session_state.trace_events = st.session_state.trace_events[-10:]


# ---------------------------------------------------------------------------
# Main UI — tabs
# ---------------------------------------------------------------------------

st.title("📊 GenAI Analyst OS — Dashboard")

tab_pipeline, tab_feed, tab_sources, tab_ideas = st.tabs(["🚀 Pipeline", "📰 Today's Feed", "🗂 Sources", "💡 Ideas"])


# ══════════════════════════════════════════════════════════════════════════════
# TAB 1 — Pipeline
# ══════════════════════════════════════════════════════════════════════════════

with tab_pipeline:
    left_col, right_col = st.columns([3, 2], gap="large")

    with left_col:
        st.subheader("Run Pipeline")

        with st.form("pipeline_form"):
            style_seed = st.selectbox(
                "Writing Style",
                options=["practitioner", "technical", "business", "beginner-friendly"],
                index=0,
            )
            col_a, col_b = st.columns(2)
            run_button = col_a.form_submit_button("▶ Run Pipeline", use_container_width=True, type="primary")
            col_b.form_submit_button("↺ Reset", use_container_width=True)

        if run_button:
            uid = _get_user_id()
            if uid:
                st.session_state.pipeline_running = True
                st.session_state.trace_events = []   # clear old traces
                result_holder = st.empty()
                trace_live = st.empty()
                with st.spinner("Running pipeline… (2–4 min — traces update in real time below)"):
                    try:
                        payload = {
                            "message":    uid,
                            "session_id": st.session_state.session_id,
                            "provider":   None if mock_mode else provider,
                            "style_seed": style_seed,
                        }
                        r = httpx.post(f"{backend_url}/chat", json=payload, timeout=360.0)
                        r.raise_for_status()
                        data = r.json()
                        st.session_state.last_reply = data.get("reply", "")
                        st.session_state.last_tool_calls = data.get("tool_calls_made", [])
                    except httpx.TimeoutException:
                        st.session_state.last_reply = "Pipeline is still running in background — check Terminal 1 logs."
                    except Exception as exc:
                        st.error(f"Pipeline failed: {exc}")
                st.session_state.pipeline_running = False

        if st.session_state.last_reply:
            st.divider()
            st.success(st.session_state.last_reply)
            if st.session_state.last_tool_calls:
                st.markdown("**Tools executed:** " + "  ".join(f"`{t}`" for t in st.session_state.last_tool_calls))

        with st.expander("📡 Trace log", expanded=bool(st.session_state.trace_events)):
            if st.session_state.trace_events:
                st.code("\n".join(json.dumps(e) for e in st.session_state.trace_events), language="json")
            else:
                st.caption("Traces appear here while the pipeline runs.")

    with right_col:
        st.subheader("📡 Live Traces")
        trace_box = st.empty()
        events = st.session_state.trace_events
        if events:
            lines = []
            for ev in reversed(events):
                icon = "▶" if ev.get("type") == "node_start" else "✔" if ev.get("type") == "node_end" else "⚠"
                detail = ev.get("input_preview") or ev.get("output_summary") or ""
                lines.append(f"{icon} **{ev.get('node','')}** — {detail}")
            trace_box.markdown("\n\n".join(lines))
        else:
            trace_box.info("Waiting for pipeline events…")

        if st.button("🔄 Refresh"):
            st.rerun()

        st.divider()
        st.subheader("📈 Topic Weights")
        _TAGS = ["agents", "evals", "fine-tuning", "rag", "multimodal",
                 "reasoning", "infrastructure", "safety", "hardware", "products", "research"]
        weights = {t: 0.5 for t in _TAGS}
        if not mock_mode:
            uid = st.session_state.resolved_user_id
            db = _get_db()
            if db and uid:
                try:
                    resp = db.table("user_profiles").select("topic_weights").eq("id", uid).maybe_single().execute()
                    if resp.data:
                        weights = {k: float(v) for k, v in resp.data["topic_weights"].items()}
                except Exception:
                    pass
        st.bar_chart(weights, height=220)


# ══════════════════════════════════════════════════════════════════════════════
# TAB 2 — Today's Feed
# ══════════════════════════════════════════════════════════════════════════════

with tab_feed:
    st.subheader("📰 Today's Ranked Feed")
    st.caption("Articles crawled, summarised, and ranked by your topic interests — most relevant first.")

    uid = _get_user_id()

    if mock_mode:
        st.info("Disable Mock Mode and run the pipeline to see today's articles here.")
    elif uid:
        db = _get_db()
        if db:
            try:
                # Load ranked feed items joined with article data
                feed_resp = (
                    db.table("user_feed_items")
                    .select("blend_score, articles(id, url, title, tldr_bullets, topic_tags, depth_score, published_at, source_id)")
                    .eq("user_id", uid)
                    .order("blend_score", desc=True)
                    .limit(50)
                    .execute()
                )
                items = feed_resp.data or []

                # Also load source URLs for attribution
                src_resp = db.table("user_sources").select("id, url").eq("user_id", uid).execute()
                src_map = {s["id"]: s["url"] for s in (src_resp.data or [])}

                if not items:
                    st.info("No feed items yet — run the pipeline first (Pipeline tab).")
                else:
                    # Filter controls
                    col_f1, col_f2 = st.columns([2, 2])
                    all_tags = ["agents", "evals", "fine-tuning", "rag", "multimodal",
                                "reasoning", "infrastructure", "safety", "hardware", "products", "research"]
                    tag_filter = col_f1.multiselect("Filter by topic", options=all_tags, default=[])
                    depth_filter = col_f2.slider("Min depth score", min_value=1, max_value=5, value=1)

                    st.caption(f"{len(items)} articles in today's feed")
                    st.divider()

                    shown = 0
                    for item in items:
                        art = item.get("articles") or {}
                        if not art:
                            continue
                        tags = art.get("topic_tags") or []
                        depth = art.get("depth_score") or 1
                        if tag_filter and not any(t in tags for t in tag_filter):
                            continue
                        if depth < depth_filter:
                            continue

                        shown += 1
                        score = item.get("blend_score", 0)
                        url = art.get("url", "")
                        title = art.get("title") or url
                        bullets = art.get("tldr_bullets") or []
                        pub = (art.get("published_at") or "")[:10]
                        source_url = src_map.get(art.get("source_id") or "", "")
                        source_domain = source_url.replace("https://", "").replace("http://", "").split("/")[0] if source_url else "unknown"

                        depth_stars = "★" * depth + "☆" * (5 - depth)
                        tag_pills = "  ".join(f"`{t}`" for t in tags)

                        with st.container(border=True):
                            c1, c2 = st.columns([5, 1])
                            c1.markdown(f"### [{title}]({url})")
                            c1.caption(f"📡 {source_domain}  ·  {pub}  ·  {depth_stars}  ·  score: {score:.2f}")
                            c2.markdown(tag_pills)
                            if bullets:
                                for b in bullets:
                                    st.markdown(f"• {b}")

                    if shown == 0:
                        st.info("No articles match the current filters.")

            except Exception as exc:
                st.error(f"Could not load feed: {exc}")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 3 — Sources
# ══════════════════════════════════════════════════════════════════════════════

with tab_sources:
    st.subheader("Manage Content Sources")

    # What works / what doesn't
    with st.expander("ℹ️ What URL types are supported?", expanded=False):
        st.markdown("""
| | URL type | Example |
|---|---|---|
| ✅ | Personal blogs / newsletters | `simonwillison.net`, `eugeneyan.com` |
| ✅ | Substack | `latent.space`, `xxx.substack.com` |
| ✅ | Medium publications | `towardsdatascience.com` |
| ✅ | Medium personal | `medium.com/@username` |
| ✅ | arXiv category | `arxiv.org/rss/cs.AI` |
| ✅ | Hugging Face / Papers w/ Code blog | paste the blog URL |
| ✅ | Any page with an RSS `<link>` tag | auto-detected |
| ⚠️ | Newspapers (NYT, Guardian) | RSS exists but articles often paywalled |
| ❌ | LinkedIn profiles / company pages | no public RSS |
| ❌ | Twitter / X | public RSS removed; paid API required |

**Paste any URL — RSS is detected automatically.**
You can also paste a direct RSS/Atom URL and it will be used as-is.
        """)

    st.divider()

    # ── Add a new source ──
    st.markdown("### Add a source")

    col1, col2 = st.columns([4, 1])
    new_url = col1.text_input(
        "URL",
        placeholder="https://simonwillison.net  or  https://arxiv.org/rss/cs.AI",
        label_visibility="collapsed",
    )
    add_pressed = col2.button("Add", use_container_width=True, type="primary")

    if add_pressed and new_url.strip():
        uid = _get_user_id()
        if uid:
            with st.spinner(f"Resolving RSS for {new_url.strip()} …"):
                if mock_mode:
                    st.info("Mock mode — source not persisted to DB. Disable Mock Mode to save real sources.")
                else:
                    try:
                        from scripts.add_source import add_source as _add_source
                        result = _add_source(uid, new_url.strip(), verbose=False)
                        rss = result.get("rss_url", "none")
                        method = result.get("rss_detection_method", "")
                        st.success(f"✅ Added — RSS: `{rss}` (method: {method})")
                    except Exception as exc:
                        st.error(f"Failed: {exc}")

    # ── Bulk add from text area ──
    with st.expander("Bulk add (paste multiple URLs)"):
        bulk_text = st.text_area(
            "One URL per line. Lines starting with # are ignored.",
            height=150,
            placeholder="https://simonwillison.net\nhttps://lilianweng.github.io\nhttps://arxiv.org/rss/cs.AI",
        )
        if st.button("Add all", key="bulk_add"):
            uid = _get_user_id()
            if uid and bulk_text.strip():
                urls = [l.split("#")[0].strip() for l in bulk_text.splitlines()
                        if l.strip() and not l.strip().startswith("#")]
                if mock_mode:
                    st.info(f"Mock mode — would add {len(urls)} source(s). Disable Mock Mode to persist.")
                else:
                    added, failed = 0, 0
                    prog = st.progress(0)
                    from scripts.add_source import add_source as _add_source
                    for i, url in enumerate(urls):
                        try:
                            _add_source(uid, url, verbose=False)
                            added += 1
                        except Exception:
                            failed += 1
                        prog.progress((i + 1) / len(urls))
                    st.success(f"Done — added: {added}, failed/skipped: {failed}")

    st.divider()

    # ── Current sources list ──
    st.markdown("### Your current sources")

    uid = _get_user_id()
    if mock_mode:
        st.info("Mock mode is on — sources are loaded from `data/mock_articles.json`. "
                "Disable Mock Mode and enter your email to manage real sources.")
    elif uid:
        db = _get_db()
        if db:
            try:
                resp = db.table("user_sources").select("*").eq("user_id", uid).order("created_at", desc=True).execute()
                sources = resp.data or []
                if not sources:
                    st.info("No sources yet. Add some above — start with the suggested feeds in `scripts/my_sources.txt`.")
                else:
                    st.caption(f"{len(sources)} source(s) configured")
                    for src in sources:
                        c1, c2, c3, c4 = st.columns([3, 3, 1, 1])
                        c1.markdown(f"**{src['url']}**")
                        rss = src.get("rss_url") or "—"
                        c2.caption(rss if len(rss) < 60 else rss[:57] + "…")
                        tier_label = {1: "🥇 Tier 1", 2: "🥈 Tier 2", 3: "🥉 Tier 3"}.get(src.get("source_tier", 2), "")
                        c3.caption(tier_label)
                        if c4.button("Remove", key=f"del_{src['id']}"):
                            db.table("user_sources").delete().eq("id", src["id"]).execute()
                            st.rerun()
            except Exception as exc:
                st.error(f"Could not load sources: {exc}")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 3 — Ideas
# ══════════════════════════════════════════════════════════════════════════════

with tab_ideas:
    st.subheader("Today's Content Ideas")

    uid = _get_user_id()

    if mock_mode:
        st.info("Run the pipeline in mock mode (Pipeline tab) to see generated ideas here.")
    elif uid:
        db = _get_db()
        if db:
            try:
                from datetime import date
                today = str(date.today())
                resp = (
                    db.table("daily_ideas")
                    .select("*")
                    .eq("user_id", uid)
                    .eq("idea_date", today)
                    .order("position")
                    .execute()
                )
                ideas = resp.data or []
                if not ideas:
                    st.info(f"No ideas for {today} yet. Run the pipeline to generate them.")
                else:
                    # Also load this user's plan for blur logic
                    profile_resp = db.table("user_profiles").select("plan, is_admin").eq("id", uid).maybe_single().execute()
                    is_pro = False
                    if profile_resp.data:
                        is_pro = profile_resp.data.get("plan") == "pro" or profile_resp.data.get("is_admin")

                    for idea in ideas:
                        pos = idea["position"]
                        blurred = pos > 3 and not is_pro
                        with st.container(border=True):
                            badge = "🔵 Substack" if idea["format"] == "substack" else "🔷 LinkedIn"
                            st.markdown(f"**#{pos} — {idea['angle_title']}** &nbsp; {badge}")
                            if blurred:
                                st.caption("🔒 Upgrade to Pro to see the hook and rationale for this idea.")
                            else:
                                if idea.get("hook_sentence"):
                                    st.markdown(f"*{idea['hook_sentence']}*")
                                if idea.get("rationale"):
                                    st.caption(f"Why: {idea['rationale']}")
            except Exception as exc:
                st.error(f"Could not load ideas: {exc}")
