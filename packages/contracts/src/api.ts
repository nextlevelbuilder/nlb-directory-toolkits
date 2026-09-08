import { z } from "zod";
import { ProductDocumentSchema, ProductSummarySchema, ProductRevisionSchema } from "./document.js";
import { SafeHttpUrlSchema } from "./blocks.js";

// 1. POST /api/v1/products - Create Product Draft
export const ProductCreateInputSchema = z.object({
  orgId: z.string().min(1, "Organization ID is required (must be your organization's UUID, find it at /studio)"),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with single hyphens"),
  title: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(100).optional(),
  tagline: z.string().min(1).max(200),
  websiteUrl: SafeHttpUrlSchema,
  logoUrl: SafeHttpUrlSchema.optional()
}).transform((data) => ({
  orgId: data.orgId,
  slug: data.slug,
  title: (data.title || data.name || "").trim(),
  tagline: data.tagline.trim(),
  websiteUrl: data.websiteUrl,
  logoUrl: data.logoUrl
})).pipe(
  z.object({
    orgId: z.string().min(1),
    slug: z.string().min(1).max(64),
    title: z.string().min(1, "Title is required").max(100),
    tagline: z.string().min(1).max(200),
    websiteUrl: SafeHttpUrlSchema,
    logoUrl: SafeHttpUrlSchema.optional()
  })
);
export type ProductCreateInput = z.infer<typeof ProductCreateInputSchema>;

export const ProductCreateResponseSchema = z.object({
  data: ProductSummarySchema.optional(),
  product: ProductSummarySchema.optional(),
  success: z.boolean().optional(),
  message: z.string().optional()
}).passthrough();
export type ProductCreateResponse = z.infer<typeof ProductCreateResponseSchema>;

// 2. POST /api/v1/products/[slug]/revisions - Upload Revision
export const ProductRevisionInputSchema = z.object({
  document: ProductDocumentSchema
});
export type ProductRevisionInput = z.infer<typeof ProductRevisionInputSchema>;

export const ProductRevisionResponseSchema = z.object({
  data: ProductRevisionSchema.optional(),
  revision: ProductRevisionSchema.optional(),
  success: z.boolean().optional(),
  message: z.string().optional()
}).passthrough().refine(
  (res) => Boolean(res.data?.id || res.data?.revisionId || res.revision?.id || res.revision?.revisionId),
  { message: "Product revision response must contain a valid revision identifier" }
);
export type ProductRevisionResponse = z.infer<typeof ProductRevisionResponseSchema>;

// 3. POST /api/v1/products/[slug]/submit - Submit Revision
export const ProductSubmitInputSchema = z.object({
  revisionId: z.string().uuid().optional(),
  submissionNotes: z.string().max(500).optional(),
  isFastTrack: z.boolean().optional(),
  payOnly: z.boolean().optional()
});
export type ProductSubmitInput = z.infer<typeof ProductSubmitInputSchema>;

export const ProductSubmitSuccessSchema = z.object({
  data: z.object({
    submissionId: z.string(),
    caseId: z.string().optional(),
    status: z.string().default("awaiting_human"),
    isEarlyBird: z.boolean().optional()
  }).passthrough(),
  message: z.string().optional(),
  success: z.boolean().optional()
}).passthrough();

export const ProductSubmitPaymentRequiredSchema = z.object({
  requiresPayment: z.literal(true),
  checkoutUrl: z.string(),
  amount: z.string(),
  isEarlyBird: z.boolean().optional(),
  slotNumber: z.number().optional(),
  error: z.string().optional()
}).passthrough();

export const ProductSubmitResponseSchema = z.union([
  ProductSubmitSuccessSchema,
  ProductSubmitPaymentRequiredSchema
]);
export type ProductSubmitResponse = z.infer<typeof ProductSubmitResponseSchema>;

// 4. GET /api/v1/products - List Products
export const ProductListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;

export const ProductListResponseSchema = z.object({
  data: z.array(ProductSummarySchema),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    count: z.number()
  })
}).passthrough();
export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;

// 5. GET /api/v1/products/[slug] - Product Details
export const ProductDetailResponseSchema = z.object({
  data: z.object({
    product: ProductSummarySchema,
    revision: ProductRevisionSchema.optional()
  }).passthrough()
}).passthrough();
export type ProductDetailResponse = z.infer<typeof ProductDetailResponseSchema>;

// 6. GET /api/v1/rankings - Community Rankings
export const RankingsQuerySchema = z.object({
  window: z.enum(["daily", "weekly", "monthly"]).default("daily")
});
export type RankingsQuery = z.infer<typeof RankingsQuerySchema>;

