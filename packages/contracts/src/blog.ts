import { z } from "zod";

/**
 * Blog management wire contract (`/api/v1/blog/*`).
 *
 * These schemas enforce only the structural limits shared with the server.
 * Block props stay `Record<string, unknown>` on purpose: the authoritative
 * per-block validation lives on the server (`POST /api/v1/blog/validate`) and
 * the block catalogue (`GET /api/v1/blog/blocks`) describes each props schema.
 */

export const BLOG_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const BLOG_LIMITS = {
  slugMaxLength: 96,
  titleMaxLength: 160,
  descriptionMaxLength: 320,
  maxBlocks: 60,
  /** Maximum UTF-8 byte length of `JSON.stringify(blocks)` (200 KB). */
  maxBlocksBytes: 200 * 1024,
  maxTags: 12,
  tagMaxLength: 32,
  idempotencyKeyMaxLength: 128
} as const;

export const BLOG_LOCALES = ["en", "vi"] as const;
export const BlogLocaleSchema = z.enum(BLOG_LOCALES);
export type BlogLocale = z.infer<typeof BlogLocaleSchema>;

export const BLOG_STATUSES = ["draft", "published", "archived"] as const;
export const BlogStatusSchema = z.enum(BLOG_STATUSES);
export type BlogStatus = z.infer<typeof BlogStatusSchema>;

/** List filter: the three statuses plus `all` (admin only for anything but `published`). */
export const BlogStatusFilterSchema = z.enum([...BLOG_STATUSES, "all"]);
export type BlogStatusFilter = z.infer<typeof BlogStatusFilterSchema>;

export const BlogBlockSchema = z.object({
  type: z.string().min(1, "Block type is required"),
  props: z.record(z.unknown()),
  id: z.string().min(1).optional()
});
export type BlogBlock = z.infer<typeof BlogBlockSchema>;

/** UTF-8 byte length of the serialized blocks array, as measured by the server limit. */
export function blogBlocksByteLength(blocks: unknown): number {
  return new TextEncoder().encode(JSON.stringify(blocks)).length;
}

