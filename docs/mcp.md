# MCP Server Documentation (`@nextlevelbuilder/mcp`)

The `@nextlevelbuilder/mcp` package implements a Model Context Protocol (MCP) server that exposes Next Level Builders Directory operations to AI agents and IDE assistants (Claude Desktop, Cursor, Codex, OpenCode).

## Transports

### 1. Stdio Transport (Local AI IDEs)
The stdio transport runs locally over standard input/output using line-delimited JSON-RPC 2.0 messages.

```bash
npx @nextlevelbuilder/mcp
```

#### Configuration:
- **Cursor** (`.cursor/mcp.json`):
  ```json
  {
    "mcpServers": {
      "nlb-directory": {
        "command": "npx",
        "args": ["-y", "@nextlevelbuilder/mcp"]
      }
    }
  }
  ```
- **Claude Desktop** (`claude_desktop_config.json`):
  ```json
  {
    "mcpServers": {
      "nlb-directory": {
        "command": "npx",
        "args": ["-y", "@nextlevelbuilder/mcp"],
        "env": {
          "NLB_API_KEY": "nlb_live_your_key"
        }
      }
    }
  }
  ```

---

### 2. Cloudflare Workers Transport (Edge Deployment)
The package exports a pure Web-standard fetch handler compatible with Cloudflare Workers without Node-only dependencies:

```typescript
import { handleWorkerFetch } from "@nextlevelbuilder/mcp/worker";

export default {
  fetch: handleWorkerFetch
};
```

Endpoints supported:
- `POST /mcp` or `POST /`: Direct JSON-RPC requests.
- `GET /sse`: Server-Sent Events stream initialization returning message endpoint.
- `GET /health`: Diagnostic status endpoint.

---

## MCP Tools Reference

### `validate_listing`
Validates a product document against `@nextlevelbuilder/contracts` and returns its canonical SHA-256 content hash.
- **Parameters**: `document` (object, required).
- **Returns**: `{ valid: boolean, contentHash?: string, errors?: Array }`.

### `submit_product`
Submits a product document to the Next Level Builders Directory moderation queue.
- **Parameters**: `document` (object, required), `api_key` (string, optional), `api_url` (string, optional), `notes` (string, optional).
- **Returns**: `{ success: boolean, slug: string, submissionId: string, status: string, contentHash: string }`.

### `get_product`
Fetches product details and blocks outline by product slug.
- **Parameters**: `slug` (string, required), `api_url` (string, optional).
- **Returns**: Product details with active revision and block outline.

### `search_products`
Searches the directory by keyword, category, or tag.
- **Parameters**: `query` (string, required), `category` (string, optional), `tag` (string, optional), `limit` (number, optional).
- **Returns**: `{ query: string, totalResults: number, results: Array }`.

### `get_leaderboard`
Gets top directory products ranked by Trust Score and community upvotes.
- **Parameters**: `timeframe` ("daily" | "weekly" | "monthly" | "all_time", optional), `limit` (number, optional).
- **Returns**: `{ timeframe: string, leaderboard: Array }`.

### `list_templates`
Returns layout templates (SaaS Launch, AI Agent / Tool, Developer CLI, Curated Community, Minimalist Showcase) with sample blocks.
- **Parameters**: `template_name` (string, optional).
- **Returns**: List of templates or single detailed template.