export const RankingItemSchema = z.object({
  rank: z.number(),
  productId: z.string(),
  voteCount: z.number(),
  score: z.number()
});
export type RankingItem = z.infer<typeof RankingItemSchema>;

export const RankingsResponseSchema = z.object({
  data: z.object({
    id: z.string().optional(),
    windowType: z.string(),
    windowDate: z.string().optional(),
    ranks: z.array(RankingItemSchema),
    snapshotHash: z.string().optional()
  }).passthrough()
}).passthrough();
export type RankingsResponse = z.infer<typeof RankingsResponseSchema>;

// 7. GET /api/v1/stats - Directory Metrics
export const StatsDataSchema = z.object({
  publishedCount: z.number(),
  outboundClicks: z.number(),
  registeredBuilders: z.number(),
  totalVotes: z.number()
});
export type StatsData = z.infer<typeof StatsDataSchema>;

export const StatsResponseSchema = z.object({
  success: z.boolean(),
  stats: StatsDataSchema.nullable(),
  updatedAt: z.string().optional(),
  error: z.string().optional()
}).passthrough();
export type StatsResponse = z.infer<typeof StatsResponseSchema>;

// 8. GET /api/health - Database & Runtime Health Probe
export const HealthResponseSchema = z.object({
  status: z.string(),
  database: z.string(),
  db_name: z.string().optional(),
  products_count: z.number().optional(),
  sample_product: z.unknown().optional(),
  timestamp: z.string(),
  service: z.string().optional(),
  error: z.string().optional(),
  stack: z.string().optional()
}).passthrough();
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// 9. POST /api/v1/votes - Cast Vote (Session Cookie Required)
export const VoteInputSchema = z.object({
  productId: z.string().uuid("Product ID must be a valid UUID"),
  turnstileToken: z.string().optional()
});
export type VoteInput = z.infer<typeof VoteInputSchema>;

export const VoteResponseSchema = z.object({
  data: z.unknown().optional(),
  error: z.string().optional()
}).passthrough();
export type VoteResponse = z.infer<typeof VoteResponseSchema>;

// 10. API Key Management (Session Cookie Required)
export const ApiKeyItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string().nullable().optional(),
  start: z.string().nullable().optional(),
  enabled: z.boolean(),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  organizationId: z.string().nullable()
});
export type ApiKeyItem = z.infer<typeof ApiKeyItemSchema>;

export const ApiKeyListResponseSchema = z.object({
  success: z.boolean().default(true),
  data: z.array(ApiKeyItemSchema)
}).passthrough();
export type ApiKeyListResponse = z.infer<typeof ApiKeyListResponseSchema>;

export const ApiKeyCreateInputSchema = z.object({
  name: z.string().min(1).max(64),
  organizationId: z.string().optional(),
  expiresDays: z.number().int().min(1).max(365).optional()
});
export type ApiKeyCreateInput = z.infer<typeof ApiKeyCreateInputSchema>;

export const ApiKeyCreateResponseSchema = z.object({
  success: z.boolean().default(true),
  message: z.string().optional(),
  data: z.object({
    id: z.string(),
    name: z.string(),
    prefix: z.string(),
    key: z.string(),
    expiresAt: z.string().nullable(),
    createdAt: z.string()
  })
}).passthrough();
export type ApiKeyCreateResponse = z.infer<typeof ApiKeyCreateResponseSchema>;

export const ApiKeyRevokeResponseSchema = z.object({
  success: z.boolean().default(true),
  message: z.string()
}).passthrough();
export type ApiKeyRevokeResponse = z.infer<typeof ApiKeyRevokeResponseSchema>;

// 11. POST /api/v1/media/upload - Media Upload
export const MediaUploadResponseSchema = z.object({
  success: z.boolean().default(true),
  url: z.string(),
  storageKey: z.string().optional(),
  sizeBytes: z.number().optional(),
  mimeType: z.string().optional(),
  provider: z.enum(["cloudflare-r2", "local-dev", "inline-data"]).optional(),
  error: z.string().optional()
}).passthrough();
export type MediaUploadResponse = z.infer<typeof MediaUploadResponseSchema>;

// 12. POST /api/checkout - Polar Checkout Session

export const CheckoutInputSchema = z.object({
  productId: z.string().min(1, "Product ID or Offer ID is required"),
  customerEmail: z.string().email().optional(),
  productSlug: z.string().optional()
});
export type CheckoutInput = z.infer<typeof CheckoutInputSchema>;

export const CheckoutResponseSchema = z.object({
  url: z.string().url()
}).passthrough();
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;