export const BlogBlocksSchema = z
  .array(BlogBlockSchema)
  .max(BLOG_LIMITS.maxBlocks, `A post can contain at most ${BLOG_LIMITS.maxBlocks} blocks`)
  .superRefine((blocks, ctx) => {
    const bytes = blogBlocksByteLength(blocks);
    if (bytes > BLOG_LIMITS.maxBlocksBytes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Serialized blocks are ${bytes} bytes; the limit is ${BLOG_LIMITS.maxBlocksBytes} bytes (200 KB)`
      });
    }
  });

export const BlogSeoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  ogImage: z.string().optional(),
  canonical: z.string().optional(),
  noindex: z.boolean().optional()
});
export type BlogSeo = z.infer<typeof BlogSeoSchema>;

export const BlogSlugSchema = z
  .string()
  .min(1, "Slug is required")
  .max(BLOG_LIMITS.slugMaxLength)
  .regex(BLOG_SLUG_REGEX, "Slug must be lowercase alphanumeric words separated by single hyphens");

const BlogTagsSchema = z
  .array(z.string().min(1).max(BLOG_LIMITS.tagMaxLength))
  .max(BLOG_LIMITS.maxTags, `A post can have at most ${BLOG_LIMITS.maxTags} tags`);

// --- Server resources (passthrough keeps forward-compatible fields) ---

export const BlogPostSchema = z
  .object({
    id: z.string(),
    locale: BlogLocaleSchema,
    slug: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    blocks: z.array(BlogBlockSchema),
    coverUrl: z.string().nullable(),
    tags: z.array(z.string()),
    seo: BlogSeoSchema.passthrough(),
    authorName: z.string().nullable(),
    status: BlogStatusSchema,
    translationKey: z.string().nullable(),
    publishedAt: z.string().nullable(),
    version: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string()
  })
  .passthrough();
export type BlogPost = z.infer<typeof BlogPostSchema>;

export const BlogPostSummarySchema = BlogPostSchema.omit({ blocks: true });
export type BlogPostSummary = z.infer<typeof BlogPostSummarySchema>;

export const BlogRevisionSchema = z
  .object({
    id: z.string(),
    postId: z.string(),
    version: z.number().int(),
    note: z.string().nullable(),
    actorId: z.string().nullable(),
    createdAt: z.string(),
    snapshot: BlogPostSchema.optional()
  })
  .passthrough();
export type BlogRevision = z.infer<typeof BlogRevisionSchema>;

export const BlogBlockDefinitionSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    description: z.string(),
    category: z.enum(["section", "primitive"]),
    propsSchema: z.record(z.unknown()),
    example: BlogBlockSchema
  })
  .passthrough();
export type BlogBlockDefinition = z.infer<typeof BlogBlockDefinitionSchema>;

export const BlogValidationIssueSchema = z.object({
  path: z.union([z.string(), z.array(z.union([z.string(), z.number()]))]),
  message: z.string()
}).passthrough();
export type BlogValidationIssue = z.infer<typeof BlogValidationIssueSchema>;

// --- Request payloads (strict: unknown keys are rejected so typos surface locally) ---

const blogPostWritableFields = {
  locale: BlogLocaleSchema,
  slug: BlogSlugSchema,
  title: z.string().min(1, "Title is required").max(BLOG_LIMITS.titleMaxLength),
  description: z.string().max(BLOG_LIMITS.descriptionMaxLength).nullable().optional(),
  blocks: BlogBlocksSchema,
  coverUrl: z.string().nullable().optional(),
  tags: BlogTagsSchema.optional(),
  seo: BlogSeoSchema.strict().optional(),
  translationKey: z.string().min(1).nullable().optional(),
  authorName: z.string().nullable().optional()
};

export const BlogPostCreateInputSchema = z.object(blogPostWritableFields).strict();
export type BlogPostCreateInput = z.infer<typeof BlogPostCreateInputSchema>;

export const BlogVersionSchema = z.number().int().positive("version must be a positive integer");

export const BlogPostUpdateInputSchema = z
  .object(blogPostWritableFields)
  .partial()
  .extend({ version: BlogVersionSchema })
  .strict()
  .refine((input) => Object.keys(input).some((key) => key !== "version"), {
    message: "Update payload must change at least one field besides version"
  });
export type BlogPostUpdateInput = z.infer<typeof BlogPostUpdateInputSchema>;

/** Body for publish / unpublish / restore, and the `?version=` of archive. */
export const BlogVersionInputSchema = z.object({ version: BlogVersionSchema }).strict();
export type BlogVersionInput = z.infer<typeof BlogVersionInputSchema>;

export const BlogValidateInputSchema = z.object({ blocks: BlogBlocksSchema }).strict();
export type BlogValidateInput = z.infer<typeof BlogValidateInputSchema>;

export const BlogPostListQuerySchema = z.object({
  locale: BlogLocaleSchema.optional(),
  status: BlogStatusFilterSchema.optional(),
  tag: z.string().min(1).max(BLOG_LIMITS.tagMaxLength).optional(),
  limit: z.number().int().min(1).optional(),
  offset: z.number().int().min(0).optional()
});
export type BlogPostListQuery = z.infer<typeof BlogPostListQuerySchema>;

// --- Response envelopes ---

export const BlogPostResponseSchema = z.object({ data: BlogPostSchema });
export type BlogPostResponse = z.infer<typeof BlogPostResponseSchema>;

export const BlogPostListResponseSchema = z.object({
  data: z.array(BlogPostSummarySchema),
  pagination: z.object({ limit: z.number(), offset: z.number(), count: z.number() }).passthrough()
});
export type BlogPostListResponse = z.infer<typeof BlogPostListResponseSchema>;

export const BlogBlockCatalogueResponseSchema = z.object({ data: z.array(BlogBlockDefinitionSchema) });
export type BlogBlockCatalogueResponse = z.infer<typeof BlogBlockCatalogueResponseSchema>;

export const BlogValidateResponseSchema = z.object({
  data: z.object({ valid: z.boolean(), errors: z.array(BlogValidationIssueSchema) })
});
export type BlogValidateResponse = z.infer<typeof BlogValidateResponseSchema>;

export const BlogRevisionListResponseSchema = z.object({ data: z.array(BlogRevisionSchema) });
export type BlogRevisionListResponse = z.infer<typeof BlogRevisionListResponseSchema>;

export const BlogRevisionResponseSchema = z.object({ data: BlogRevisionSchema });
export type BlogRevisionResponse = z.infer<typeof BlogRevisionResponseSchema>;

export const BlogApiErrorBodySchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
  currentVersion: z.number().int().optional()
}).passthrough();
export type BlogApiErrorBody = z.infer<typeof BlogApiErrorBodySchema>;

/** Normalized blog API failure shared by the CLI and MCP surfaces. */
export interface BlogApiFailure {
  status: number;
  error: string;
  details?: unknown;
  currentVersion?: number;
  /** Human-readable one-line summary including conflict and validation hints. */
  message: string;
}

function formatIssuePath(path: unknown): string {
  if (Array.isArray(path)) return path.join(".");
  return typeof path === "string" ? path : "";
}

/**
 * Converts a non-2xx blog response (status + raw body text) into a structured failure.
 * 409 conflicts carry `currentVersion`; 400 validation errors carry `details` issues.
 */
export function describeBlogApiFailure(status: number, bodyText: string, statusText = ""): BlogApiFailure {
  let raw: unknown;
  try {
    raw = bodyText ? JSON.parse(bodyText) : undefined;
  } catch {
    raw = undefined;
  }
  const parsed = BlogApiErrorBodySchema.safeParse(raw);
  const error = parsed.success ? parsed.data.error : (bodyText.trim() || statusText || "Request failed");
  const details = parsed.success ? parsed.data.details : undefined;
  const currentVersion = parsed.success ? parsed.data.currentVersion : undefined;

  let message = `HTTP ${status}: ${error}`;
  if (status === 409 && typeof currentVersion === "number") {
    message += ` (version conflict: current version is ${currentVersion}; re-fetch the post and retry with --version ${currentVersion})`;
  } else if (status === 409) {
    message += " (conflict)";
  }
  if (Array.isArray(details) && details.length > 0) {
    const issues = details
      .map((issue) => {
        const item = BlogValidationIssueSchema.safeParse(issue);
        if (!item.success) return JSON.stringify(issue);
        const path = formatIssuePath(item.data.path);
        return path ? `${path}: ${item.data.message}` : item.data.message;
      })
      .join("; ");
    message += ` — ${issues}`;
  }

  return { status, error, details, currentVersion, message };
}
