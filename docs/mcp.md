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

### 1. `validate_listing`
Validates a product document against `@nextlevelbuilder/contracts` and returns its canonical SHA-256 content hash.
- **Parameters**: `document` (object, required).
- **Returns**: `{ valid: boolean, contentHash?: string, errors?: Array }`.

### 2. `submit_product`
Submits a product document to the Next Level Builders Directory moderation queue. If the product requires a paid publishing slot, returns a direct Polar checkout URL.
- **Parameters**: `document` (object, required), `org_id` (string, required UUID), `api_key` (string, optional), `api_url` (string, optional), `notes` (string, optional), `is_fast_track` (boolean, optional), `pay_only` (boolean, optional).
- **Returns**:
  - Success: `{ status: "submitted", slug: string, submissionId: string, caseId?: string, contentHash: string, previewUrl: string }`.
  - Payment Required: `{ status: "payment_required", slug: string, message: string, checkoutUrl: string, amount: string, isEarlyBird?: boolean, slotNumber?: number, previewUrl: string }`.

### 3. `get_product`
Fetches product details and block outlines by slug. Supports both structured JSON and AI-optimized Markdown format.
- **Parameters**: `slug` (string, required), `format` ("json" | "markdown", optional), `api_url` (string, optional).
- **Returns**: Structured product object or `{ slug: string, markdown: string }`.

### 4. `get_product_markdown`
Exports product details as Markdown structured feed formatted for AI agents and LLM context windows.
- **Parameters**: `slug` (string, required), `api_url` (string, optional).
- **Returns**: `{ slug: string, markdown: string }`.

### 5. `list_products`
Lists published directory products with offset pagination.
- **Parameters**: `limit` (number, optional, default: 20), `offset` (number, optional, default: 0), `api_url` (string, optional).
- **Returns**: `{ data: Array, pagination: { limit: number, offset: number, count: number } }`.

### 6. `get_leaderboard`
Gets transparent community rankings leaderboard by timeframe window.
- **Parameters**: `window` ("daily" | "weekly" | "monthly", optional, default: "daily"), `api_url` (string, optional).
- **Returns**: `{ data: { windowType: string, ranks: Array<{ rank, productId, voteCount, score }> } }`.

### 7. `get_stats`
Gets live platform metrics (published products, click-outs, registered builders, total votes).
- **Parameters**: `api_url` (string, optional).
- **Returns**: `{ success: boolean, stats: { publishedCount, outboundClicks, registeredBuilders, totalVotes } }`.

### 8. `check_health`
Probes database and service runtime health. Sanitizes output to prevent internal stack trace exposure.
- **Parameters**: `api_url` (string, optional).
- **Returns**: `{ status: string, database: string, db_name?: string, products_count?: number, timestamp: string }`.

### 9. `cast_vote`
Casts an organic community vote for a product.
- **Parameters**: `product_id` (string, required UUID), `turnstile_token` (string, optional), `session_cookie` (string, optional), `api_url` (string, optional).
- **Returns**: Vote registration response. Requires user session cookie.

### 10. `upload_media`
Uploads an image (up to 10MB) or video (up to 100MB) with strict MIME allowlist and size validation.
- **Parameters**: `file_base64` (string, required), `filename` (string, required), `mime_type` (string, optional), `folder` (string, optional), `api_key` (string, optional), `api_url` (string, optional).
- **Returns**: `{ success: boolean, url: string, storageKey?: string, provider?: string }`.

### 11. `create_checkout`
Generates a Polar checkout session URL for purchasing directory publishing slots or memberships using a Polar product UUID.
- **Parameters**: `product_id` (string, required Polar product UUID), `customer_email` (string, optional), `product_slug` (string, optional), `api_url` (string, optional).
- **Returns**: `{ url: string }`.

### 12. `list_templates`
Returns layout templates (SaaS Launch, AI Agent, Dev Tool, Community Curated, Minimalist) with supported block blueprints.
- **Parameters**: `template_name` (string, optional).
- **Returns**: List of templates or single detailed template blueprint.

### 13. `list_api_keys`
Lists active developer API keys for the current account.
- **Parameters**: `session_cookie` (string, optional), `api_url` (string, optional).
- **Returns**: `{ success: boolean, data: Array<{ id, name, prefix, enabled, createdAt, expiresAt }> }`. Requires user session cookie.

### 14. `create_api_key`
Creates a new developer API key. The raw secret key is returned only once.
- **Parameters**: `name` (string, required), `organization_id` (string, optional), `expires_days` (number, optional), `session_cookie` (string, optional), `api_url` (string, optional).
- **Returns**: `{ success: boolean, data: { id, name, prefix, key, expiresAt, createdAt } }`. Requires user session cookie.

### 15. `revoke_api_key`
Revokes an existing developer API key by ID.
- **Parameters**: `id` (string, required), `session_cookie` (string, optional), `api_url` (string, optional).
- **Returns**: `{ success: boolean, message: string }`. Requires user session cookie.

### 16. `get_product_traffic`

Queries organization-authorized traffic for an NLB-hosted product page.
- **Parameters**: `slug` (required), `from` and `to` (optional UTC ISO timestamps), `api_key` and `api_url` (optional).
- **Defaults**: `to` is now; `from` is 30 days before `to`. Increasing ranges up to 90 days are accepted; the end cannot be in the future.
- **Authentication**: Reuses `NLB_API_KEY` from the existing stdio environment or Worker configuration. The key must be authorized for the product organization. Worker calls also require `Authorization: Bearer <WORKER_AUTH_TOKEN>` to protect private reads using the configured key.
- **Returns**: The [traffic response](contracts.md#product-traffic), including source, timestamps, totals, daily series, referrers, countries, devices, and active visitors. Unavailable data returns an MCP tool error.
- **Visitors**: Counts represent daily sessions. Identifiers reset each UTC day, so a returning session on the next day counts again; range totals are not unique people across the period.

```json
{
  "name": "get_product_traffic",
  "arguments": {
    "slug": "my-product",
    "from": "2026-08-01T00:00:00Z",
    "to": "2026-08-31T00:00:00Z"
  }
}
```

To add a public Analytics block, include `{ "id": "traffic-1", "type": "analytics", "props": { "title": "Traffic", "period": "30d" } }` in the product document's `blocks` array, validate with `validate_listing`, and submit with `submit_product`. Periods are `7d`, `30d`, or `90d`; omitted title/period default to `Traffic`/`30d`. Publishing the block opts into public aggregate totals and series. Detailed breakdowns stay organization-authorized.
