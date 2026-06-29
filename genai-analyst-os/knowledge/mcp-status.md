# MCP Status

MCP is **disabled** for this project (`mcp.enabled: false` in `PROJECT_BRIEF.yaml`).

The production backend agents are Supabase Edge Functions (Deno runtime), not a Python MCP server. No MCP server will be built for this project.

`mcp/config.json` contains an empty `mcpServers` object and can be ignored.

If MCP is ever enabled in a future version (e.g. to expose pipeline tools to Claude Desktop for manual testing), update `PROJECT_BRIEF.yaml` and re-run `/08-gen-project-skills`.
