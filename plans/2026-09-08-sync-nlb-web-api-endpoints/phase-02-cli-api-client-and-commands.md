# Phase 2: CLI Client Expansion & Commands

- **Phase**: 2
- **Status**: pending
- **Target Files**:
  - `packages/cli/src/api/client.ts`
  - `packages/cli/src/commands/get.ts`
  - `packages/cli/src/commands/list.ts`
  - `packages/cli/src/commands/submit.ts`
  - `packages/cli/src/commands/doctor.ts`
  - `packages/cli/src/commands/rankings.ts`
  - `packages/cli/src/commands/stats.ts`
  - `packages/cli/src/commands/vote.ts`
  - `packages/cli/src/commands/upload.ts`
  - `packages/cli/src/commands/checkout.ts`
  - `packages/cli/src/cli.ts`
  - `packages/cli/tests/client.test.ts`
  - `packages/cli/tests/commands.test.ts`

## Scope & Changes

1. **`NlbApiClient` Enhancements**:
   - Add `requestText(path, options)` for endpoints returning plaintext or markdown (`Accept: text/markdown`). Check `response.ok` before returning text; throw descriptive error on 404 or non-2xx.
   - `listProducts(query)`: Pass `limit` (max 50) and `offset` (translating `page` to `offset = (page - 1) * limit`). Unwrap `{ data, pagination }`.
   - `getProduct(slug)`: Request `/api/v1/products/${slug}` and unwrap `{ data: { product, revision } }`.
   - `getProductMarkdown(slug)`: Call `requestText('/api/v1/products/' + slug + '/markdown')` and return raw string.
   - `createProduct(input)`: Wire payload sends `{ orgId, slug, title, tagline, websiteUrl, logoUrl }`. Unwraps `{ data: product }`.
   - `createRevision(slug, input)`: Serializes server wire document (using `toServerDocument` if needed). Unwraps `{ data: revision }`.
   - `submitProduct(slug, input)`:
     - Sends `{ revisionId, submissionNotes, isFastTrack, payOnly }`.
     - Intercepts HTTP 402 with `{ requiresPayment: true, checkoutUrl, amount, isEarlyBird, slotNumber }` and returns it without throwing fatal exception.
     - Unwraps `{ data: { submissionId, caseId, status, isEarlyBird } }` on HTTP 200.
   - `getRankings(window)`: Request `/api/v1/rankings?window=${window}`. Returns `{ data: { id, windowType, windowDate, ranks } }`.
   - `getStats()`: Request `/api/v1/stats`. Returns `{ success, stats }`.
   - `checkHealth()`: Request `/api/health`. Evaluates semantic health (`status === "ok" && database === "connected"`).
   - `castVote(input, cookie?)`: Request `POST /api/v1/votes`. Passes cookie if provided. Documents that session is required.
   - `uploadMedia(fileBuffer, filename, mimeType?, folder?)`: Validates mime type and file size (10MB image, 100MB video) before building multipart form data and posting to `/api/v1/media/upload`.
   - `createCheckout(input)`: Request `POST /api/checkout` with `{ productId, customerEmail, productSlug }`.

2. **CLI Commands Updates**:
   - `get.ts`: Add `-m, --markdown` flag. When provided, print raw markdown directly to stdout.
   - `list.ts`: Support `--limit` and `--offset`. Format table with `title`, `slug`, `trustScore`, `tagline`, and print count.
   - `submit.ts`:
     - Add `--org <orgId>` (defaults to `nlb-official`).
     - Add `--fast-track` and `--pay-only`.
     - Convert author document to server wire document format before sending revision.
     - If HTTP 402 is returned, display clean message with payment required details, amount, and Polar checkout link.
   - `rankings.ts`: Command `nlb rankings [window]` (daily, weekly, monthly) displaying community leaderboard table.
   - `stats.ts`: Command `nlb stats` displaying directory metrics (published products, clicks, builders, votes).
   - `doctor.ts`: Call `client.checkHealth()`. Check both HTTP reachable AND database status (`database === "connected"`). Exit with non-zero code if database is disconnected.
   - `vote.ts`: Command `nlb vote <productId> [--token <turnstileToken>] [--cookie <sessionCookie>]`. Inform user clearly if 401 is returned due to lack of browser session.
   - `upload.ts`: Command `nlb upload <filepath> [--folder <folder>]`. Perform client-side validation for file existence, size, and MIME allowlist.
   - `checkout.ts`: Command `nlb checkout <polarOfferId> [--email <email>] [--slug <slug>]`.
   - `cli.ts`: Register all new commands.

## Verification

- Command: `pnpm --filter "@nextlevelbuilder/cli" test`
- Observable: All CLI commands parse options, format outputs, and handle error responses gracefully.
