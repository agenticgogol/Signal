"""Observability setup for the GenAI Analyst eval harness.

Four independent layers — each wrapped in try/except so a missing package or
missing env var never blocks startup:
  Layer 1: Arize Phoenix  — local trace UI, always enabled
  Layer 2: Arize Cloud    — optional, requires ARIZE_API_KEY + ARIZE_SPACE_ID
  Layer 3: LangSmith      — optional, requires LANGCHAIN_TRACING_V2=true + key
  Layer 4: structlog      — JSON (prod) or pretty (dev) console logging
"""

from __future__ import annotations

import os

import structlog


# ---------------------------------------------------------------------------
# Layer 4: structlog (set up first so every other layer can log)
# ---------------------------------------------------------------------------

def configure_logging() -> None:
    """Configure structlog — JSON in prod, pretty in dev (LOG_FORMAT=pretty)."""
    renderer: structlog.types.Processor
    if os.getenv("LOG_FORMAT", "json") == "pretty":
        renderer = structlog.dev.ConsoleRenderer()
    else:
        renderer = structlog.processors.JSONRenderer()

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


# ---------------------------------------------------------------------------
# Layer 1: Arize Phoenix (local, zero config)
# ---------------------------------------------------------------------------

def setup_phoenix(project_name: str = "agent") -> None:
    """Start Arize Phoenix local trace UI on http://localhost:6006."""
    if os.getenv("PHOENIX_ENABLED", "true").lower() != "true":
        return
    try:
        import phoenix as px
        from phoenix.trace.langchain import LangChainInstrumentor

        px.launch_app()
        LangChainInstrumentor().instrument()
        structlog.get_logger().info(
            "phoenix_started",
            url="http://localhost:6006",
            project=project_name,
        )
    except Exception as exc:
        structlog.get_logger().warning("phoenix_unavailable", reason=str(exc))


# ---------------------------------------------------------------------------
# Layer 2: Arize Cloud (optional)
# ---------------------------------------------------------------------------

def setup_arize_cloud() -> None:
    """Register with Arize cloud platform (optional)."""
    if not os.getenv("ARIZE_API_KEY"):
        return
    try:
        from arize.otel import register_otel, Endpoints

        register_otel(
            endpoints=Endpoints.ARIZE,
            space_id=os.environ["ARIZE_SPACE_ID"],
            api_key=os.environ["ARIZE_API_KEY"],
            model_id=os.environ.get("PROJECT_SLUG", "genai-analyst-os"),
        )
        structlog.get_logger().info("arize_cloud_registered", model_id=os.environ.get("PROJECT_SLUG"))
    except Exception as exc:
        structlog.get_logger().warning("arize_cloud_unavailable", reason=str(exc))


# ---------------------------------------------------------------------------
# Layer 3: LangSmith (optional)
# ---------------------------------------------------------------------------

def setup_langsmith() -> None:
    """Configure LangSmith cloud tracing (optional)."""
    if os.getenv("LANGCHAIN_TRACING_V2") != "true":
        return
    os.environ.setdefault("LANGCHAIN_PROJECT", os.getenv("PROJECT_SLUG", "genai-analyst-os"))
    structlog.get_logger().info(
        "langsmith_enabled",
        project=os.environ["LANGCHAIN_PROJECT"],
    )
