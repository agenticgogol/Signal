Read `AGENTS.md` and `TOOLS.md`.

Create three files:

─── PROMPTS.md ──────────────────────────────────────────────────
Write the full prompt templates used by this agent:

# Prompts Specification

## System Prompt
Write the complete system prompt for the primary LLM node. Include:
- Agent role and persona
- Available tools (list them as the LLM will see them)
- Output format instructions
- Constraints and safety rules
- Tone and style

## Tool Result Formatting Prompt
A short prompt snippet appended when tool results are returned to the LLM,
instructing it how to interpret and cite the tool output.

## Error Recovery Prompt
A snippet used when a tool call fails, instructing the agent to either
retry with different parameters or gracefully explain the failure.

─── EVAL.md ─────────────────────────────────────────────────────
Define the golden test set and evaluation criteria:

# Evaluation Specification

## Golden Test Cases
Write exactly 5 test cases. Format:

### TC-01: [Name]
- **Input**: the exact user message
- **Setup**: what mock data / state is needed
- **Expected tool calls**: which tools, in what order, with what args
- **Expected final output**: key phrases that must appear
- **Failure signals**: what would indicate the agent is wrong

## Evaluation Dimensions
Define how to score each response:
- Correctness (0–2): ...
- Tool use efficiency (0–2): ...
- Format compliance (0–1): ...
- Hallucination check (0–1): ...

## Regression Checks
List 3 things that MUST NOT happen (negative tests).

─── API.md ──────────────────────────────────────────────────────
Document the backend API contract:

# API Specification

## POST /chat
- Request body schema (JSON)
- Response body schema (JSON)
- Status codes and error shapes

## GET /stream/traces
- SSE event format: `data: {"type": "node_start"|"tool_call"|"node_end"|"error", ...}`
- How frontends should subscribe and display events

## GET /health
- Response: `{"status": "ok", "provider": "anthropic", "mock": false}`

After creating all files, print: "Secondary specs complete."