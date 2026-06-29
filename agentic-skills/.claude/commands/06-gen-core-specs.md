Read `prd.md` and `technical_design.md`.

Create four files:

─── AGENTS.md ───────────────────────────────────────────────────
Define the agent's identity and behaviour:

# Agent: [Name from PRD]

## Role
One paragraph: what this agent does, who it serves, what it cannot do.

## Agentic Patterns Used
List each pattern with a one-sentence explanation of HOW it is used here.

## Node Responsibilities
For each LangGraph node from technical_design.md:
### node_name
- Input: (what it receives from state)
- Action: (what it does — 2–3 sentences, NO code)
- Output: (what it writes back to state)
- LLM tier: primary | cheap | none
- On failure: (what happens if this node errors)

## Decision Rules
List the conditional routing rules in plain English:
e.g. "If tool_calls is empty after reasoning, route to END. Otherwise route to execute_tools."

## Constraints
- Max tool calls per turn: N
- Max retries on tool error: N
- Hard stop conditions: list them

## Skills Registry
Reference: see skills.md for high-level agent capabilities.

─── TOOLS.md ────────────────────────────────────────────────────
Define every tool precisely:

# Tools Specification

For each tool:
## tool_name
- **Description**: what it does (for LLM tool definition)
- **Input schema**: list each param with type, required/optional, description
- **Output schema**: structure of return value with types
- **Mock behaviour**: what it returns in MOCK_LLM=true mode
- **Error cases**: what can go wrong, what to return on error
- **Side effects**: any external API calls, writes to disk/DB

─── STATE.md ────────────────────────────────────────────────────
Define the LangGraph AgentState:

# Agent State Specification

## AgentState Fields
| Field | Type | Description | Default |
|-------|------|-------------|---------|
| messages | list[BaseMessage] | Conversation history | [] |
| [project-specific fields] | ... | ... | ... |

## State Transitions
Describe what each node reads vs writes. Use a table.

─── skills.md ───────────────────────────────────────────────────
Define high-level agent capabilities (not tools — capabilities):

# Agent Skills Registry

List 5–8 skills. Each skill:
## skill_name
- **What it does**: one sentence (user-facing)
- **Tools used**: which TOOLS.md tools are called
- **Example invocation**: a sample user question that triggers this skill
- **Expected output format**: brief, structured text | table | JSON | chart

After creating all four files, print a summary table of node count, tool count,
state field count, and skill count.