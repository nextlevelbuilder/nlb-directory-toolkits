# Phase 3: MCP Tools & Multi-Transport Handlers

- **Phase**: 3
- **Status**: pending
- **Target Files**:
  - `packages/mcp/src/tools/index.ts`
  - `packages/mcp/src/server.ts`
  - `packages/mcp/src/transports/worker.ts`
  - `packages/mcp/tests/tools.test.ts`
  - `packages/mcp/tests/server.test.ts`
  - `packages/mcp/tests/worker.test.ts`

## Scope & Changes

1. **Security & Validation Hardening**:
   - `validateAllowedApiUrl`: Allow ONLY literal loopback addresses (`localhost`, `127.0.0.1`, `::1`). Explicitly reject `.local` domain names.
   - Fail-closed worker authentication for mutations.

2. **Update Existing MCP Tools**:
   - `submit_product`:
     - Accept optional `org_id` (default `"nlb-official"`), `is_fast_track`, `pay_only`.
     - Convert document to server wire document format (`toServerDocument`) before revision upload.
     - Send `{ orgId, slug, title, tagline, websiteUrl, logoUrl }` for product creation.
     - Detect HTTP 402 with `checkoutUrl` and return structured `{ status: "payment_required", checkoutUrl, amount, isEarlyBird, slotNumber, previewUrl }`.
   - `get_product`:
     - Add `format` parameter: `"json"` (default) or `"markdown"`.
     - When `format === "markdown"`, call `/api/v1/products/${slug}/markdown` and return `{ slug, markdown }`.
   - `get_leaderboard`:
     - Support `window`: `"daily" | "weekly" | "monthly"` calling `/api/v1/rankings?window=...`.

3. **Add New MCP Tools**:
   - `get_product_markdown`: Dedicated tool to fetch markdown representation of any published product by `slug`.
   - `get_stats`: Fetch directory stats from `/api/v1/stats`.
   - `check_health`: Query `/api/health`. Returns sanitized `{ status, database, productsCount, timestamp }` (never leaks server stack trace).
   - `cast_vote`: Vote for a product by `product_id` and optional `turnstile_token` or `session_cookie`. Handles 401 gracefully with clear auth explanation.
   - `upload_media`: Upload file (base64 or local path). Performs strict MIME and size checks (10MB image, 100MB video) before sending.
   - `create_checkout`: Generate Polar checkout URL via `POST /api/checkout`.

4. **Transport & Server Verification**:
   - Ensure `server.ts` and `worker.ts` expose and test all tools.

## Verification

- Command: `pnpm --filter "@nextlevelbuilder/mcp" test`
- Observable: All MCP tools execute handlers, return expected JSON schemas, and properly handle errors in both stdio and worker environments.
