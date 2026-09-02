---
name: nlb-submit
description: Scan, structure, validate, and submit your project to the Next Level Builders Directory (https://nextlevelbuilder.io) with rich blocks, cryptographic content hashing, and automated moderation queueing.
user-invocable: true
when_to_use: "Use when the user wants to list, showcase, or submit their repository/product to Next Level Builders Directory."
category: dev-tools
keywords: [nextlevelbuilder, directory, submit, product-listing, ai-agent, cli, mcp, blocks, showcase]
argument-hint: "[--template <slug>] [--api-key <key>] [--url <url>] [--dry-run]"
metadata:
  author: Next Level Builders
  version: "0.1.0"
  homepage: "https://nextlevelbuilder.io"
  repository: "https://github.com/nextlevelbuilder/nlb-directory-toolkits"
  license: "MIT"
---

# NLB Submit (`nlb-submit`)

Autonomous AgentSkill for scanning a codebase, structuring a rich `ProductDocument` with 16 block types, computing canonical SHA-256 hashes, and submitting the listing to the **Next Level Builders Directory** (`https://nextlevelbuilder.io` or `https://staging.nextlevelbuilder.io`).

## Workflow

```text
[1. Scan Repo] -> [2. Select Template] -> [3. Author product.json] -> [4. Validate & Hash] -> [5. Preview] -> [6. Submit]
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
| **Developer CLI** | `developer-cli` | CLIs, terminal tools, developer packages | `hero`, `techStack`, `grid`, `roadmap`, `changelog`, `verification`, `cta` |
| **AI Agent / Tool** | `ai-agent-tool` | AI agents, LLMs, MCP servers | `hero`, `liveDemo`, `techStack`, `carousel`, `changelog`, `verification`, `cta` |
| **SaaS Launch** | `saas-launch` | Commercial apps, web services | `hero`, `mediaGallery`, `grid`, `pricing`, `faq`, `founder`, `cta` |
| **Curated Community** | `curated-community` | Communities, learning hubs, groups | `hero`, `grid`, `quote`, `milestones`, `faq`, `founder`, `cta` |
| **Minimalist Showcase** | `minimalist-showcase` | Portfolios, studios, focused tools | `hero`, `mediaGallery`, `caseStudy`, `quote`, `cta` |

Generate a starter template:
```bash
npx @nextlevelbuilder/cli template <slug> --out product.json
```

### 3. Author `product.json`
Fill out the document using the 16 supported block schemas from `@nextlevelbuilder/contracts`:

1. `hero` — Title, subtitle, badge, CTA buttons, alignment, theme.
2. `carousel` — Multi-slide showcase with autoplay.
3. `mediaGallery` — Multi-column screenshot/video gallery.
4. `quote` — Testimonial or community quote with rating.
5. `grid` — Feature and capability cards.
6. `changelog` — Version history and release notes.
7. `roadmap` — Planned, in-progress, and completed stages.
8. `pricing` — Transparent tiers with feature lists and popular badges.
9. `faq` — Accordion-style Q&A items.
10. `techStack` — Categorized technology badges and icons.
11. `liveDemo` — Embedded sandbox (`iframe`, `stackblitz`, `codesandbox`).
12. `cta` — Call to action card with primary/secondary actions.
13. `founder` — Founder profiles with bios and social links.
14. `verification` — Cryptographic or domain provenance verification.
15. `milestones` — Timeline of key achievements.
16. `caseStudy` — Client story with metrics and outcomes.

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

### 6. Submit to Directory
Submit the revision into the moderation review queue:

```bash
# Via CLI:
npx @nextlevelbuilder/cli submit product.json --api-key <YOUR_KEY>

# For staging environment:
npx @nextlevelbuilder/cli submit product.json --api-key <YOUR_KEY> --url https://staging.nextlevelbuilder.io

# Simulate with dry-run:
npx @nextlevelbuilder/cli submit product.json --dry-run
```

Check status anytime:
```bash
npx @nextlevelbuilder/cli status <your-product-slug>
```

## Security & Authenticity Invariants
- Deterministic hashing sorts all keys alphabetically and rejects non-finite numbers.
- Submissions are cryptographically anchored by `contentHash`.
- Never commit or log API keys. Use `NLB_API_KEY` or `--api-key`.
