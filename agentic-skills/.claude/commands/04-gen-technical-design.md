Read `prd.md`.

Create `technical_design.md` with the following sections:

## Architecture Overview
Draw an ASCII diagram showing:
- The two Streamlit frontends (chat_app.py, dashboard_app.py)
- The FastAPI backend with SSE /stream/traces endpoint
- The LangGraph agent (nodes + edges)
- The tools layer
- The persistence layer (SQLite / ChromaDB / etc.)
- LangSmith (optional, shown as dashed line)

Use this style:
```
[chat_app.py] ──HTTP──▶ [FastAPI :8000]
                              │
                         [LangGraph]
                         ┌────┴────┐
                      [node_1] [node_2]
                              │
                         [SQLite]
```

## LangGraph State Machine
- Define the AgentState TypedDict fields (infer from PRD)
- List every node name and its single responsibility (1 sentence each)
- Describe each edge and any conditional routing logic

## Tool Signatures
For each tool in the PRD, write:
```python
def tool_name(param: type, ...) -> ReturnType:
    """One sentence description."""
```
(signatures only — no implementation)

## API Endpoints
List the FastAPI endpoints:
- POST /chat — input/output schema
- GET /stream/traces — SSE stream of agent events
- GET /health — health check

## Multi-Provider LLM Config
Explain how src/llm/provider.py is used in this project:
which tier (primary vs cheap) each node uses and why.

## Key Technical Risks
List 3 risks with mitigation strategies.

After writing, print: "Technical design complete. [N] nodes, [N] tools, [N] API endpoints."