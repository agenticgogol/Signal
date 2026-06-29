Read `EVAL.md` and any existing entries in `knowledge/test-results.md`.

Run test cases TC-01 and TC-02 from EVAL.md:

For each test case:
1. Start the backend if not running:
   ```bash
   MOCK_LLM=true .venv/bin/python -m src.api.main &
   sleep 2
   ```
2. Send the test input via POST /chat.
3. Capture the response and tool_calls_made.
4. Score the response against the Expected output criteria from EVAL.md:
   - Check for each required phrase (PASS / FAIL)
   - Check tool calls match expected tools (PASS / FAIL)
   - Calculate overall score (0–6)
5. Check the Failure signals — confirm none are present.
6. Kill the backend after both tests.

Append to `knowledge/test-results.md`:
```markdown
## Test Run — [timestamp]
### TC-01: [Name]
- Input: ...
- Tools called: [list]
- Score: N/6
- Phrases found: [list]
- Failure signals: [none / list found]
- Status: PASS / FAIL

### TC-02: [Name]
[same structure]

### Summary
Pass: N/2 | Overall score: N/12 | Action needed: [none / describe]
```

Print the summary. If any test FAILS, print the failure reason and suggest which
spec file (AGENTS.md / TOOLS.md / PROMPTS.md) likely needs updating.