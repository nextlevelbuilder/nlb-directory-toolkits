# Phase 1: Contracts API Schemas & Server Document Parity

- **Phase**: 1
- **Status**: pending
- **Target Files**:
  - `packages/contracts/src/api.ts`
  - `packages/contracts/src/document.ts`
  - `packages/contracts/src/blocks/types.ts`
  - `packages/contracts/src/index.ts`
  - `packages/contracts/tests/api.test.ts`
  - `packages/contracts/tests/document.test.ts`

## Scope & Changes

1. **Canonical Server Document Parity (`document.ts` & `blocks/types.ts`)**:
   - Define `CanonicalProductDocumentSchema` matching `/Volumes/GOON/www/nlb/nlb-web/packages/contracts/src/product.ts`:
     - `schemaVersion: z.literal(1).default(1)`
     - `title: z.string().min(1).max(100)`
     - `tagline: z.string().min(1).max(200)`
     - `description: z.string().min(10).max(2000)`
     - `websiteUrl: SafeHttpUrlSchema`
     - `logoUrl: SafeHttpUrlSchema.optional()`
     - `categorySlugs: z.array(z.string()).min(1).max(5)`
     - `tagSlugs: z.array(z.string()).max(10).default([])`
     - `blocks: z.array(ServerBlockSchema).default([])`
   - Define `ServerBlockSchema` where every block has `id: string`, `type: string`, and `props: Record<string, unknown>`.
   - Provide `toServerDocument(authorDoc)` converter:
     - Maps `title = authorDoc.title || authorDoc.name`
     - Maps `categorySlugs = authorDoc.categorySlugs || (authorDoc.category ? [authorDoc.category] : [])`
     - Maps `tagSlugs = authorDoc.tagSlugs || authorDoc.tags || []`
     - Maps blocks to `{ id: block.id || crypto.randomUUID(), type: block.type, props: block.props || ... }`.

2. **Update Request & Response Wire Schemas (`api.ts`)**:
   - `ProductCreateInputSchema`:
     - `{ orgId: string, slug: string, title: string, tagline: string, websiteUrl: string, logoUrl?: string }`.
     - Supports `name` as fallback alias mapped to `title`.
   - `ProductCreateResponseSchema`:
     - Matches server HTTP 201: `{ data: ProductSummarySchema }` (plus optional legacy fields for backward-compat).
   - `ProductRevisionInputSchema`:
     - Accepts `{ document: CanonicalProductDocumentSchema | AuthorProductDocumentSchema }`.
   - `ProductRevisionResponseSchema`:
     - Matches server HTTP 201: `{ data: ProductRevisionSchema }` (plus optional legacy fields).
   - `ProductSubmitInputSchema`:
     - `{ revisionId?: string, submissionNotes?: string, isFastTrack?: boolean, payOnly?: boolean }`.
   - `ProductSubmitResponseSchema`:
     - Success (200): `{ data: { submissionId: string, caseId?: string, status: string, isEarlyBird?: boolean } }`
     - Payment Required (402): `{ requiresPayment: true, checkoutUrl: string, amount: string, isEarlyBird?: boolean, slotNumber?: number }`
   - `ProductListQuerySchema`:
     - `{ limit?: number, offset?: number }` (plus optional `page` translated to offset).
   - `ProductListResponseSchema`:
     - `{ data: ProductListItemSchema[], pagination: { limit: number, offset: number, count: number } }`.
   - `ProductDetailResponseSchema`:
     - `{ data: { product: ProductSummarySchema, revision?: ProductRevisionSchema } }`.
   - `RankingsQuerySchema`:
     - `{ window?: "daily" | "weekly" | "monthly" }`.
   - `RankingsResponseSchema`:
     - Matches server: `{ data: { id?: string, windowType: string, windowDate: string, ranks: Array<{ rank: number, productId: string, voteCount: number, score: number }>, snapshotHash?: string } }`.
   - `StatsResponseSchema`:
     - `{ success: boolean, stats: { publishedCount: number, outboundClicks: number, registeredBuilders: number, totalVotes: number }, updatedAt: string }`.
   - `HealthResponseSchema`:
     - `{ status: string, database: string, db_name?: string, products_count?: number, sample_product?: unknown, timestamp: string, service?: string, error?: string, stack?: string }`.
   - `VoteInputSchema`:
     - `{ productId: string, turnstileToken?: string }`.
   - `VoteResponseSchema`:
     - Success: `{ data: unknown }`.
   - `ApiKeyItemSchema`:
     - Matches server DB select: `{ id: string, name: string, prefix: string, start: string, enabled: boolean, createdAt: string, expiresAt: string | null, organizationId: string | null }`.
   - `ApiKeyListResponseSchema`:
     - `{ success: boolean, data: ApiKeyItemSchema[] }`.
   - `ApiKeyCreateInputSchema`:
     - `{ name: string, organizationId?: string, expiresDays?: number }`.
   - `ApiKeyCreateResponseSchema`:
     - `{ success: boolean, message?: string, data: { id: string, name: string, prefix: string, key: string, expiresAt: string | null, createdAt: string } }`.
   - `ApiKeyRevokeResponseSchema`:
     - `{ success: boolean, message: string }`.
   - `MediaUploadResponseSchema`:
     - `{ success: boolean, url: string, filename?: string, size?: number, mimeType?: string }`.
   - `CheckoutInputSchema`:
     - `{ productId: string, customerEmail?: string, productSlug?: string }`.
   - `CheckoutResponseSchema`:
     - `{ url: string }`.

## Verification

- Command: `pnpm --filter "@nextlevelbuilder/contracts" test`
- Observable: All schemas parse server wire fixtures exactly and converters handle both author and server documents without error.
