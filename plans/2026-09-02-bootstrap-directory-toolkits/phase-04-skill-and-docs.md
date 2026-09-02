# Phase 4: AgentSkill `skills/nlb-submit/SKILL.md` & Documentation

## Context & Objectives
Author the comprehensive standard AgentSkill `skills/nlb-submit/SKILL.md` compatible with Claude Code, Cursor, Codex, OpenCode, skills.sh, and plugin marketplaces. Write the root `README.md` and package documentation.

## Files to Modify/Create
- `skills/nlb-submit/SKILL.md`
- `skills/nlb-submit/metadata.json`
- `README.md`
- `docs/cli.md`
- `docs/mcp.md`
- `docs/contracts.md`
- `docs/architecture.md`

## Requirements
1. `skills/nlb-submit/SKILL.md`:
   - Full YAML frontmatter with `name`, `description`, `category`, `keywords`, `argument-hint`, `metadata` (marketplace compatibility).
   - Step-by-step workflow:
     1. Analyze current repository (extract name, description, tech stack, screenshots, repository info, license).
     2. Select suitable template (`SaaS Launch`, `AI Agent / Tool`, `Developer CLI`, `Curated Community`, `Minimalist Showcase`).
     3. Generate `product.json` containing 16 supported block types.
     4. Validate locally using `npx @nextlevelbuilder/cli validate product.json` or MCP tool `validate_listing`.
     5. Preview in terminal with `npx @nextlevelbuilder/cli preview product.json`.
     6. Submit to Next Level Builders Directory via CLI or MCP.
2. Root `README.md`:
   - Quickstart guide for developers and AI agents.
   - CLI installation and usage examples.
   - MCP integration guide for Claude Desktop, Cursor, Codex, OpenCode.
   - Architecture overview and development instructions.
3. Sub-docs for CLI, MCP, and Contracts.

## Validation
- Verify `SKILL.md` syntax, frontmatter correctness, and doc links.
