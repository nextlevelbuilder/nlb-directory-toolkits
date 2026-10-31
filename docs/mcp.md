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
Hosted endpoint: **https://mcp.nextlevelbuilder.io/mcp**. The web app (nlb-web-v2) serves that hostname. This Worker runs only on its `workers.dev` URL, `https://nlb-directory-mcp.digitop-vn.workers.dev/mcp`. Check its status at [health](https://nlb-directory-mcp.digitop-vn.workers.dev/health).

The package exports a pure Web-standard fetch handler compatible with Cloudflare Workers without Node-only dependencies:

```typescript
import { handleWorkerFetch } from "@nextlevelbuilder/mcp/worker";

export default {
  fetch: handleWorkerFetch
};
```

Endpoints supported:
- `POST /mcp` or `POST /`: Stateless Streamable HTTP JSON-RPC requests; notifications return `202` with an empty body.
- `GET /mcp` and `DELETE /mcp`: `405` (no persistent stream or session).
- `GET /sse`: Legacy SSE stream initialization. Its in-memory sessions require the same isolate, so use `/mcp` on Cloudflare.
- `GET /health`: Diagnostic status endpoint.

The server negotiates protocol `2025-06-18` and retains `2024-11-05` for legacy clients. HTTP clients send `Content-Type: application/json`, `Accept: application/json, text/event-stream`, and the negotiated `MCP-Protocol-Version` on subsequent requests. The Worker does not issue a session ID.

#### Deploy from this repository

The [Deploy MCP workflow](../.github/workflows/deploy-mcp.yml) deploys production after the main-branch CI succeeds. It also supports manual dispatch on `main`, running the same build, test and type checks before deployment. Repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` authorize deployment. Existing Worker secrets, including OAuth delegation credentials, remain managed in Cloudflare.

Requires Node.js 22+ and pnpm. Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @nextlevelbuilder/mcp exec wrangler login
pnpm --filter @nextlevelbuilder/mcp run deploy:check
pnpm --filter @nextlevelbuilder/mcp run deploy
```

[`packages/mcp/wrangler.jsonc`](../packages/mcp/wrangler.jsonc) owns the Worker name, Cloudflare account, entry point, and upstream API URL. It declares no `routes`. The web app owns `mcp.nextlevelbuilder.io`, so this Worker must not claim that hostname as a custom domain. The build command builds the shared contracts before bundling the Worker. To deploy elsewhere, update `account_id`. Wrangler prints the deployed `workers.dev` URL; the MCP endpoint is `<worker-url>/mcp`.

For local development, run `pnpm --filter @nextlevelbuilder/mcp dev:worker` (default port 8787).

#### Authentication and browser access

Public directory reads (including `affiliate_get_program`) are available without authentication. Private reads (`get_product_traffic` and the affiliate member and operator reads) require OAuth (`mcp:read`, or `mcp:operator` for `affiliate_admin_*`) or a valid static Worker token plus upstream credentials. Remote mutations (`submit_product`, `cast_vote`, `upload_media`, `create_checkout`, `create_api_key`, `revoke_api_key`, `affiliate_join`, `affiliate_create_link`, `affiliate_update_link` and the affiliate operator writes) require an OAuth access token with the appropriate scope or `Authorization: Bearer <WORKER_AUTH_TOKEN>`. For legacy static-token clients, set a strong token as a Cloudflare secret to enable authorized writes:

```bash
pnpm --filter @nextlevelbuilder/mcp exec wrangler secret put WORKER_AUTH_TOKEN
```

With static-token authentication, each tool still requires its upstream credentials (`api_key` or `session_cookie`) when applicable. An optional `NLB_API_KEY` Worker secret supplies a default API key for tools that use it. OAuth calls use the signed-in account as described below. Never put credentials in Wrangler `vars` or commit them. Local development secrets belong in `packages/mcp/.dev.vars`, which is ignored by git.

Requests without `Origin` (native MCP clients) are accepted. Browser origins must match the Worker origin or the comma-separated `NLB_ALLOWED_ORIGINS` variable; configure exact trusted origins if using a browser client.

Remote client configuration (Cursor):

