# CLI Documentation (`@nextlevelbuilder/cli`)

The `@nextlevelbuilder/cli` package provides the `nlb` binary for validating, previewing, submitting, and inspecting products on the Next Level Builders Directory.

## Installation

```bash
# Run directly via npx (recommended)
npx @nextlevelbuilder/cli <command>

# Or install globally
npm install -g @nextlevelbuilder/cli
```

## Commands

### 1. `nlb validate <file.json>`
Validates a product document JSON file against `@nextlevelbuilder/contracts` Zod schemas and outputs the deterministic SHA-256 canonical hash.

```bash
nlb validate product.json
nlb validate product.json --json
```

**Options**:
- `--json`: Output machine-readable JSON result `{ valid: boolean, contentHash?: string, errors?: Array }`.

---

### 2. `nlb preview <file.json>`
Renders a visual terminal preview of the product document with Unicode box borders and syntax-colored blocks.

```bash
nlb preview product.json
nlb preview product.json --json
```

---

### 3. `nlb submit <file.json>`
Submits a product revision into the Next Level Builders Directory review queue. If a paid publishing slot is not yet active, the command provides a direct Polar checkout URL.

```bash
nlb submit product.json --org <ORG_UUID> --api-key <YOUR_API_KEY>
nlb submit product.json --org <ORG_UUID> --fast-track
nlb submit product.json --org <ORG_UUID> --pay-only
nlb submit product.json --dry-run
nlb submit product.json --json
```

**Options**:
- `-o, --org <orgId>`: Organization UUID identifier (required, find at `/studio`).
- `-k, --api-key <key>`: Next Level Builders API Key (`nlb_live_...` or `NLB_API_KEY` env var).
- `-u, --url <url>`: Directory base URL (default: `https://nextlevelbuilder.io`).
- `-n, --notes <notes>`: Notes for the moderation review team.
- `--fast-track`: Request fast-track priority review.
- `--pay-only`: Generate Polar checkout session without immediate moderation submission.
- `--dry-run`: Validate schema, compute hash, and simulate submission without sending network mutation.
- `--json`: Output result as JSON.

---

### 4. `nlb list`
Lists products registered on the directory with Trust Scores and status.

```bash
nlb list
nlb list --limit 10 --offset 0
nlb list --page 2
nlb list --json
```

**Options**:
- `-l, --limit <limit>`: Max products to return (1-50, default: 20).
- `--offset <offset>`: Pagination offset (default: 0).
- `-p, --page <page>`: Page number (calculated into offset).
- `--json`: Output products list in machine-readable JSON format.

---

### 5. `nlb get <slug>`
Fetches detailed product information and block summaries by product slug, or exports raw LLM-optimized Markdown.

```bash
# Structured view:
nlb get my-product-slug

# Raw Markdown for LLMs / AI agents:
nlb get my-product-slug --markdown
nlb get my-product-slug --markdown > product.md

# JSON metadata:
nlb get my-product-slug --json
```

**Options**:
- `-m, --markdown`: Print raw LLM Markdown representation directly to stdout.
- `--json`: Output full product object in JSON format.

---

### 6. `nlb rankings [window]`
Fetches transparent community ranking snapshots and leaderboards.

```bash
# Daily snapshot (default):
nlb rankings

# Weekly or monthly window:
nlb rankings weekly
nlb rankings monthly
nlb rankings --json
```

---

### 7. `nlb stats`
Displays live global platform metrics and directory statistics.

```bash
nlb stats
nlb stats --json
```

Outputs:
- Published products count
- Outbound click-outs
- Registered builders
- Total community votes

---

### 8. `nlb vote <productId>`
Casts an organic community vote for a product. Note: Organic voting requires user session authentication to prevent automated bot voting.

```bash
nlb vote <PRODUCT_UUID> --cookie "<SESSION_COOKIE>"
nlb vote <PRODUCT_UUID> --token "<TURNSTILE_TOKEN>"
```

---

### 9. `nlb upload <filepath>`
Uploads images (up to 10MB) or videos (up to 100MB) to Next Level Builders media storage with client-side format and size verification.

```bash
nlb upload screenshot.png
nlb upload demo.mp4 --folder "showcase"
nlb upload asset.png --json
```

---

### 10. `nlb checkout <productId>`
Generates a Polar checkout session URL for purchasing directory publishing slots or memberships using a Polar product UUID.

```bash
nlb checkout <POLAR_PRODUCT_UUID> --email builder@example.com --slug my-tool
```

---

### 11. `nlb keys [list|create|revoke]`
Manages developer API keys. Requires user session cookie authentication.

```bash
# List active API keys:
nlb keys list --cookie "<SESSION_COOKIE>"

# Create a new key:
nlb keys create "CI Deployment Key" --cookie "<SESSION_COOKIE>"

# Revoke a key by ID:
nlb keys revoke <KEY_ID> --cookie "<SESSION_COOKIE>"
```
---

### 12. `nlb template [slug]`
Lists available layout templates or generates a starter JSON file with 16-block compliant blueprints.

```bash
# List all templates:
nlb template

# Generate starter file:
nlb template dev-tool --out product.json
nlb template saas-launch --out saas.json
nlb template ai-agent --out agent.json
```

---

### 13. `nlb config`
Reads or sets CLI configuration stored in `~/.nlb/config.json`.

```bash
nlb config
nlb config set api-key nlb_live_your_key_here
nlb config set url https://staging.nextlevelbuilder.io
```

### 14. `nlb doctor`
Performs system, configuration, API connectivity, and database health diagnostics. Evaluates semantic database health.

```bash
nlb doctor
nlb doctor -u https://staging.nextlevelbuilder.io
nlb doctor --json
```
