# Phase 2: `@nextlevelbuilder/cli` (`nlb` binary)

## Context & Objectives
Implement the CLI package `@nextlevelbuilder/cli` with Commander.js providing terminal tools for developers and AI agents to validate, preview, submit, list, get, and inspect directory products.

## Files to Modify/Create
- `packages/cli/package.json`
- `packages/cli/tsconfig.json`
- `packages/cli/src/bin.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/config.ts`
- `packages/cli/src/api/client.ts`
- `packages/cli/src/preview/ascii.ts`
- `packages/cli/src/commands/validate.ts`
- `packages/cli/src/commands/preview.ts`
- `packages/cli/src/commands/submit.ts`
- `packages/cli/src/commands/list.ts`
- `packages/cli/src/commands/get.ts`
- `packages/cli/src/commands/status.ts`
- `packages/cli/src/commands/template.ts`
- `packages/cli/src/commands/doctor.ts`
- `packages/cli/tests/cli.test.ts`
- `packages/cli/tests/preview.test.ts`

## Requirements
1. `nlb validate <file.json>`:
   - Reads file, validates against `ProductDocumentSchema`, computes SHA-256 hash.
   - Prints clear validation errors if invalid; prints green success message with content hash if valid.
2. `nlb preview <file.json>`:
   - Renders beautiful ASCII / Unicode box art preview in the terminal, visualizing product header, badge, blocks (hero, pricing table, tech stack badges, faq, etc.).
3. `nlb submit <file.json> --api-key <key> [--url <url>]`:
   - Validates JSON, computes canonical hash, orchestrates 3-step submission API:
     1. `POST /api/v1/products` (creates product metadata or fetches existing)
     2. `POST /api/v1/products/[slug]/revisions` (uploads revision payload and hash)
     3. `POST /api/v1/products/[slug]/submit` (submits revision into moderation queue)
4. `nlb list [--url <url>] [--category <cat>] [--limit <n>]`:
   - Fetches product list from directory, renders formatted table with Trust Score, name, slug, category, status.
5. `nlb get <slug> [--url <url>]`:
   - Fetches product details and block outline.
6. `nlb status <slug> [--url <url>]`:
   - Checks moderation state (`draft`, `pending_review`, `published`, `rejected`).
7. Flag `--json` on all commands for machine-readable scriptability.
8. Auth resolution chain: `--api-key` flag -> `NLB_API_KEY` env -> local config file (`~/.nlb/config.json` or `./.nlbrc.json`).

## Validation
- Unit & integration tests for CLI commands and output formatting with Vitest.
