import { z } from "zod";
import { ProductDocumentSchema, ProductSummarySchema, ProductRevisionSchema, Sha256HexHashSchema } from "./document.js";
import { SafeHttpUrlSchema } from "./blocks/types.js";

// POST /api/v1/products
export const ProductCreateInputSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with optional single hyphens"),
  tagline: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  category: z.string().min(1).max(50),
  tags: z.array(z.string().min(1).max(30)).min(1).max(20),
  websiteUrl: SafeHttpUrlSchema,
  repoUrl: SafeHttpUrlSchema.optional(),
  logoUrl: SafeHttpUrlSchema.optional()
});
export type ProductCreateInput = z.infer<typeof ProductCreateInputSchema>;

export const ProductCreateResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  product: ProductSummarySchema
});
export type ProductCreateResponse = z.infer<typeof ProductCreateResponseSchema>;

// POST /api/v1/products/[slug]/revisions
export const ProductRevisionInputSchema = z.object({
  contentHash: Sha256HexHashSchema,
  hashVersion: z.literal("v1").default("v1"),
  document: ProductDocumentSchema
});
export type ProductRevisionInput = z.infer<typeof ProductRevisionInputSchema>;

export const ProductRevisionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  revision: ProductRevisionSchema
});
export type ProductRevisionResponse = z.infer<typeof ProductRevisionResponseSchema>;

// POST /api/v1/products/[slug]/submit
export const ProductSubmitInputSchema = z.object({
  revisionId: z.string().min(1).optional(),
  notes: z.string().max(1000).optional()
});
export type ProductSubmitInput = z.infer<typeof ProductSubmitInputSchema>;

export const ProductSubmitResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  submissionId: z.string().min(1),
  status: z.enum(["pending_review", "published", "draft", "rejected"]),
  estimatedReviewHours: z.number().optional()
});
export type ProductSubmitResponse = z.infer<typeof ProductSubmitResponseSchema>;

// GET /api/v1/products
export const ProductListQuerySchema = z.object({
  category: z.string().optional(),
  tag: z.string().optional(),
  status: z.enum(["draft", "pending_review", "published", "rejected"]).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sort: z.enum(["trust_score", "newest", "alphabetical"]).default("trust_score")
});
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;

export const ProductListResponseSchema = z.object({
  success: z.boolean(),
  products: z.array(ProductSummarySchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number()
  })
});
export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;

// GET /api/v1/products/[slug]
export const ProductDetailResponseSchema = z.object({
  success: z.boolean(),
  product: ProductSummarySchema,
  latestDocument: ProductDocumentSchema.optional(),
  activeRevision: ProductRevisionSchema.optional()
});
export type ProductDetailResponse = z.infer<typeof ProductDetailResponseSchema>;

// GET /api/v1/products/[slug]/status
export const ProductStatusResponseSchema = z.object({
  slug: z.string(),
  status: z.enum(["draft", "pending_review", "published", "rejected"]),
  trustScore: z.number().min(0).max(100),
  activeRevisionId: z.string().optional(),
  contentHash: Sha256HexHashSchema.optional(),
  lastUpdated: z.string()
});
export type ProductStatusResponse = z.infer<typeof ProductStatusResponseSchema>;

// GET /api/v1/leaderboard
export const LeaderboardQuerySchema = z.object({
  timeframe: z.enum(["daily", "weekly", "monthly", "all_time"]).default("all_time"),
  limit: z.number().int().min(1).max(50).default(10)
});
export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;

export const LeaderboardResponseSchema = z.object({
  timeframe: z.enum(["daily", "weekly", "monthly", "all_time"]),
  leaderboard: z.array(
    z.object({
      rank: z.number().int().min(1),
      product: ProductSummarySchema,
      score: z.number(),
      upvotes: z.number().int().default(0)
    })
  )
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

// GET /api/v1/search
export const SearchQuerySchema = z.object({
  q: z.string().min(1),
  category: z.string().optional(),
  tag: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10)
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchResponseSchema = z.object({
  query: z.string(),
  totalResults: z.number(),
  results: z.array(ProductSummarySchema)
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
