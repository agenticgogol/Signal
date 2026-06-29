Read `STATE.md`, `TOOLS.md`, and `project_structure.md`.

You are implementing the foundation layer. Do not implement the agent logic yet.
Use the spec files as the source of truth — do not invent fields or tools not in the specs.

1. Implement `src/state.py`:
   - Define AgentState as a TypedDict using the fields from STATE.md.
   - Import only from langgraph.graph.message and typing.
   - Add a short docstring on the class.

2. For each tool group in TOOLS.md, implement `src/tools/[name].py`:
   - Implement each function with real logic (e.g. read from data/ files, compute values).
   - ALWAYS check for MOCK_LLM=true env var first; if true return the mock value from TOOLS.md.
   - Add proper type hints and a one-line docstring per function.
   - Handle the error cases listed in TOOLS.md — return a typed error dict, do not raise.
   - Keep tools pure functions (no global state, no LLM calls inside tools).

3. Create `src/tools/__init__.py` that exports a `get_tools_list()` function
   returning all tool functions as a flat list (for LangGraph tool binding).

4. Create mock data files in `data/` as needed by the tools:
   - Use realistic but synthetic data (no real PII).
   - Document the schema in a docstring at the top of each data file.

5. Write a quick smoke test at the bottom of each tool file:
   ```python
   if __name__ == "__main__":
       import os; os.environ["MOCK_LLM"] = "true"
       print(tool_name(test_arg))  # should print mock result
   ```

After writing, run:
```bash
.venv/bin/python -m src.tools.[first_tool_file]
```
Print the output. Fix any import errors before stopping.