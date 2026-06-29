Read `PROJECT_BRIEF.yaml` and `API.md`.

Create two Streamlit apps. Both share:
- Sidebar: provider selector (Anthropic / OpenAI / Groq), API key input (password),
  a "Mock Mode" toggle (sets MOCK_LLM=true, no key needed), backend URL input.
- A "Live Agent Traces" expander that polls GET /stream/traces (use httpx + threading)
  and displays the last 10 events in a scrollable code block.
- Session state for session_id (uuid4 generated on first load).

1. `chat_app.py` — Chat UI (description from frontend_a in PROJECT_BRIEF.yaml):
   - Title and subtitle from project.name and project.tagline.
   - Chat interface using st.chat_message() for user and assistant turns.
   - On submit: POST /chat → display reply as assistant message.
   - Show tool_calls_made from the response as small st.caption() pills below the reply.
   - Keep full conversation history in st.session_state.

2. `dashboard_app.py` — Dashboard UI (description from frontend_b in PROJECT_BRIEF.yaml):
   - Title matching the project.
   - Two columns: left = main interaction area, right = live trace panel (always visible).
   - Left column: project-specific input widgets (infer from YAML tools and PRD).
     e.g. for Portfolio Agent: stock ticker input + "Analyse" button.
   - When action triggered: POST /chat → render structured output (table, chart, or text).
   - Right column: auto-refresh trace panel every 2 seconds using st.empty().

For SSE polling, use this pattern (non-blocking, thread-safe):
```python
import threading, httpx, queue

def poll_traces(backend_url, event_queue):
    with httpx.stream("GET", f"{backend_url}/stream/traces", timeout=None) as r:
        for line in r.iter_lines():
            if line.startswith("data:"):
                event_queue.put(json.loads(line[5:].strip()))
```
Start the thread once per session; read from queue and display in UI.

After writing, validate syntax:
```bash
.venv/bin/python -m py_compile chat_app.py dashboard_app.py && echo "Syntax OK"
```
Print result.