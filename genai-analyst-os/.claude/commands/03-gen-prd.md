Read `PROJECT_BRIEF.yaml` and `requirements.md`.

Create `prd.md` with the following sections:

## Problem Statement
One paragraph: what pain the system solves and why an agentic approach is better
than a simple LLM call or a traditional application.

## User Personas
2–3 personas with: name, role, technical level, primary goal, key frustration.

## Feature List
Group by Priority:
- P0 (Must Have — launch blocker): list features
- P1 (Should Have — launch goal): list features
- P2 (Nice to Have — post-launch): list features

## System Behaviour Narrative
Write a 3-paragraph natural language description of a complete user session:
from the moment the user opens the app, through all agent interactions, to
receiving the final output. Describe what each UI panel shows.

## Success Metrics
5 measurable metrics with targets, e.g.:
- Task completion rate ≥ 85%
- Correct answer rate on golden test set ≥ 90%
- p95 latency ≤ 5 seconds

## Agentic Design Decisions
For each pattern in PROJECT_BRIEF.yaml `agentic_patterns`, explain in 2 sentences
WHY that pattern was chosen for this specific domain.

## Data Model
List the key entities with their fields (can be a simple table).

After writing the file, print: "PRD complete — [N] features across P0/P1/P2."