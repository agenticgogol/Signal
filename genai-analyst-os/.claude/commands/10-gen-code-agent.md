Read `AGENTS.md`, `PROMPTS.md`, and the existing `src/state.py` and `src/tools/__init__.py`.

You are implementing the LangGraph agent. Follow AGENTS.md exactly for node names,
responsibilities, and routing rules.

1. Implement `src/nodes.py`:
   - One function per node defined in AGENTS.md.
   - Each function signature: `def node_name(state: AgentState) -> dict:`
   - Use `src.llm.provider.call_llm()` for any LLM calls (never call anthropic SDK directly).
   - Use the exact system prompt from PROMPTS.md for the primary reasoning node.
   - Emit a structured log event at the start and end of each node (will be used by SSE):
     ```python
     log_event({"type": "node_start", "node": "node_name", "input_preview": ...})
     ```
   - Keep each node function under 40 lines. Extract helpers if needed.

2. Implement `src/graph.py`:
   - Create a `build_graph()` function that returns a compiled LangGraph.
   - Use StateGraph(AgentState).
   - Add nodes from AGENTS.md using node functions from nodes.py.
   - Add edges and conditional edges following the Decision Rules in AGENTS.md.
   - Compile with SqliteSaver checkpointer from langgraph-checkpoint-sqlite.
   - Accept a `db_path` parameter (default "agent_state.db").
   - Add `get_graph()` function returning a singleton compiled graph.

3. In `src/nodes.py`, implement `log_event(event: dict)`:
   - Appends event to an asyncio.Queue in src/api/log_stream.py if it is running.
   - Otherwise writes to structlog (will be added in /add-observability).
   - Must not block or raise — wrap in try/except.

After writing, verify with:
```bash
MOCK_LLM=true .venv/bin/python -c "from src.graph import get_graph; g = get_graph(); print('Graph nodes:', list(g.nodes.keys()))"
```
Print output. Fix any errors.