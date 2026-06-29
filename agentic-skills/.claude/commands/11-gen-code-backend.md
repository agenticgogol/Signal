Read `API.md` and the existing `src/graph.py`.

1. Create `src/api/log_stream.py`:
   - A module-level `asyncio.Queue` named `trace_queue`.
   - `put_event(event: dict)` — thread-safe sync function that puts to the queue.
   - `get_events_stream()` — async generator that yields SSE-formatted strings:
     `f"data: {json.dumps(event)}\n\n"`
   - This is the bridge between synchronous node code and async SSE endpoint.

2. Create `src/api/main.py` following the API.md contract:
   - FastAPI app with CORS enabled for localhost.
   - POST /chat:
     - Body: `{"message": str, "session_id": str, "provider": str | None}`
     - If `provider` is given, set LLM_PROVIDER env var before invoking.
     - Invoke the LangGraph compiled graph with `{"messages": [HumanMessage(message)]}`.
     - Return: `{"reply": str, "session_id": str, "tool_calls_made": list[str]}`
   - GET /stream/traces:
     - StreamingResponse using `get_events_stream()` from log_stream.py.
     - Media type: "text/event-stream"
     - Headers: Cache-Control: no-cache, Connection: keep-alive
   - GET /health:
     - Return provider name, mock mode status, graph node count.
   - Global exception handler: catch all unhandled errors, return 500 JSON with error message.

3. Add a `__main__` block:
   ```python
   if __name__ == "__main__":
       import uvicorn
       uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
   ```

After writing, start the server and hit /health:
```bash
MOCK_LLM=true .venv/bin/python -m src.api.main &
sleep 2 && curl -s http://localhost:8000/health | python3 -m json.tool
kill %1
```
Print the health response. Fix any errors.