"""FastAPI backend for the GenAI Analyst Pipeline eval harness.

Provides three endpoints:
  POST /chat          — trigger pipeline run, return daily ideas
  GET  /stream/traces — SSE stream of pipeline node events
  GET  /health        — service health / config check
"""

from __future__ import annotations

import os
import asyncio
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from src.api.log_stream import get_events_stream
from src.observability import configure_logging, setup_phoenix, setup_langsmith, setup_arize_cloud

# Observability — set up before any route is registered so the first request is traced.
configure_logging()
setup_phoenix(project_name=os.getenv("PROJECT_SLUG", "genai-analyst-os"))
setup_langsmith()
setup_arize_cloud()


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="GenAI Analyst API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8501", "http://127.0.0.1:8501"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "type": type(exc).__name__},
    )


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    session_id: str
    provider: str | None = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    tool_calls_made: list[str]


# ---------------------------------------------------------------------------
# POST /chat
# ---------------------------------------------------------------------------

@app.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    """Trigger a pipeline run for the given user/session and return the result.

    The `message` field is used as user_id. `provider` overrides LLM_PROVIDER
    for this request only.
    """
    if body.provider:
        os.environ["LLM_PROVIDER"] = body.provider

    from src.graph import get_graph
    from src.state import PipelineState

    user_id = body.message or body.session_id
    is_mock = os.getenv("MOCK_LLM", "false").lower() == "true"
    initial_state = PipelineState(user_id=user_id, mock_mode=is_mock)

    graph = get_graph()
    config = {"configurable": {"thread_id": body.session_id}}

    tool_calls_made: list[str] = []
    final_state: dict[str, Any] = {}

    # Run synchronously in a thread so we don't block the event loop.
    def _run():
        return graph.invoke(initial_state, config=config)

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _run)

    if hasattr(result, "__dict__"):
        final_state = result.__dict__
    elif isinstance(result, dict):
        final_state = result

    ideas = final_state.get("daily_ideas", [])
    tool_calls_made = _infer_tool_calls(final_state)

    if ideas:
        reply = f"Generated {len(ideas)} ideas. Top: {ideas[0].get('angle_title', '')}"
    else:
        errors = final_state.get("errors", [])
        reply = f"Pipeline completed with {len(errors)} error(s)." if errors else "Pipeline completed."

    return ChatResponse(
        reply=reply,
        session_id=body.session_id,
        tool_calls_made=tool_calls_made,
    )


def _infer_tool_calls(state: dict[str, Any]) -> list[str]:
    """Derive which tools were likely called from populated state fields."""
    called = []
    if state.get("raw_articles"):
        called.extend(["crawl_sources"])
    if state.get("summaries"):
        called.extend(["summarise_article", "embed_article"])
    if state.get("feed_items"):
        called.append("score_article")
    if state.get("daily_ideas"):
        called.append("generate_daily_ideas")
    return called


# ---------------------------------------------------------------------------
# GET /stream/traces
# ---------------------------------------------------------------------------

@app.get("/stream/traces")
async def stream_traces() -> StreamingResponse:
    """SSE endpoint; streams node_start/node_end events from the running pipeline."""
    return StreamingResponse(
        get_events_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict[str, Any]:
    """Return service health, provider config, and graph metadata."""
    from src.graph import get_graph

    graph = get_graph()
    node_count = len(graph.nodes) if hasattr(graph, "nodes") else 0

    return {
        "status": "ok",
        "provider": os.getenv("LLM_PROVIDER", "anthropic"),
        "mock": os.getenv("MOCK_LLM", "false").lower() == "true",
        "graph_node_count": node_count,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
