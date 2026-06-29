Read the file `prose_brief.md` in the current working directory.

Parse the content and create `PROJECT_BRIEF.yaml` with this exact structure:

```yaml
project:
  name: ""          # extract from brief — title-cased
  slug: ""          # kebab-case, no spaces
  domain: ""        # business domain (e.g. "Personal Finance")
  tagline: ""       # one sentence, max 12 words

user_story:
  as_a: ""          # the user persona
  i_want: ""        # the main action
  so_that: ""       # the benefit

agentic_patterns: []  # list all patterns from brief (ReAct, RAG, HITL, etc.)

stack:
  llm_primary: "claude-sonnet-4-6"
  llm_cheap: "claude-haiku-4-5-20251001"
  llm_provider: "anthropic"   # anthropic | openai | groq
  framework: "langgraph"
  persistence: "sqlite"       # sqlite | supabase | none
  vector_store: null          # null | chromadb | pgvector

frontend_a:
  type: "streamlit"
  file: "chat_app.py"
  description: ""   # extract from brief

frontend_b:
  type: "streamlit"
  file: "dashboard_app.py"
  description: ""   # extract from brief

tools: []           # list with name + description for each tool mentioned

mcp:
  enabled: false    # true if brief mentions MCP
  server_name: ""
  tools_exposed: []

data:
  type: "mock"      # mock | real
  description: ""   # what data is used

deploy:
  target: "streamlit-cloud"   # streamlit-cloud | cloud-run
  dockerfile: true
```

After writing the file, print a 5-line summary of what was extracted. If any required field could not be determined from the brief, use a sensible default and note it in the summary.