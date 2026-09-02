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
Submits a product revision into the Next Level Builders Directory review queue.

```bash
nlb submit product.json --api-key <YOUR_API_KEY>
nlb submit product.json --api-key <KEY> --url https://staging.nextlevelbuilder.io
nlb submit product.json --dry-run
nlb submit product.json --json
```

**Options**:
- `-k, --api-key <key>`: Next Level Builders API Key (or `NLB_API_KEY` env var).
- `-u, --url <url>`: Directory base URL (default: `https://nextlevelbuilder.io`).
- `-n, --notes <notes>`: Notes for the moderation review team.
- `--dry-run`: Validate schema, compute hash, and simulate submission without sending network mutation.
- `--json`: Output result as JSON.

---

### 4. `nlb list`
Lists products registered on the directory with Trust Scores and status.

```bash
nlb list
nlb list --category "Developer Tools"
nlb list --status published --limit 10
nlb list --json
```

---

### 5. `nlb get <slug>`
Fetches detailed product information and block summaries by product slug.

```bash
nlb get my-product-slug
nlb get my-product-slug --json
```

---

### 6. `nlb status <slug>`
Checks moderation status (`draft`, `pending_review`, `published`, `rejected`), Trust Score, and latest content hash.

```bash
nlb status my-product-slug
nlb status my-product-slug --json
```

---

### 7. `nlb template [slug]`
Lists available layout templates or generates a starter JSON file.

```bash
# List all templates:
nlb template

# Generate starter file:
nlb template developer-cli --out product.json
nlb template saas-launch --out saas.json
nlb template ai-agent-tool --out agent.json
```

---

### 8. `nlb config`
Reads or sets CLI configuration stored in `~/.nlb/config.json`.

```bash
# View configuration
nlb config

# Set API key
nlb config set api-key nlb_live_your_key_here

# Set custom API URL
nlb config set url https://staging.nextlevelbuilder.io
```

---

### 9. `nlb doctor`
Performs system, configuration, and endpoint connectivity diagnostics.

```bash
nlb doctor
nlb doctor --json
```
