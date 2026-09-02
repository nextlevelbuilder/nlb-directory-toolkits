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
│   ├── contracts/       # @nextlevelbuilder/contracts: Zod schemas, 16 block types, 5 templates, SHA-256 hasher
│   ├── cli/             # @nextlevelbuilder/cli: `nlb` binary (validate, preview, submit, list, get, status)
│   └── mcp/             # @nextlevelbuilder/mcp: Model Context Protocol server (stdio & Cloudflare Workers)
├── skills/
│   └── nlb-submit/      # SKILL.md: Standard AgentSkill for Claude Code, Cursor, Codex, OpenCode, skills.sh
└── docs/                # Detailed guides for CLI, MCP, Contracts, and Architecture
```

| Package | Description | Status |
|---|---|---|
| **`@nextlevelbuilder/contracts`** | Zod schemas for 16 block types, 5 layout templates, deterministic canonical SHA-256 hasher, and API contracts. | [![npm](https://img.shields.io/badge/contracts-v0.1.0-blue)](packages/contracts) |
| **`@nextlevelbuilder/cli`** | Developer & agent CLI binary `nlb` with validate, terminal box preview, submit, list, get, and status. | [![npm](https://img.shields.io/badge/cli-v0.1.0-green)](packages/cli) |
| **`@nextlevelbuilder/mcp`** | JSON-RPC 2.0 MCP server with stdio transport for local IDEs and fetch/SSE handler for Cloudflare Workers. | [![npm](https://img.shields.io/badge/mcp-v0.1.0-purple)](packages/mcp) |
| **`skills/nlb-submit`** | Cross-marketplace AgentSkill for autonomous repository scanning, formatting, and directory submission. | [![skill](https://img.shields.io/badge/skill-nlb--submit-orange)](skills/nlb-submit/SKILL.md) |

---

## ⚡ Quickstart

### 1. Using the CLI (`nlb`)

Validate and preview a product listing JSON without installing:

```bash
# Validate schema and compute SHA-256 canonical hash:
npx @nextlevelbuilder/cli validate product.json

# Render terminal ASCII box preview:
npx @nextlevelbuilder/cli preview product.json

# Generate a starter template:
npx @nextlevelbuilder/cli template developer-cli --out product.json

# Submit revision to directory:
npx @nextlevelbuilder/cli submit product.json --api-key <YOUR_API_KEY>

# Check moderation status:
npx @nextlevelbuilder/cli status my-awesome-tool
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
        "NLB_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

#### For Codex / OpenCode
```bash
npx -y @nextlevelbuilder/mcp
```

### 3. Using the AgentSkill (`skills/nlb-submit`)

To allow Claude Code or Cursor to autonomously submit your project, invoke:
```bash
/nlb-submit
```
The agent will inspect your repository, pick the optimal layout template, create `product.json`, validate it, render a preview, and submit it to `https://nextlevelbuilder.io`.

---

## 🧩 16 Supported Block Types

Every listing in Next Level Builders is composed of modular, strongly-typed blocks:

1. **`hero`**: Main showcase with headline, badges, CTAs, alignment, and themes.
2. **`carousel`**: Multi-slide image and feature rotation with autoplay.
3. **`mediaGallery`**: Responsive multi-column screenshot and video gallery.
4. **`quote`**: Testimonials, verified reviews, and ratings.
5. **`grid`**: Multi-column feature highlights and capability cards.
6. **`changelog`**: Version histories, release dates, and categorized changes.
7. **`roadmap`**: Planned, in-progress, and completed development milestones.
8. **`pricing`**: Tiers with billing periods, feature lists, and popular badges.
9. **`faq`**: Accordion Q&A list.
10. **`techStack`**: Categorized technology and runtime badges.
11. **`liveDemo`**: Embedded interactive sandbox (`iframe`, `stackblitz`, `codesandbox`).
12. **`cta`**: High-conversion call-to-action banner.
13. **`founder`**: Founder profiles, bios, and verified social links.
14. **`verification`**: Domain, DNS, or GitHub provenance proofs.
15. **`milestones`**: Key historical achievements with metrics.
16. **`caseStudy`**: In-depth customer story with problem, solution, and quantifiable results.

---

## 🔒 Cryptographic Content Hashing

Next Level Builders enforces immutable revision integrity via **deterministic canonical SHA-256 hashing**:
- Object keys are recursively sorted in lexicographical order.
- Negative zero (`-0`) is normalized to `0`.
- Non-finite numbers (`NaN`, `Infinity`) and circular references are rejected.
- Uses standard Web Crypto (`crypto.subtle`) ensuring cross-runtime determinism between Node.js 18-22, Cloudflare Workers, and browser environments.

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
