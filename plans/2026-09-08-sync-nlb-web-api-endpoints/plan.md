# Implementation Plan: Synchronize Directory Toolkits with NLB Web API Endpoints

- **Status**: completed
- **Author**: AI Assistant (Vibe Pipeline with Kongming Advisory Supervision)
- **Date**: 2026-09-08
- **Goal**: Reconcile `@nextlevelbuilder/contracts`, `@nextlevelbuilder/cli`, and `@nextlevelbuilder/mcp` with the canonical server implementation in `/Volumes/GOON/www/nlb/nlb-web/`, establishing this repository as the authoritative single source of truth for the toolkit packages.

## Architecture Decision Record (ADR): Source of Truth & Wholesale Parity

1. **Single Source of Truth**: `@nextlevelbuilder/contracts`, `@nextlevelbuilder/cli`, and `@nextlevelbuilder/mcp` in `nlb-directory-toolkits` are the canonical publishing source. `nlb-web`'s server schemas in `nlb-web/packages/contracts/src/{product.ts,blocks.ts}` are ported wholesale into this repository so schema drift is structurally eliminated.
2. **Wholesale Schema Adoption (Option A)**: Adopt the server's 16-block closed discriminated union and canonical `ProductDocumentSchema` (`schemaVersion: 1`, `title`, `tagline`, `description`, `websiteUrl`, `logoUrl?`, `categorySlugs`, `tagSlugs`, `blocks: BlockSchema[]`).
3. **Template Migration**: Rewrite `packages/contracts/src/templates.ts` to generate compliant blocks with `id: string` and typed `props`, guaranteeing `nlb template` produces documents that pass server validation 100%.
4. **Phantom Endpoint Deletion**: Delete `searchProducts`, `getProductStatus`, and legacy `/leaderboard` endpoints/commands/tools that do not exist on the server. Repoint ranking operations to `/api/v1/rankings`.
5. **Organization ID**: Make `orgId` required in CLI `submit` (`--org <uuid>`) and MCP `submit_product` (`org_id`), rejecting the non-existent `"nlb-official"` default with actionable guidance.
6. **Hasher Parity**: Ensure `computeContentHash` implements the server's canonical key-sorted serialization + SHA-256 algorithm.
7. **Semantic Health & Security**: Tighten MCP SSRF check (reject `.local`), enforce client-side upload limits, and evaluate semantic health in `nlb doctor`.

## Phased Roadmap

- [Phase 1: Canonical Contracts Wholesale Parity & Template Migration](phase-01-contracts-api-schemas.md)
- [Phase 2: CLI Client Expansion, Commands & Phantom Endpoint Deletion](phase-02-cli-api-client-and-commands.md)
- [Phase 3: MCP Tools Parity & Transport Hardening](phase-03-mcp-tools-and-transports.md)
- [Phase 4: Agent Skill & Documentation Updates](phase-04-docs-and-skill-updates.md)
- [Phase 5: Verification, Tests & CI Convergence](phase-05-tests-and-ci.md)

## Kongming Advisory Verdict: CONDITIONAL GO -> RESOLVED
All 5 blocking corrections (B1-B5) and 11 non-blocking corrections (C1-C11) have been adopted:
- B1: Toolkit repo established as canonical single source of truth.
- B2: Closed discriminated union of 16 typed blocks adopted wholesale.
- B3: Templates migrated to emit typed `{ id, type, props }` blocks.
- B4: `--org` / `org_id` made required (UUID), avoiding 403.
- B5: `MediaUploadResponseSchema` supports relative `/uploads/` and data URIs.
- C1-C11: Phantom endpoints deleted, 402 string amounts handled, rankings `ranks` passthrough, Polar enum aliases added.

Status: READY FOR IMPLEMENTATION.
