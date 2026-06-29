"""GenAI Analyst OS — Chat UI (eval harness frontend).

Connects to the local FastAPI backend at src/api/main.py.
Triggers the pipeline via POST /chat and streams traces from GET /stream/traces.
"""

from __future__ import annotations

import json
import os
import queue
import threading
import uuid
from datetime import datetime

import httpx
import streamlit as st

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="GenAI Analyst OS",
    page_icon="🧠",
    layout="wide",
)

# ---------------------------------------------------------------------------
# Session state initialisation
# ---------------------------------------------------------------------------

if "session_id" not in st.session_state:
    st.session_state.session_id = str(uuid.uuid4())
if "messages" not in st.session_state:
    st.session_state.messages = []
if "trace_events" not in st.session_state:
    st.session_state.trace_events = []
if "trace_thread_started" not in st.session_state:
    st.session_state.trace_thread_started = False
if "trace_queue" not in st.session_state:
    st.session_state.trace_queue = queue.Queue()

# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------

with st.sidebar:
    st.title("⚙️ Settings")

    mock_mode = st.toggle("Mock Mode (no API key needed)", value=True)
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
        placeholder="sk-ant-... (not needed in mock mode)",
        disabled=mock_mode,
    )
    if api_key and not mock_mode:
        key_env = {"anthropic": "ANTHROPIC_API_KEY", "openai": "OPENAI_API_KEY", "groq": "GROQ_API_KEY"}
        os.environ[key_env[provider]] = api_key

    backend_url = st.text_input("Backend URL", value="http://localhost:8000")

    st.divider()
    st.caption(f"Session: `{st.session_state.session_id[:8]}…`")

    # Health check
    if st.button("Check Backend Health"):
        try:
            r = httpx.get(f"{backend_url}/health", timeout=3.0)
            data = r.json()
            st.success(
                f"✅ Backend OK — provider: {data.get('provider')}, "
                f"mock: {data.get('mock')}, nodes: {data.get('graph_node_count')}"
            )
        except Exception as exc:
            st.error(f"❌ Cannot reach backend: {exc}")

# ---------------------------------------------------------------------------
# SSE trace polling (background thread)
# ---------------------------------------------------------------------------

def _poll_traces(backend_url: str, event_q: queue.Queue) -> None:
    """Background thread: stream events from /stream/traces into event_q."""
    try:
        with httpx.stream("GET", f"{backend_url}/stream/traces", timeout=None) as r:
            for line in r.iter_lines():
                if line.startswith("data:"):
                    payload = line[5:].strip()
                    if payload:
                        try:
                            event_q.put(json.loads(payload))
                        except json.JSONDecodeError:
                            pass
    except Exception:
        pass  # connection closed or backend unreachable — silently stop


def _ensure_trace_thread(backend_url: str) -> None:
    if not st.session_state.trace_thread_started:
        t = threading.Thread(
            target=_poll_traces,
            args=(backend_url, st.session_state.trace_queue),
            daemon=True,
        )
        t.start()
        st.session_state.trace_thread_started = True


_ensure_trace_thread(backend_url)

# Drain the queue into session state (keep last 10)
while not st.session_state.trace_queue.empty():
    try:
        st.session_state.trace_events.append(st.session_state.trace_queue.get_nowait())
    except queue.Empty:
        break
st.session_state.trace_events = st.session_state.trace_events[-10:]

# ---------------------------------------------------------------------------
# Main UI
# ---------------------------------------------------------------------------

st.title("🧠 GenAI Analyst OS")
st.caption("Stay at the GenAI frontier and turn your POV into published content.")

# Live traces expander
with st.expander("📡 Live Agent Traces", expanded=False):
    if st.session_state.trace_events:
        lines = [json.dumps(e) for e in st.session_state.trace_events]
        st.code("\n".join(lines), language="json")
    else:
        st.caption("No trace events yet. Run a pipeline query to see live events here.")

st.divider()

# Render conversation history
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])
        if msg.get("tool_calls"):
            calls_text = "  ".join(f"`{t}`" for t in msg["tool_calls"])
            st.caption(f"Tools used: {calls_text}")

# Chat input
prompt = st.chat_input(
    "Enter a user ID to run the pipeline (e.g. 'mock-user-01'), or describe what you want…"
)

if prompt:
    # Display user message
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # Call backend
    with st.chat_message("assistant"):
        with st.spinner("Running pipeline…"):
            try:
                payload = {
                    "message": prompt,
                    "session_id": st.session_state.session_id,
                    "provider": None if mock_mode else provider,
                }
                r = httpx.post(
                    f"{backend_url}/chat",
                    json=payload,
                    timeout=60.0,
                )
                r.raise_for_status()
                data = r.json()
                reply = data.get("reply", "No reply returned.")
                tool_calls = data.get("tool_calls_made", [])
            except httpx.HTTPStatusError as exc:
                reply = f"⚠️ Backend error {exc.response.status_code}: {exc.response.text}"
                tool_calls = []
            except Exception as exc:
                reply = f"⚠️ Could not reach backend: {exc}"
                tool_calls = []

        st.markdown(reply)
        if tool_calls:
            calls_text = "  ".join(f"`{t}`" for t in tool_calls)
            st.caption(f"Tools used: {calls_text}")

    st.session_state.messages.append({
        "role": "assistant",
        "content": reply,
        "tool_calls": tool_calls,
        "timestamp": datetime.utcnow().isoformat(),
    })
    st.rerun()
