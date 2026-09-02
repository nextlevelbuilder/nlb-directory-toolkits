import { z } from "zod";
import { BlockSchema, SafeHttpUrlSchema } from "./blocks/types.js";

export const Sha256HexHashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Hash must be a 64-character lowercase hexadecimal SHA-256 string");

// 1. Author-submitted metadata (does NOT allow author to self-assign trustScore or featured placement)
export const AuthorProductMetadataSchema = z.object({
  version: z.string().default("1.0.0"),
  layoutTemplate: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  repository: SafeHttpUrlSchema.optional(),
  documentation: SafeHttpUrlSchema.optional(),
  pricingModel: z.enum(["free", "freemium", "paid", "open_source"]).default("freemium"),
  badges: z.array(z.string().max(50)).default([]),
  custom: z.record(z.unknown()).optional()
});
export type AuthorProductMetadata = z.infer<typeof AuthorProductMetadataSchema>;

// 2. Canonical Product Metadata (includes server-assigned trustScore and featured flag)
export const ProductMetadataSchema = AuthorProductMetadataSchema.extend({
  featured: z.boolean().default(false),
  trustScore: z.number().min(0).max(100).default(0)
});
export type ProductMetadata = z.infer<typeof ProductMetadataSchema>;

// 3. Author Product Document (Author submission input)
export const AuthorProductDocumentSchema = z.object({
  id: z.string().optional(),
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
  logoUrl: SafeHttpUrlSchema.optional(),
  websiteUrl: SafeHttpUrlSchema,
  repoUrl: SafeHttpUrlSchema.optional(),
  blocks: z.array(BlockSchema).min(1).max(50),
  metadata: AuthorProductMetadataSchema.default({})
});
export type AuthorProductDocument = z.infer<typeof AuthorProductDocumentSchema>;

// 4. Canonical Product Document
export const ProductDocumentSchema = z.object({
  id: z.string().optional(),
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
  logoUrl: SafeHttpUrlSchema.optional(),
  websiteUrl: SafeHttpUrlSchema,
  repoUrl: SafeHttpUrlSchema.optional(),
  blocks: z.array(BlockSchema).min(1).max(50),
  metadata: ProductMetadataSchema.default({})
});
export type ProductDocument = z.infer<typeof ProductDocumentSchema>;

export const ProductSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  tagline: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  logoUrl: SafeHttpUrlSchema.optional(),
  websiteUrl: SafeHttpUrlSchema,
  trustScore: z.number().min(0).max(100),
  status: z.enum(["draft", "pending_review", "published", "rejected"]),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type ProductSummary = z.infer<typeof ProductSummarySchema>;

export const ProductRevisionSchema = z.object({
  revisionId: z.string(),
  productSlug: z.string(),
  contentHash: Sha256HexHashSchema,
  hashVersion: z.literal("v1").default("v1"),
  document: ProductDocumentSchema,
  status: z.enum(["draft", "pending_review", "published", "rejected"]).default("draft"),
  submittedAt: z.string().optional(),
  submitter: z.string().optional(),
  reviewerNote: z.string().optional()
});
export type ProductRevision = z.infer<typeof ProductRevisionSchema>;

export const ProductEnvelopeSchema = z.object({
  specVersion: z.literal("nlb-directory-v1").default("nlb-directory-v1"),
  contentHash: Sha256HexHashSchema,
  document: ProductDocumentSchema
});
export type ProductEnvelope = z.infer<typeof ProductEnvelopeSchema>;
