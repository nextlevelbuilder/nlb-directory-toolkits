# Next Level Builders Directory Toolkits

> Monorepo containing the official TypeScript Contracts, CLI (`nlb`), Model Context Protocol (MCP) Server, and AgentSkill for **[Next Level Builders Directory](https://nextlevelbuilder.io)**.

[![CI](https://github.com/nextlevelbuilder/nlb-directory-toolkits/actions/workflows/ci.yml/badge.svg)](https://github.com/nextlevelbuilder/nlb-directory-toolkits/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@nextlevelbuilder/cli.svg)](https://www.npmjs.com/package/@nextlevelbuilder/cli)

---

## 📦 Packages & Architecture

```text
nlb-directory-toolkits/
├── packages/
│   ├── contracts/       # @nextlevelbuilder/contracts: Zod schemas, 17 block types, 5 templates, SHA-256 hasher, wire APIs
│   ├── cli/             # @nextlevelbuilder/cli: `nlb` binary (validate, preview, submit, list, get, rankings, stats, traffic, doctor, vote, keys, upload, checkout)
│   └── mcp/             # @nextlevelbuilder/mcp: Model Context Protocol server (stdio & Cloudflare Workers, 16 tools)
├── skills/
│   └── nlb-submit/      # SKILL.md: Standard AgentSkill for Claude Code, Cursor, Codex, OpenCode, skills.sh
└── docs/                # Detailed guides for CLI, MCP, Contracts, and Architecture
```

| Package | Description | Status |
|---|---|---|
| **`@nextlevelbuilder/contracts`** | Canonical server-synchronized schemas for 17 block types, 5 layout templates, deterministic canonical SHA-256 hasher, and API wire contracts. | [![npm](https://img.shields.io/badge/contracts-v0.2.0-blue)](packages/contracts) |
| **`@nextlevelbuilder/cli`** | Developer & agent CLI binary `nlb` with validation, terminal preview, submissions with Polar payments, rankings, stats, doctor, voting, and uploads. | [![npm](https://img.shields.io/badge/cli-v0.2.0-green)](packages/cli) |
| **`@nextlevelbuilder/mcp`** | Model Context Protocol server exposing 16 tools for local AI IDEs and Cloudflare Workers edge runtime. | [![npm](https://img.shields.io/badge/mcp-v0.2.0-purple)](packages/mcp) |
| **`skills/nlb-submit`** | Cross-marketplace AgentSkill for autonomous repository scanning, block formatting, and directory submission. | [![skill](https://img.shields.io/badge/skill-nlb--submit-orange)](skills/nlb-submit/SKILL.md) |

---

## ⚡ Quickstart

### 1. Using the CLI (`nlb`)

```bash
# Validate schema and compute SHA-256 canonical hash:
npx @nextlevelbuilder/cli validate product.json

# Render terminal ASCII box preview:
npx @nextlevelbuilder/cli preview product.json

# Generate a starter template:
npx @nextlevelbuilder/cli template dev-tool --out product.json

# Submit revision to directory review queue (supports Polar checkout if slot needed):
npx @nextlevelbuilder/cli submit product.json --org <YOUR_ORG_UUID> --api-key <YOUR_API_KEY>

# View organic community rankings / leaderboard:
npx @nextlevelbuilder/cli rankings weekly

# Check live platform metrics and statistics:
npx @nextlevelbuilder/cli stats

# Query your product's NLB page traffic using the configured API key:
npx @nextlevelbuilder/cli traffic my-awesome-tool --json

# Export raw LLM-optimized Markdown for any product:
npx @nextlevelbuilder/cli get my-awesome-tool --markdown

# Check database and endpoint connectivity:
npx @nextlevelbuilder/cli doctor
```

### 2. Setting up the MCP Server

#### For Cursor (`.cursor/mcp.json`)
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

#### For Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "nlb-directory": {
      "command": "npx",
      "args": ["-y", "@nextlevelbuilder/mcp"],
      "env": {
        "NLB_API_KEY": "nlb_live_your_key_here"
      }
    }
  }
}
```

---

## 🧩 17 Supported Block Types

Every listing in Next Level Builders is composed of modular, strongly-typed blocks with `id` and `props`:

1. **`hero`**: Main showcase with headline, subheadline, CTA, and badge.
2. **`carousel`**: Multi-slide image rotation with titles and image URLs.
3. **`mediaGallery`**: Responsive multi-column screenshot and video gallery.
4. **`quote`**: Testimonials, verified reviews, and author credentials.
5. **`grid`**: Multi-column feature highlights and capability cards (1-3 cols).
6. **`changelog`**: Version histories, release dates, and categorized change notes.
7. **`roadmap`**: Planned, in-progress, and completed development milestones.
8. **`pricing`**: Tiers with billing periods, feature lists, and popular badges.
9. **`faq`**: Accordion Q&A items.
10. **`techStack`**: Categorized technology and runtime badges.
11. **`liveDemo`**: Embedded interactive sandbox (`iframe`, `height`, `sandboxTokens`).
12. **`cta`**: High-conversion call-to-action banner.
13. **`founder`**: Founder profiles, bios, and verified social links.
14. **`verification`**: Metric and platform provenance proofs.
15. **`milestones`**: Key historical achievements with metrics.
16. **`caseStudy`**: In-depth customer story with problem, solution, and quantifiable results.
17. **`analytics`**: Real NLB product page traffic with configurable title and 7/30/90-day period. Publishing opts into public aggregate totals and daily series; detailed traffic remains organization-authorized. See [Analytics block and traffic contracts](docs/contracts.md).

---

## 🛠️ Development & Monorepo Workflow

### Prerequisites
- Node.js >= 18.0.0
- pnpm >= 9.0.0

### Commands
```bash
# Install dependencies
pnpm install

# Build all packages in topological order
pnpm build

# Run comprehensive test suite across all packages (Vitest)
pnpm test

# Typecheck with TypeScript strict mode
pnpm type-check
```

---

## 📖 Documentation
- [CLI Reference](docs/cli.md) — Comprehensive command and flag documentation
- [MCP Reference](docs/mcp.md) — Tool specifications and Cloudflare Workers deployment
- [Contracts Reference](docs/contracts.md) — Zod schemas and layout templates
- [System Architecture](docs/architecture.md) — Core/adapter boundary and cryptographic design

---

## 📄 License
MIT © [Next Level Builders](https://nextlevelbuilder.io)