```json
{
  "mcpServers": {
    "nlb-directory": {
      "url": "https://mcp.nextlevelbuilder.io/mcp",
      "headers": {
        "Authorization": "Bearer <WORKER_AUTH_TOKEN>"
      }
    }
  }
}
```

Omit `headers` for read-only access. Streamable HTTP behavior follows the [MCP transport specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports).

### 3. OAuth with an NLB account

The checked-in Worker configuration enables OAuth with `NLB_OAUTH_ENABLED=true` for production and staging. Deployments require the matching web provider, database migration and shared delegation secret to be ready first; the configuration alone does not verify live availability. Existing static-token and stdio configurations remain supported.

When enabled, clients discover the web authorization server through `/.well-known/oauth-protected-resource/mcp` (also available at the well-known root). Its issuer is `https://nextlevelbuilder.io/api/auth`. The web uses existing NLB sign-in methods and asks the user to approve the requesting application. Public clients use Authorization Code with S256 PKCE; dynamic client registration supports existing MCP clients. Clients requesting `offline_access` receive refresh tokens.

| Scope | Permission |
| --- | --- |
| `mcp:read` | Read directory data, query authorized product traffic and validate documents |
| `mcp:write` | Submit products, upload media, vote, create checkout links |
| `mcp:keys` | List, create and revoke the user's API keys; newly created keys can outlive this OAuth grant |
| `mcp:operator` | Affiliate finance operator tools (`affiliate_admin_*`). The authorization server grants it only to platform operators, and the web re-checks the affiliate operator grant on every call |

Unauthenticated public reads remain available. Protected calls return HTTP `401` with OAuth discovery information, and an authenticated request missing the required scope returns `403`. Start sign-in using your client's OAuth login feature or when it encounters a protected call. An OAuth client needs only the endpoint configuration:

```json
{
  "mcpServers": {
    "nlb-directory": { "url": "https://mcp.nextlevelbuilder.io/mcp" }
  }
}
```

OAuth calls use the signed-in account. Do not pass `api_key`, `session_cookie`, or a different `api_url`. The Worker validates access-token type, signature, issuer, resource audience, expiry and scopes. It sends a separate assertion lasting at most 60 seconds to opted-in NLB API routes, bound to the user, scope, HTTP method and path. OAuth access tokens and web session cookies are not forwarded. The web reloads current user status and retains organization/ownership checks; voting still needs a valid Turnstile token when the web requires one.

Access tokens last five minutes. Manage and disconnect authorized clients at the web's `/oauth/connections` page. Disconnecting revokes that user's refresh-token families for the client and removes consent. Pending authorization codes are bound to that consent and cannot be exchanged after disconnect, even if the user later reconnects. Already issued JWTs can remain valid until their five-minute expiry. Revoking OAuth consent does not revoke API keys previously created through `mcp:keys`; revoke those keys separately.

#### Rollout order

1. In the web repository, generate/review the OAuth schema migration, apply it to staging using the direct database connection, and deploy the web changes through CI. Follow its `docs/deployment-guide.md` for production migration and deployment.
2. Configure `MCP_OAUTH_RESOURCE` on the web and `NLB_OAUTH_RESOURCE` on this Worker to the same canonical MCP endpoint. The web's `BETTER_AUTH_URL` and Worker's `NLB_OAUTH_ISSUER` must identify the same issuer (`<web-origin>/api/auth`); `NLB_API_URL` must match that web origin.
3. Provision the same independently generated, high-entropy `MCP_DELEGATION_SECRET` (at least 32 bytes) on both Workers. Keep it separate from `BETTER_AUTH_SECRET` and `WORKER_AUTH_TOKEN`, and out of source control.
4. Enable the web provider with `MCP_OAUTH_ENABLED=true`. Verify authorization-server metadata, JWKS, sign-in/consent, PKCE and refresh on staging before production.
5. Deploy this Worker with `NLB_OAUTH_ENABLED=true` (already set in the checked-in configuration). Verify discovery, an OAuth-authorized call and a denied call on the `workers.dev` URL. Keep staging and production resources/secrets isolated.

