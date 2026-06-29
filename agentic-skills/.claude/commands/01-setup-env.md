Read `PROJECT_BRIEF.yaml`.

1. Create a Python 3.11 virtual environment:
   ```bash
   python3.11 -m venv .venv
   echo ".venv/" >> .gitignore
   echo "__pycache__/" >> .gitignore
   echo ".env" >> .gitignore
   echo "*.pyc" >> .gitignore
   ```

2. Create `requirements.txt` with these core packages (add any project-specific
   packages from PROJECT_BRIEF.yaml stack section):
   ```
   anthropic>=0.34.0
   langchain-anthropic>=0.3.0
   langgraph>=0.2.0
   langgraph-checkpoint-sqlite>=1.0.0
   litellm>=1.40.0
   streamlit>=1.37.0
   fastapi>=0.111.0
   uvicorn[standard]>=0.30.0
   pydantic>=2.7.0
   structlog>=24.4.0
   python-dotenv>=1.0.0
   httpx>=0.27.0
   ```
   If `vector_store: chromadb` in YAML, add: `chromadb>=0.5.0 sentence-transformers>=3.0.0`
   If `persistence: supabase`, add: `supabase>=2.5.0`

3. Create `.env.example`:
   ```
   # LLM Provider: anthropic | openai | groq
   LLM_PROVIDER=anthropic

   # Anthropic
   ANTHROPIC_API_KEY=sk-ant-...

   # OpenAI (optional)
   OPENAI_API_KEY=sk-...

   # Groq (optional)
   GROQ_API_KEY=gsk_...

   # LangSmith (optional — for tracing)
   LANGCHAIN_TRACING_V2=true
   LANGCHAIN_API_KEY=ls__...
   LANGCHAIN_PROJECT=PROJECT_NAME_FROM_YAML
   ```

4. Create `src/__init__.py` and `src/llm/__init__.py` (empty).

5. Create `src/llm/provider.py` with a LiteLLM wrapper:
   - `get_provider()` → reads LLM_PROVIDER env var, defaults to "anthropic"
   - `get_model(tier)` → returns model string for tier "primary" or "cheap"
     - anthropic primary: "anthropic/claude-sonnet-4-6"
     - anthropic cheap: "anthropic/claude-haiku-4-5-20251001"
     - openai primary: "openai/gpt-4o", cheap: "openai/gpt-4o-mini"
     - groq primary: "groq/llama-3.3-70b-versatile", cheap: "groq/llama-3.1-8b-instant"
   - `call_llm(messages, system, tools, tier, stream)` → calls litellm.completion()
     with the right model string; handles provider-specific params
   - `stream_llm(messages, system, tier)` → generator that yields text chunks

   Include mock mode: if MOCK_LLM=true in env, return a canned response without
   calling any API. This lets Mode A tests run without API keys.

After creating all files, run:
```bash
.venv/bin/pip install -r requirements.txt --quiet
```
Print "Setup complete." with the venv Python path.