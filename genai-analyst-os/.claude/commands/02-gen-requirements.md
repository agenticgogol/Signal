Read `PROJECT_BRIEF.yaml`.

Create `requirements.md` with the following sections:

## 1. Functional Requirements
List 8–12 specific, testable functional requirements (FR-01, FR-02, ...).
For each: what the system must do, who triggers it, what the output is.
Draw these from the agentic_patterns and tools in the YAML.

## 2. Non-Functional Requirements
List 5–8 NFRs covering:
- Response latency (e.g. "first token within 2s")
- Throughput (e.g. "handle 10 concurrent users")
- Uptime (mock mode must work without any API key)
- Cost guardrails (e.g. "max $0.05 per request")
- Security (no PII logged, API keys in env only)

## 3. Constraints
- Must run locally with `MOCK_LLM=true` — no API key required
- Python 3.11+, LangGraph, LiteLLM (multi-provider)
- Streamlit for both frontends (chat UI + dashboard UI)
- All state persisted to SQLite (no in-memory-only state)

## 4. Out of Scope
List 3–5 things explicitly NOT in scope for this version.

## 5. Acceptance Criteria
List the 3 golden test cases from the user story. Format:
- Given [context], When [action], Then [expected output].

After writing the file, print a one-paragraph summary of the most important
requirements and any ambiguities found in the brief.