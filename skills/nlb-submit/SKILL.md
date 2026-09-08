---
name: nlb-submit
description: Scan, structure, validate, and submit your project to the Next Level Builders Directory (https://nextlevelbuilder.io) with 16 rich blocks, cryptographic content hashing, Polar payment handling, and automated moderation queueing.
user-invocable: true
when_to_use: "Use when the user wants to list, showcase, or submit their repository/product to Next Level Builders Directory."
category: dev-tools
keywords: [nextlevelbuilder, directory, submit, product-listing, ai-agent, cli, mcp, blocks, showcase]
argument-hint: "[--template <slug>] [--org <orgId>] [--api-key <key>] [--url <url>] [--dry-run]"
metadata:
  author: Next Level Builders
  version: "0.2.0"
  homepage: "https://nextlevelbuilder.io"
  repository: "https://github.com/nextlevelbuilder/nlb-directory-toolkits"
  license: "MIT"
---

# NLB Submit (`nlb-submit`)

Autonomous AgentSkill for scanning a codebase, structuring a rich `ProductDocument` with 16 block types, computing canonical SHA-256 hashes, and submitting the listing to the **Next Level Builders Directory** (`https://nextlevelbuilder.io` or `https://staging.nextlevelbuilder.io`).

## Workflow

```text
[1. Scan Repo] -> [2. Select Template] -> [3. Author product.json] -> [4. Validate & Hash] -> [5. Preview] -> [6. Submit & Activate]
```

### 1. Scan Repository
Analyze the current repository to extract metadata:
- **Project Name & Slug**: From `package.json` (`name`), `Cargo.toml`, `pyproject.toml`, or folder name.
- **Tagline & Description**: From `README.md` header or `package.json` `description`.
- **Tech Stack**: Inspect dependencies, framework configs (`next.config`, `vite.config`, `drizzle.config`), and runtime.
- **Repository URL**: Git remote URL (`git remote get-url origin`).
- **Website URL**: From `package.json` `homepage` or production URL.
- **Visuals / Screenshots**: Look for images in `docs/`, `public/`, or `screenshots/`.

### 2. Select a Layout Template
Choose one of the 5 pre-configured layout templates based on project type:

| Template | Slug | Best For | Included Blocks |
|---|---|---|---|
| **Developer Framework & CLI** | `dev-tool` | CLIs, terminal tools, developer packages | `hero`, `techStack`, `grid`, `changelog`, `cta` |
| **AI Tool & Autonomous Agent** | `ai-agent` | AI agents, LLMs, MCP servers | `hero`, `mediaGallery`, `grid`, `milestones`, `cta` |
| **SaaS Launch** | `saas-launch` | Commercial apps, web platforms, micro-SaaS | `hero`, `mediaGallery`, `grid`, `techStack`, `faq`, `cta` |
| **Curated Community / Directory** | `community-curated` | Communities, learning hubs, curated catalogs | `hero`, `founder`, `grid`, `cta` |
| **Minimalist Showcase** | `minimalist` | Single-fold portfolios, focused tools | `hero`, `mediaGallery`, `cta` |

Generate a starter template:
```bash
npx @nextlevelbuilder/cli template dev-tool --out product.json
```

### 3. Author `product.json`
Fill out the document using the 16 supported block schemas from `@nextlevelbuilder/contracts` (every block requires `id` and `props`):

1. `hero` — Headline, subheadline, primary CTA button, badge.
2. `carousel` — Multi-slide showcase with titles and image URLs.
3. `mediaGallery` — Multi-image gallery with aspect ratio and captions.
4. `quote` — Testimonial quote, author, title, avatar URL.
5. `grid` — Feature and capability cards (1-3 columns).
6. `changelog` — Version history and release entries.
7. `roadmap` — Planned, in-progress, and completed milestones.
8. `pricing` — Tiers with feature lists, pricing, and CTA links.
9. `faq` — Accordion-style Q&A items.
10. `techStack` — Categorized technology badges and icons.
11. `liveDemo` — Embedded sandbox (`iframe`, `height`, `sandboxTokens`).
12. `cta` — Call-to-action banner with primary action.
13. `founder` — Founder profile with bio, avatar, and social links.
14. `verification` — Cryptographic or domain provenance verification.
15. `milestones` — Timeline of key achievements.
16. `caseStudy` — Customer story with problem, solution, and outcome metrics.

### 4. Validate & Compute Canonical Hash
Validate schema and compute deterministic SHA-256 hash:

```bash
# Via CLI:
npx @nextlevelbuilder/cli validate product.json

# Via MCP Tool:
validate_listing(document={ ... })
```

### 5. Preview Terminal Box Art
Render ASCII/Unicode box preview in stdout:

```bash
npx @nextlevelbuilder/cli preview product.json
```

### 6. Submit & Activate
Submit the revision into the moderation review queue. Note: Supply your organization UUID from `https://nextlevelbuilder.io/studio`:

```bash
# Via CLI:
npx @nextlevelbuilder/cli submit product.json --org <ORG_UUID> --api-key <YOUR_KEY>

# For staging environment:
npx @nextlevelbuilder/cli submit product.json --org <ORG_UUID> --api-key <YOUR_KEY> --url https://staging.nextlevelbuilder.io

# Simulate with dry-run:
npx @nextlevelbuilder/cli submit product.json --dry-run
```

**Polar Payment Handling**:
If your organization does not yet possess an active directory publishing slot entitlement, the submission response returns a direct Polar checkout session URL:
```text
⚠ Payment Required to Activate Directory Listing Slot
• Amount:       $24.50 (Early Bird Slot)
• Checkout URL: https://polar.sh/checkout/...
• Complete checkout above to activate your listing in the review queue.
```
After completing payment via the Polar checkout URL, run `npx @nextlevelbuilder/cli submit product.json --org <ORG_UUID>` again to submit your revision into the moderation review queue.

Export AI-optimized Markdown for any published product:
```bash
npx @nextlevelbuilder/cli get <your-product-slug> --markdown
```

## Security & Authenticity Invariants
- Deterministic hashing sorts all keys alphabetically and computes consistent canonical SHA-256 digests.
- Submissions are cryptographically anchored by `contentHash`.
- Organization ownership is strictly validated anti-IDOR via `orgId`.
- Never commit or log API keys. Use `NLB_API_KEY` environment variable or `--api-key`.
