Read `PROJECT_BRIEF.yaml` and `project_structure.md`.

1. Create `Dockerfile`:
   - Base: python:3.11-slim
   - Multi-stage: builder stage installs deps, final stage copies only what is needed.
   - WORKDIR /app
   - Copy requirements.txt and pip install (no cache).
   - Copy src/, data/, chat_app.py, dashboard_app.py.
   - Expose port 8000 (backend) and 8501 (Streamlit).
   - CMD starts the FastAPI backend; Streamlit is run separately.
   - Do NOT bake API keys into the image — use environment variables at runtime.

2. Create `docker-compose.yml`:
   - Service "backend": builds from Dockerfile, port 8000, env_file: .env
   - Service "chat": runs `streamlit run chat_app.py --server.port 8501`,
     depends_on backend, port 8501
   - Service "dashboard": runs `streamlit run dashboard_app.py --server.port 8502`,
     depends_on backend, port 8502
   - All services share a volume for SQLite persistence.

3. Create `.github/workflows/ci.yml`:
   - Trigger: push to main, PR to main.
   - Steps: checkout, setup Python 3.11, pip install, run syntax checks:
     `python -m py_compile $(find src -name "*.py")` and
     `MOCK_LLM=true python -c "from src.graph import get_graph; get_graph()"`
   - No API keys required in CI — mock mode only.

4. Create `README.md` with:
   - Project name and tagline from PROJECT_BRIEF.yaml.
   - ASCII architecture diagram (reuse from technical_design.md).
   - Prerequisites (Python 3.11, Docker optional).
   - Quick start (5 commands from clone to running).
   - How to switch LLM provider (change LLM_PROVIDER in .env).
   - How to run in mock mode (MOCK_LLM=true).
   - How to deploy to Streamlit Cloud (link the repo, add secrets).
   - Project structure (abbreviated tree).

After creating files, run docker build to verify:
```bash
docker build -t test-build . --quiet && echo "Docker build OK" || echo "Build failed"
```
Print result.