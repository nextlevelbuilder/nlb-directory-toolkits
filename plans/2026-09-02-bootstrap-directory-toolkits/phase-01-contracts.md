# Phase 1: Monorepo Foundation & `@nextlevelbuilder/contracts`

## Context & Objectives
Scaffold the pnpm workspace monorepo and implement the foundational `@nextlevelbuilder/contracts` package defining Zod schemas, 16 block types, 5 layout templates, and canonical SHA-256 document hashing.

## Files to Modify/Create
- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `tsconfig.json`
- `vitest.config.ts`
- `packages/contracts/package.json`
- `packages/contracts/tsconfig.json`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/blocks/index.ts`
- `packages/contracts/src/blocks/types.ts`
- `packages/contracts/src/document.ts`
- `packages/contracts/src/templates.ts`
- `packages/contracts/src/hasher.ts`
- `packages/contracts/tests/blocks.test.ts`
- `packages/contracts/tests/hasher.test.ts`
- `packages/contracts/tests/templates.test.ts`

## Requirements
1. **16 Block Types**:
   - `hero`, `carousel`, `mediaGallery`, `quote`, `grid`, `changelog`, `roadmap`, `pricing`, `faq`, `techStack`, `liveDemo`, `cta`, `founder`, `verification`, `milestones`, `caseStudy`.
   - Each block has a discriminated union tag `type` and strongly typed props.
2. **Product Document & Revision**:
   - `ProductDocumentSchema` (id, name, slug, tagline, description, category, tags, logoUrl, websiteUrl, repoUrl, blocks, metadata).
   - `ProductEnvelopeSchema` and `ProductSubmissionSchema`.
3. **5 Layout Templates**:
   - `SaaS Launch`, `AI Agent / Tool`, `Developer CLI`, `Curated Community`, `Minimalist Showcase`.
   - Helper function `getTemplate(name)` and `listTemplates()`.
4. **Canonical SHA-256 Hasher**:
   - `canonicalizeJson(data: unknown): string`: Recursively sort object keys alphabetically, serialize numbers/strings/booleans/arrays deterministically.
   - `computeContentHash(doc: unknown): string`: SHA-256 hash formatted in hex.
   - `verifyContentHash(doc: unknown, expectedHash: string): boolean`.

## Validation
- Run `pnpm test packages/contracts` to verify all schemas, template generation, and hash canonicalization.