The `staging` Wrangler environment uses `https://staging.nextlevelbuilder.io` and the separate MCP resource `https://nlb-directory-mcp-staging.digitop-vn.workers.dev/mcp`. Use `pnpm --filter @nextlevelbuilder/mcp run deploy --env staging` to deploy it, and add `--env staging` to Wrangler secret commands when provisioning its independent secrets. Production commands omit `--env staging` and deploy to the production `workers.dev` URL.

To disable new OAuth access, set `NLB_OAUTH_ENABLED=false` and deploy the MCP Worker. Legacy static-token callers continue working. Web/schema rollback follows the web repository's forward-only migration policy.

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
- **Returns**: Vote registration response. Requires OAuth `mcp:write` or a user session cookie.

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
- **Returns**: `{ success: boolean, data: Array<{ id, name, prefix, enabled, createdAt, expiresAt }> }`. Requires OAuth `mcp:keys` or a user session cookie.

### 14. `create_api_key`
Creates a new developer API key. The raw secret key is returned only once.
- **Parameters**: `name` (string, required), `organization_id` (string, optional), `expires_days` (number, optional), `session_cookie` (string, optional), `api_url` (string, optional).
- **Returns**: `{ success: boolean, data: { id, name, prefix, key, expiresAt, createdAt } }`. Requires OAuth `mcp:keys` or a user session cookie.

### 15. `revoke_api_key`
Revokes an existing developer API key by ID.
- **Parameters**: `id` (string, required), `session_cookie` (string, optional), `api_url` (string, optional).
- **Returns**: `{ success: boolean, message: string }`. Requires OAuth `mcp:keys` or a user session cookie.

### 16. `get_product_traffic`

Queries organization-authorized traffic for an NLB-hosted product page.
- **Parameters**: `slug` (required), `from` and `to` (optional UTC ISO timestamps), `api_key` and `api_url` (optional).
- **Defaults**: `to` is now; `from` is 30 days before `to`. Increasing ranges up to 90 days are accepted; the end cannot be in the future.
- **Authentication**: OAuth callers need `mcp:read` and membership in the product organization (or admin access). The Worker signs a request-bound delegation assertion for the web API; it never forwards OAuth tokens or shared API keys. Stdio callers reuse `NLB_API_KEY`. Legacy Worker calls additionally require `Authorization: Bearer <WORKER_AUTH_TOKEN>`. Organization-scoped API keys must match the product organization.
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

### 17. Affiliate program tools (23 tools)

