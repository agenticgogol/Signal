"""LangGraph StateGraph definition for the GenAI Analyst Pipeline eval harness.

Builds a compiled graph that mirrors the 6-node Edge Function pipeline from AGENTS.md.
Used for local evals and scripts only — production runs on Supabase Edge Functions.
"""

from __future__ import annotations

import os
from functools import lru_cache

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.sqlite import SqliteSaver

from src.state import PipelineState
from src.nodes import (
    crawler,
    summarise,
    rank,
    ideas,
    feedback,
    stripe_webhook,
    should_summarise,
    should_generate_ideas,
)


def build_graph(db_path: str = "agent_state.db"):
    """Build and compile the pipeline StateGraph with a SqliteSaver checkpointer."""
    import sqlite3
    conn = sqlite3.connect(db_path, check_same_thread=False)
    checkpointer = SqliteSaver(conn)

    graph = StateGraph(PipelineState)

    # --- Add nodes (one per AGENTS.md pipeline node) ---
    graph.add_node("crawler", crawler)
    graph.add_node("summarise", summarise)
    graph.add_node("rank", rank)
    graph.add_node("ideas", ideas)
    graph.add_node("feedback", feedback)
    graph.add_node("stripe_webhook", stripe_webhook)

    # --- Entry point ---
    graph.set_entry_point("crawler")

    # --- Edges following AGENTS.md pipeline flow ---
    # crawler → summarise (if new articles found) or rank (if nothing new)
    graph.add_conditional_edges("crawler", should_summarise, {
        "summarise": "summarise",
        "rank": "rank",
    })

    # summarise always flows to rank
    graph.add_edge("summarise", "rank")

    # rank → ideas (if any feed items scored) or END (empty crawl)
    graph.add_conditional_edges("rank", should_generate_ideas, {
        "ideas": "ideas",
        "__end__": END,
    })

    # ideas → END (pipeline complete)
    graph.add_edge("ideas", END)

    # feedback and stripe_webhook are standalone entry-point nodes (triggered on demand)
    # They are present in the graph but not connected to the main crawl flow
    graph.add_edge("feedback", END)
    graph.add_edge("stripe_webhook", END)

    return graph.compile(checkpointer=checkpointer)


@lru_cache(maxsize=1)
def get_graph(db_path: str = "agent_state.db"):
    """Return the singleton compiled graph (cached after first call)."""
    return build_graph(db_path=db_path)
