Read the existing `src/nodes.py`, `src/graph.py`, `src/llm/provider.py`, and `.env.example`.

Make the following additions — do NOT change any agent logic, only add instrumentation:

─── LAYER 1: Arize Phoenix (local, zero config, always enabled) ──────────
Add `arize-phoenix>=4.0.0` and `opentelemetry-sdk>=1.25.0` to requirements.txt.

In `src/observability.py` (create if not exists), add:

```python
def setup_phoenix(project_name: str) -> None:
    """Start Arize Phoenix local trace UI on http://localhost:6006."""
    import phoenix as px
    from phoenix.trace.langchain import LangChainInstrumentor
    px.launch_app()                   # opens local UI; no-op if already running
    LangChainInstrumentor().instrument()   # auto-instruments all LangGraph runs
```

Call `setup_phoenix(project_name)` once at startup in `src/api/main.py` before
the FastAPI app starts — wrap in `try/except` so a missing package never blocks startup.

Phoenix auto-captures: every LangGraph node execution, all LLM calls with
token counts, tool invocations, latency, and errors. No manual span creation needed.

Add to `.env.example`:
```
# Arize Phoenix (local — no account needed)
PHOENIX_ENABLED=true          # set to false to disable
# PHOENIX_PORT=6006           # default port; change if in use
```

─── LAYER 2: Arize Cloud (optional, requires free account) ────────────────
In `src/observability.py`, add:

```python
def setup_arize_cloud() -> None:
    """Register with Arize cloud platform (optional)."""
    import os
    if not os.getenv("ARIZE_API_KEY"):
        return
    from arize.otel import register_otel, Endpoints
    register_otel(
        endpoints=Endpoints.ARIZE,
        space_id=os.environ["ARIZE_SPACE_ID"],
        api_key=os.environ["ARIZE_API_KEY"],
        model_id=os.environ.get("PROJECT_SLUG", "agentic-system"),
    )
```

Add to `.env.example`:
```
# Arize Cloud (optional — sign up at app.arize.com)
ARIZE_API_KEY=
ARIZE_SPACE_ID=
```

─── LAYER 3: LangSmith (optional, requires account) ──────────────────────
In `src/observability.py`, add:

```python
def setup_langsmith() -> None:
    """Configure LangSmith cloud tracing (optional)."""
    import os
    if os.getenv("LANGCHAIN_TRACING_V2") != "true":
        return
    os.environ.setdefault("LANGCHAIN_PROJECT", os.getenv("PROJECT_SLUG", "agentic-system"))
```

Add to `.env.example`:
```
# LangSmith (optional — sign up at smith.langchain.com)
LANGCHAIN_TRACING_V2=false
LANGCHAIN_API_KEY=ls__...
```

─── LAYER 4: structlog JSON logging ──────────────────────────────────────
In `src/observability.py`, add:

```python
import structlog, os

def configure_logging() -> None:
    """Configure structlog — JSON in prod, pretty in dev."""
    renderer = (
        structlog.dev.ConsoleRenderer()
        if os.getenv("LOG_FORMAT", "json") == "pretty"
        else structlog.processors.JSONRenderer()
    )
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.stdlib.add_log_level,
            structlog.processors.StackInfoRenderer(),
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(20),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
    )
```

In `src/nodes.py`:
- Add `import structlog; logger = structlog.get_logger()`
- At the START of every node: `logger.info("node_start", node="node_name", session_id=state.get("session_id"))`
- At the END of every node: `logger.info("node_end", node="node_name", output_keys=list(output.keys()))`

─── LAYER 5: LLM cost tracking via SSE ──────────────────────────────────
In `src/llm/provider.py`, after every successful LiteLLM completion:

```python
try:
    cost = litellm.completion_cost(completion_response=response)
    log_event({"type": "llm_cost", "model": model, "input_tokens": response.usage.prompt_tokens,
               "output_tokens": response.usage.completion_tokens, "cost_usd": round(cost, 6)})
except Exception:
    pass   # cost tracking must never block
```

─── STARTUP WIRING ───────────────────────────────────────────────────────
In `src/api/main.py`, at module level (before app routes):

```python
from src.observability import configure_logging, setup_phoenix, setup_langsmith, setup_arize_cloud
configure_logging()
setup_phoenix(project_name=os.getenv("PROJECT_SLUG", "agent"))
setup_langsmith()
setup_arize_cloud()
```

─── VERIFY ───────────────────────────────────────────────────────────────
After all changes:
```bash
.venv/bin/pip install arize-phoenix opentelemetry-sdk --quiet
.venv/bin/python -c "from src.observability import configure_logging; configure_logging(); print('OK')"
.venv/bin/python -c "from src.graph import get_graph; print('Graph OK')"
```
Print "Observability added." List every modified file and which observability
layer each file supports. Note the Phoenix UI URL: http://localhost:6006