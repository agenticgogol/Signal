Read `prd.md` and `technical_design.md`.

1. Create `project_structure.md` documenting the full directory tree
   in ASCII with a one-line purpose for each file and folder.

2. Create the actual directory structure on disk using mkdir -p and
   touch to create empty placeholder files. Use this template structure,
   adapting names from the technical design:

```
src/
  __init__.py
  state.py              ← AgentState TypedDict
  graph.py              ← LangGraph StateGraph definition
  nodes.py              ← all node functions
  tools/
    __init__.py
    [tool_name].py      ← one file per logical tool group
  llm/
    __init__.py
    provider.py         ← already created by /setup-env
  api/
    __init__.py
    main.py             ← FastAPI app
    log_stream.py       ← asyncio.Queue for SSE
knowledge/              ← captures Mode A test results and feedback
  .gitkeep
mcp/
  config.json           ← Claude Desktop MCP config
data/
  [mock data files]
chat_app.py             ← Streamlit chat frontend
dashboard_app.py        ← Streamlit dashboard frontend
.claude/
  skills/               ← project-specific agent simulation skills
    run-as-agent.md
    validate-specs.md
```

For each .py file created, add a one-line module docstring comment at the top.
Do NOT write any implementation code yet — only structure.

Print the tree after creation.