The referral program of [web #63](https://github.com/nextlevelbuilder/nlb-web-v2/issues/63) on the same `https://mcp.nextlevelbuilder.io/mcp` endpoint (and stdio); there is no separate affiliate server. Tools are thin clients of `/api/v1/affiliates/*` and `/api/v1/affiliate-admin/*`, and the web decides every rule: ownership, the budget invariant `discount + (1 - discount) × commission ≤ budget`, the operator grant and the audit trail. Shapes are in [contracts.md](contracts.md#affiliate-program).

- **Units**: fields ending in `Minor` are integer minor units (USD cents); fields ending in `Bps` are integer basis points (`10000` = 100%).
- **Members** (owner-only): every member tool acts on the caller's own affiliate account through OAuth or a member API key (`api_key` / `NLB_API_KEY`). While `AFFILIATES_ENABLED` is off the API answers 404 and the error carries `notEnabled: true`.
- **Joining**: `affiliate_join` requires `termsVersion`, the Affiliate Agreement version the user read and accepted (`affiliate_get_program` returns the current one). An agent must not accept the agreement on the user's behalf.
- **Link edits** apply to future checkouts only. Pass `expectedVersion` (the link's `version`) to get `409 conflict` instead of overwriting a concurrent change. Archiving is permanent.
- **Operators**: `affiliate_admin_*` tools need `mcp:operator` and the web's affiliate operator grant; without OAuth they take the operator's `session_cookie` (or `NLB_SESSION_COOKIE`). API keys are refused. Previews never write.
- **Not available through MCP or API keys**: setting or reading payout methods (bank, PayPal, identity data), revealing payee details, marking items paid, publishing rules, ledger adjustments, suspending or reinstating affiliates, approving batches, and requesting or deciding two-person approvals (`POST …/approvals`, `POST …/approvals/{id}/decision`). Payout setup is a signed-in browser action on the website; the money-moving operator steps need a signed-in operator and, where sensitive, a second operator's approval.

| Tool | Scope | Route |
| --- | --- | --- |
| `affiliate_get_program` | `mcp:read` (public) | `GET /api/v1/affiliates/program` |
| `affiliate_get_me` · `affiliate_join` | `mcp:read` · `mcp:write` | `GET` · `POST /api/v1/affiliates/me` |
| `affiliate_preview_incentive` | `mcp:read` | `GET /api/v1/affiliates/preview?discountBps&priceMinor` |
| `affiliate_list_links` · `affiliate_create_link` | `mcp:read` · `mcp:write` | `GET` · `POST /api/v1/affiliates/links` |
| `affiliate_update_link` | `mcp:write` | `PATCH /api/v1/affiliates/links/{id}` |
| `affiliate_list_conversions` | `mcp:read` | `GET /api/v1/affiliates/conversions?limit` |
| `affiliate_get_commissions` | `mcp:read` | `GET /api/v1/affiliates/commissions?limit` |
| `affiliate_list_payouts` | `mcp:read` | `GET /api/v1/affiliates/payouts` |
| `affiliate_admin_get_rules` | `mcp:operator` | `GET /api/v1/affiliate-admin/rules` |
| `affiliate_admin_preview_rules` | `mcp:operator` | `POST …/rules/preview` (`{ rules }`, no write) |
| `affiliate_admin_list_affiliates` | `mcp:operator` | `GET …/affiliates?status&limit` → `{ affiliates }` |
| `affiliate_admin_list_conversions` | `mcp:operator` | `GET …/conversions?status&limit` → `{ conversions }` |
| `affiliate_admin_hold_conversion` · `affiliate_admin_release_conversion` | `mcp:operator` | `POST …/conversions/{id}/hold` (`{ reason }`) · `…/release` |
| `affiliate_admin_preview_payouts` | `mcp:operator` | `GET …/payouts/preview?period=YYYY-MM` |
| `affiliate_admin_list_batches` · `affiliate_admin_create_batch` | `mcp:operator` | `GET …/payouts/batches` → `{ batches }` · `POST` (`{ period }`, locks funds, sends nothing) → batch with `totals` and `items` |
| `affiliate_admin_get_batch` | `mcp:operator` | `GET …/payouts/batches/{id}` |
| `affiliate_admin_cancel_batch` | `mcp:operator` | `POST …/payouts/batches/{id}/cancel` |
| `affiliate_admin_reconciliation` | `mcp:operator` | `GET …/reconciliation?since&until` |
| `affiliate_admin_list_approvals` | `mcp:operator` | `GET …/approvals?status&limit&cursor` (array plus `pagination`) |

Annotations: reads and previews are `readOnlyHint: true`; `affiliate_update_link` (it can archive) and `affiliate_admin_cancel_batch` are `destructiveHint: true`. Writes accept an optional `idempotency_key`, sent as `Idempotency-Key`.

Every tool returns the API's `{ data }` envelope unchanged after validating it against the shared contract. Failures come back as `isError: true` with a JSON payload `{ error, status, code, notEnabled, hint, details }`; the API's error codes include `not_enrolled`, `terms_not_accepted`, `over_budget`, `conflict`, `invalid_transition`, `approval_required` and `session_required`.

Operator OAuth: clients ask for every advertised scope, but only platform operators receive `mcp:operator`. Others get `403 insufficient_scope` on `affiliate_admin_*`. An operator granted later must reconnect the client so it requests the scope again.

#### Not yet available (tracked in [toolkits #20](https://github.com/nextlevelbuilder/nlb-directory-toolkits/issues/20))

These parts of the issue need endpoints or decisions the web API does not provide today, so no tool fakes them:

- `affiliate_get_stats` (aggregated clicks and conversions over a date range): no stats route exists. `affiliate_list_links` returns clicks and conversions per link.
- `affiliate_get_payout_setup_url`: the web has no short-lived hosted setup URL; payout setup stays a signed-in browser action at `/account/referrals`.
- Two-person approval requests and decisions, batch approval and manual payout recording (`mark-paid`): the routes exist but stay with signed-in humans on the website by design.
- `nlb://affiliate/*` MCP resources: this server does not implement `resources/*` yet.
