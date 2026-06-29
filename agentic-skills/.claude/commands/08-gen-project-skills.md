Read `AGENTS.md`, `TOOLS.md`, `PROMPTS.md`, `skills.md`, and `PROJECT_BRIEF.yaml`.

Create `.claude/skills/` directory if it does not exist.

─── .claude/skills/run-as-agent.md ─────────────────────────────
Write a markdown instruction file that, when run as a Claude Code slash command,
causes Claude Code to SIMULATE this agent. The file must:

1. Start with: "You are now acting as [Agent Name] as defined in AGENTS.md."
2. List the tools from TOOLS.md with their mock return values (from TOOLS.md Mock behaviour).
3. List the decision rules from AGENTS.md.
4. Ask the user for a test input OR use a default from EVAL.md TC-01.
5. Walk through the full ReAct loop (or appropriate pattern) step by step:
   - Print: "THINKING: [reasoning]"
   - Print: "TOOL CALL: tool_name({params})"
   - Print: "TOOL RESULT: [mock result from TOOLS.md]"
   - Print: "REASONING: [updated reasoning]"
   - Print: "FINAL RESPONSE: [answer]"
6. After the simulation, print: "SIMULATION COMPLETE. Check knowledge/test-results.md for log."
7. Append a structured log entry to `knowledge/test-results.md`.

─── .claude/skills/validate-specs.md ───────────────────────────
Write a markdown instruction file that, when run, checks all spec files for
consistency and completeness:

1. Check that every tool in TOOLS.md is referenced in at least one node in AGENTS.md.
2. Check that every AgentState field in STATE.md is read or written by at least one node.
3. Check that every skill in skills.md uses at least one tool from TOOLS.md.
4. Check that every golden test case in EVAL.md exercises at least one tool.
5. Check that PROMPTS.md system prompt mentions all tool names from TOOLS.md.
6. Print PASS / FAIL for each check with a brief explanation.
7. Write results to `knowledge/validation-report.md`.

─── mcp/config.json ─────────────────────────────────────────────
Based on PROJECT_BRIEF.yaml mcp section, create the Claude Desktop MCP config:
```json
{
  "mcpServers": {
    "[server_name from YAML]": {
      "command": "python",
      "args": ["-m", "src.mcp_server"],
      "env": {
        "PYTHONPATH": ".",
        "MOCK_LLM": "true"
      }
    }
  }
}
```
If mcp.enabled is false in YAML, write the file with an empty mcpServers object
and add a comment in `knowledge/` noting MCP is disabled for this project.

Print: "Project skills generated. Ready for Mode A testing."