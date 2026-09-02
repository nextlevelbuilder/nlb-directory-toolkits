# Implementation Plan: Bootstrap `nextlevelbuilder/nlb-directory-toolkits`

- **Status**: completed
- **Author**: AI Assistant (Vibe Pipeline)
- **Date**: 2026-09-02
- **Goal**: Initialize and deliver the complete, production-ready `nextlevelbuilder/nlb-directory-toolkits` repository containing `@nextlevelbuilder/contracts`, `@nextlevelbuilder/cli`, `@nextlevelbuilder/mcp`, and `skills/nlb-submit/SKILL.md`.

## Architecture & Monorepo Structure

```text
nlb-directory-toolkits/
├── packages/
│   ├── contracts/       # Zod schemas, 16 block types, 5 layout templates, SHA-256 canonical hasher
│   │   ├── src/
│   │   │   ├── blocks/  # 16 block schemas
│   │   │   ├── document.ts
│   │   │   ├── templates.ts
│   │   │   ├── hasher.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── cli/             # @nextlevelbuilder/cli (nlb binary)
│   │   ├── src/
│   │   │   ├── commands/ # validate, preview, submit, list, get, status, template, doctor
│   │   │   ├── api/      # NextLevelBuilder API client
│   │   │   ├── preview/  # Terminal ASCII box renderer
│   │   │   ├── config.ts # API key & endpoint resolution chain
│   │   │   ├── index.ts
│   │   │   └── bin.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── mcp/             # @nextlevelbuilder/mcp (Model Context Protocol server)
│       ├── src/
│       │   ├── server.ts # JSON-RPC 2.0 MCP core server
│       │   ├── tools/    # validate_listing, submit_product, get_product, search_products, get_leaderboard, list_templates
│       │   ├── transports/
│       │   │   ├── stdio.ts
│       │   │   └── worker.ts (Cloudflare Workers fetch + SSE)
│       │   ├── index.ts
│       │   └── bin.ts
│       ├── tests/
│       ├── package.json
│       └── tsconfig.json
├── skills/
│   └── nlb-submit/
│       └── SKILL.md     # AgentSkill standard for Claude Code, Cursor, Codex, OpenCode, skills.sh
├── .github/
│   └── workflows/
│       └── ci.yml
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## Phases

- [Phase 1: Monorepo Foundation & `@nextlevelbuilder/contracts`](phase-01-contracts.md)
- [Phase 2: `@nextlevelbuilder/cli` (`nlb` binary)](phase-02-cli.md)
- [Phase 3: `@nextlevelbuilder/mcp` (Model Context Protocol Server)](phase-03-mcp.md)
- [Phase 4: AgentSkill `skills/nlb-submit/SKILL.md` & Documentation](phase-04-skill-and-docs.md)
- [Phase 5: Full Test Suite, Strict Typechecking, and CI Workflow](phase-05-tests-and-ci.md)

## Acceptance Criteria

1. `pnpm build` and `pnpm test` run clean 100% in TypeScript strict mode across all packages.
2. `@nextlevelbuilder/contracts` defines all 16 block types, 5 layout templates, and deterministic SHA-256 canonical hasher.
3. `@nextlevelbuilder/cli` provides executable `nlb` binary with `validate`, `preview`, `submit`, `list`, `get`, `status` commands and `--json` support.
4. `@nextlevelbuilder/mcp` implements JSON-RPC 2.0 with both stdio transport and Cloudflare Workers SSE/fetch transport, handling `validate_listing`, `submit_product`, `get_product`, `search_products`, `get_leaderboard`, `list_templates`.
5. `skills/nlb-submit/SKILL.md` conforms to standard AgentSkill specification compatible with Claude Code, Cursor, Codex, OpenCode, skills.sh, and Claude Plugins Marketplace.
6. Comprehensive unit and integration tests covering contracts, CLI commands, preview renderer, API client, MCP tools, and transports.
