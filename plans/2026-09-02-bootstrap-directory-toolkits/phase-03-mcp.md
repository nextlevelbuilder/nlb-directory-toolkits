# Phase 3: `@nextlevelbuilder/mcp` (Model Context Protocol Server)

## Context & Objectives
Implement the Model Context Protocol (MCP) server for Next Level Builders Directory, allowing AI assistants (Claude Desktop, Cursor, Codex, OpenCode) and automated agents to inspect, validate, and submit listings via MCP tools.

## Files to Modify/Create
- `packages/mcp/package.json`
- `packages/mcp/tsconfig.json`
- `packages/mcp/src/index.ts`
- `packages/mcp/src/bin.ts`
- `packages/mcp/src/server.ts`
- `packages/mcp/src/tools/index.ts`
- `packages/mcp/src/tools/validate.ts`
- `packages/mcp/src/tools/submit.ts`
- `packages/mcp/src/tools/get.ts`
- `packages/mcp/src/tools/search.ts`
- `packages/mcp/src/tools/leaderboard.ts`
- `packages/mcp/src/tools/templates.ts`
- `packages/mcp/src/transports/stdio.ts`
- `packages/mcp/src/transports/worker.ts`
- `packages/mcp/tests/mcp-server.test.ts`
- `packages/mcp/tests/worker-transport.test.ts`

## Requirements
1. **JSON-RPC 2.0 MCP Protocol**:
   - Implements official MCP spec (`initialize`, `tools/list`, `tools/call`, `ping`).
2. **Tools**:
   - `validate_listing`: Validates listing JSON against contracts, returns validity, error details, and canonical SHA-256 hash.
   - `submit_product`: Validates document, creates envelope/revision, submits to directory API.
   - `get_product`: Retrieves product information and block content by slug.
   - `search_products`: Searches directory products with query, category filter, tag filter, and pagination.
   - `get_leaderboard`: Returns top ranked products by timeframe (`daily`, `weekly`, `monthly`, `all_time`).
   - `list_templates`: Returns available layout templates with sample blocks.
3. **Dual Transport Support**:
   - `stdio`: Stdio transport for local agent IDEs (Cursor, Claude Desktop, Codex, OpenCode).
   - `Cloudflare Workers`: `fetch` handler + Server-Sent Events (SSE) / streamable HTTP for serverless edge deployment.

## Validation
- Vitest tests testing MCP initialize, tool listing, tool invocation with valid and invalid payloads, and Cloudflare Worker fetch handling.
