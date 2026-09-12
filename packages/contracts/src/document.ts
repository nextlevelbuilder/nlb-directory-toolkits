import { z } from "zod";
import { AnalyticsBlockSchema, BlockSchema, type Block } from "./blocks.js";
import { SafeHttpUrlSchema } from "./blocks.js";
import { canonicalizeJson, computeContentHashSync, computeContentHash } from "./hasher.js";

export const Sha256HexHashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Hash must be a 64-character lowercase hexadecimal SHA-256 string");

// 1. Canonical Server Product Document Schema (strictly matching nlb-web server contract)
export const ProductDocumentSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  title: z.string().min(1).max(100),
  tagline: z.string().min(1).max(200),
  description: z.string().min(10).max(2000),
  websiteUrl: z.string().url(),
  logoUrl: z.string().url().optional(),
  categorySlugs: z.array(z.string()).min(1).max(5),
  tagSlugs: z.array(z.string()).max(10).default([]),
  blocks: z.array(BlockSchema).default([]),
});

export type ProductDocument = z.infer<typeof ProductDocumentSchema>;

// 2. Author Product Metadata & Document Schema (allows developer convenience like name, category, tags)
export const AuthorProductDocumentSchema = z.object({
  schemaVersion: z.literal(1).default(1).optional(),
  title: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with optional single hyphens")
    .optional(),
  tagline: z.string().min(1).max(200),
  description: z.string().min(10).max(5000),
  websiteUrl: SafeHttpUrlSchema,
  logoUrl: SafeHttpUrlSchema.optional(),
  repoUrl: SafeHttpUrlSchema.optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  categorySlugs: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  tagSlugs: z.array(z.string()).optional(),
  blocks: z.array(z.unknown()).default([]),
  metadata: z.record(z.unknown()).optional()
}).superRefine((val, ctx) => {
  if (!val.title && !val.name) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Document must specify either 'title' or 'name'",
      path: ["title"]
    });
  }
  if (!val.category && (!val.categorySlugs || val.categorySlugs.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Document must specify either 'category' or 'categorySlugs'",
    });
  }
});
/**
 * Normalizes an author-facing block or server block into a canonical server block with id and props.
 */
function normalizeBlock(rawBlock: Record<string, unknown>, index: number): Block {
  const id = typeof rawBlock.id === "string" ? rawBlock.id : `block-${index + 1}`;
  const type = String(rawBlock.type || "");

  // If already server-shaped with props
  if (rawBlock.props && typeof rawBlock.props === "object") {
    return {
      id,
      type,
      props: rawBlock.props as Record<string, unknown>
    } as unknown as Block;
  }

  // Otherwise map legacy flat blocks to props
  switch (type) {
    case "analytics":
      return AnalyticsBlockSchema.parse({ id, type, props: { title: rawBlock.title, period: rawBlock.period } });
    case "hero":
      return {
        id,
        type: "hero",
        props: {
          headline: String(rawBlock.headline || rawBlock.title || "Welcome"),
          subheadline: rawBlock.subheadline ? String(rawBlock.subheadline) : rawBlock.subtitle ? String(rawBlock.subtitle) : rawBlock.tagline ? String(rawBlock.tagline) : undefined,
          primaryCtaText: (rawBlock.primaryCta as Record<string, unknown>)?.label ? String((rawBlock.primaryCta as Record<string, unknown>).label) : rawBlock.primaryCtaText ? String(rawBlock.primaryCtaText) : undefined,
          primaryCtaUrl: (rawBlock.primaryCta as Record<string, unknown>)?.url ? String((rawBlock.primaryCta as Record<string, unknown>).url) : rawBlock.primaryCtaUrl ? String(rawBlock.primaryCtaUrl) : undefined,
          badge: rawBlock.badge ? String(rawBlock.badge) : undefined
        }
      };
    case "mediaGallery":
      return {
        id,
        type: "mediaGallery",
        props: {
          images: Array.isArray(rawBlock.images)
            ? (rawBlock.images as Array<Record<string, unknown>>).map((img) => ({
                url: String(img.url || ""),
                caption: img.caption ? String(img.caption) : undefined,
                aspectRatio: (img.aspectRatio as "16:9" | "4:3" | "1:1") || "16:9"
              }))
            : Array.isArray(rawBlock.items)
            ? (rawBlock.items as Array<Record<string, unknown>>).map((it) => ({
                url: String(it.url || it.imageUrl || ""),
                caption: it.caption ? String(it.caption) : it.alt ? String(it.alt) : undefined,
                aspectRatio: "16:9" as const
              }))
            : []
        }
      };
    case "grid":
      return {
        id,
        type: "grid",
        props: {
          columns: Math.min(3, Math.max(1, typeof rawBlock.columns === "number" ? rawBlock.columns : 3)) as 1 | 2 | 3,
          items: Array.isArray(rawBlock.items)
            ? (rawBlock.items as Array<Record<string, unknown>>).slice(0, 12).map((it) => ({
                title: String(it.title || ""),
                description: String(it.description || ""),
                icon: it.icon ? String(it.icon) : undefined
              }))
            : []
        }
      };
    case "pricing":
      return {
        id,
        type: "pricing",
        props: {
          tiers: Array.isArray(rawBlock.tiers)
            ? (rawBlock.tiers as Array<Record<string, unknown>>).slice(0, 4).map((t) => ({
                name: String(t.name || ""),
                price: typeof t.price === "number" ? `$${t.price}` : String(t.price || "Free"),
                period: t.period ? String(t.period) : t.billingPeriod ? String(t.billingPeriod) : undefined,
                features: Array.isArray(t.features) ? t.features.map(String) : [],
                ctaText: t.ctaText ? String(t.ctaText) : (t.cta as Record<string, unknown>)?.label ? String((t.cta as Record<string, unknown>).label) : "Select Plan",
                ctaUrl: t.ctaUrl ? String(t.ctaUrl) : (t.cta as Record<string, unknown>)?.url ? String((t.cta as Record<string, unknown>).url) : undefined,
                isPopular: Boolean(t.isPopular)
              }))
            : []
        }
      };
    case "faq":
      return {
        id,
        type: "faq",
        props: {
          items: Array.isArray(rawBlock.items)
            ? (rawBlock.items as Array<Record<string, unknown>>).slice(0, 20).map((it) => ({
                question: String(it.question || ""),
                answer: String(it.answer || "")
              }))
            : []
        }
      };
    case "techStack":
      return {
        id,
        type: "techStack",
        props: {
          technologies: Array.isArray(rawBlock.technologies)
            ? (rawBlock.technologies as Array<Record<string, unknown>>).slice(0, 16).map((tech) => ({
                name: String(tech.name || ""),
                category: String(tech.category || ""),
                icon: tech.icon ? String(tech.icon) : undefined
              }))
            : []
        }
      };
    case "cta":
      return {
        id,
        type: "cta",
        props: {
          title: String(rawBlock.title || "Get Started"),
          subtitle: rawBlock.subtitle ? String(rawBlock.subtitle) : undefined,
          buttonText: String(rawBlock.buttonText || (rawBlock.button as Record<string, unknown>)?.label || "Visit"),
          buttonUrl: String(rawBlock.buttonUrl || (rawBlock.button as Record<string, unknown>)?.url || "https://nextlevelbuilder.io")
        }
      };
    case "founder":
      return {
        id,
        type: "founder",
        props: {
          name: String(rawBlock.name || "Founder"),
          bio: String(rawBlock.bio || ""),
          avatarUrl: rawBlock.avatarUrl ? String(rawBlock.avatarUrl) : undefined,
          xHandle: rawBlock.xHandle ? String(rawBlock.xHandle) : undefined,
          linkedinUrl: rawBlock.linkedinUrl ? String(rawBlock.linkedinUrl) : undefined
        }
      };
    case "changelog":
      return {
        id,
        type: "changelog",
        props: {
          entries: Array.isArray(rawBlock.entries)
            ? (rawBlock.entries as Array<Record<string, unknown>>).slice(0, 10).map((e) => ({
                version: String(e.version || ""),
                date: String(e.date || ""),
                changes: Array.isArray(e.changes) ? e.changes.map(String) : []
              }))
            : Array.isArray(rawBlock.releases)
            ? (rawBlock.releases as Array<Record<string, unknown>>).slice(0, 10).map((r) => ({
                version: String(r.version || ""),
                date: String(r.date || ""),
                changes: Array.isArray(r.changes) ? r.changes.map(String) : []
              }))
            : []
        }
      };
    case "roadmap":
      return {
        id,
        type: "roadmap",
        props: {
          milestones: Array.isArray(rawBlock.milestones)
            ? (rawBlock.milestones as Array<Record<string, unknown>>).slice(0, 8).map((m) => ({
                quarter: String(m.quarter || ""),
                title: String(m.title || ""),
                status: (m.status as "planned" | "in_progress" | "completed") || "planned"
              }))
            : []
        }
      };
    case "milestones":
      return {
        id,
        type: "milestones",
        props: {
          items: Array.isArray(rawBlock.items)
            ? (rawBlock.items as Array<Record<string, unknown>>).slice(0, 10).map((m) => ({
                date: String(m.date || ""),
                title: String(m.title || ""),
                description: m.description ? String(m.description) : undefined
              }))
            : []
        }
      };
    case "caseStudy":
      return {
        id,
        type: "caseStudy",
        props: {
          customerName: String(rawBlock.customerName || "Customer"),
          problem: String(rawBlock.problem || ""),
          solution: String(rawBlock.solution || ""),
          outcome: String(rawBlock.outcome || ""),
          metrics: Array.isArray(rawBlock.metrics) ? rawBlock.metrics.map(String) : undefined
        }
      };
    case "quote":
      return {
        id,
        type: "quote",
        props: {
          quote: String(rawBlock.quote || rawBlock.text || ""),
          author: String(rawBlock.author || "Anonymous"),
          title: rawBlock.title ? String(rawBlock.title) : rawBlock.role ? String(rawBlock.role) : undefined,
          avatarUrl: rawBlock.avatarUrl ? String(rawBlock.avatarUrl) : undefined
        }
      };
    case "carousel":
      return {
        id,
        type: "carousel",
        props: {
          items: Array.isArray(rawBlock.items)
            ? (rawBlock.items as Array<Record<string, unknown>>).slice(0, 10).map((it) => ({
                title: String(it.title || ""),
                description: it.description ? String(it.description) : undefined,
                imageUrl: String(it.imageUrl || it.url || "")
              }))
            : []
        }
      };
    case "liveDemo":
      return {
        id,
        type: "liveDemo",
        props: {
          embedUrl: String(rawBlock.embedUrl || rawBlock.url || ""),
          sandboxTokens: String(rawBlock.sandboxTokens || "allow-scripts allow-popups allow-forms"),
          height: typeof rawBlock.height === "number" ? rawBlock.height : 500
        }
      };
    case "verification":
      return {
        id,
        type: "verification",
        props: {
          metricType: (rawBlock.metricType as "revenue" | "preorders" | "users" | "uptime") || "users",
          verifiedValue: String(rawBlock.verifiedValue || ""),
          verificationScope: String(rawBlock.verificationScope || ""),
          verifiedAt: String(rawBlock.verifiedAt || new Date().toISOString().split("T")[0]),
          evidenceStandard: String(rawBlock.evidenceStandard || "Direct audit")
        }
      };
    default:
      return {
        id,
        type,
        props: (rawBlock.props as Record<string, unknown>) || {}
      } as unknown as Block;
  }
}
export type AuthorProductDocument = z.infer<typeof AuthorProductDocumentSchema>;

/**
 * Converts an author document into the canonical server document wire format.
 */
export function toServerDocument(authorDoc: unknown): ProductDocument {
  const parsed = AuthorProductDocumentSchema.parse(authorDoc);
  const title = (parsed.title || parsed.name || "").trim();
  const tagline = parsed.tagline.trim();
  const description = parsed.description.trim();
  const websiteUrl = parsed.websiteUrl;
  const logoUrl = parsed.logoUrl;

  let categorySlugs: string[] = [];
  if (Array.isArray(parsed.categorySlugs) && parsed.categorySlugs.length > 0) {
    categorySlugs = parsed.categorySlugs.map((s) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-"));
  } else if (typeof parsed.category === "string" && parsed.category.trim()) {
    categorySlugs = [parsed.category.toLowerCase().replace(/[^a-z0-9-]+/g, "-")];
  } else if (Array.isArray(parsed.category) && parsed.category.length > 0) {
    categorySlugs = parsed.category.map((s) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-"));
  } else {
    categorySlugs = ["developer-tools"];
  }

  let tagSlugs: string[] = [];
  if (Array.isArray(parsed.tagSlugs)) {
    tagSlugs = parsed.tagSlugs.map((s) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-"));
  } else if (Array.isArray(parsed.tags)) {
    tagSlugs = parsed.tags.map((s) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-"));
  }

  const rawBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
  const normalizedBlocks: Block[] = rawBlocks.map((b, i) =>
    normalizeBlock(b && typeof b === "object" ? (b as Record<string, unknown>) : {}, i)
  );

  return ProductDocumentSchema.parse({
    schemaVersion: 1,
    title,
    tagline,
    description: description.length < 10 ? `${description} - Next Level Builders Product` : description,
    websiteUrl,
    logoUrl,
    categorySlugs: categorySlugs.slice(0, 5),
    tagSlugs: tagSlugs.slice(0, 10),
    blocks: normalizedBlocks
  });
}
export type ToServerDocumentResult =
  | { success: true; document: ProductDocument }
  | { success: false; errors: Array<{ path: string; message: string }> };

/**
 * Safely converts an author document into a canonical server document without throwing uncaught ZodErrors.
 */
export function toServerDocumentSafe(authorDoc: unknown): ToServerDocumentResult {
  const authorResult = AuthorProductDocumentSchema.safeParse(authorDoc);
  if (!authorResult.success) {
    return {
      success: false,
      errors: authorResult.error.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message
      }))
    };
  }

  try {
    const doc = toServerDocument(authorResult.data);
    return { success: true, document: doc };
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return {
        success: false,
        errors: err.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message
        }))
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      errors: [{ path: "document", message: msg }]
    };
  }
}

/**
 * Sanitizes an author-submitted document to ensure canonical server document compatibility.
 */
export function sanitizeAuthorDocument(authorDoc: AuthorProductDocument): ProductDocument {
  return toServerDocument(authorDoc);
}
// 3. Product Summary Schema (matches server projection)
export const ProductSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  name: z.string().optional(),
  tagline: z.string(),
  websiteUrl: z.string(),
  logoUrl: z.string().nullable().optional(),
  trustScore: z.number().default(0),
  featured: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  status: z.string().default("published"),
  currentRevisionId: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
}).passthrough();

export type ProductSummary = z.infer<typeof ProductSummarySchema>;

// 4. Product Revision Schema (matches server projection)
export const ProductRevisionSchema = z.object({
  id: z.string().optional(),
  revisionId: z.string().optional(),
  productId: z.string().optional(),
  revisionNumber: z.number().default(1),
  contentHash: Sha256HexHashSchema,
  status: z.string().default("draft"),
  document: z.unknown().optional(),
  createdAt: z.string().optional()
}).passthrough().refine((data) => Boolean(data.id || data.revisionId), {
  message: "Revision response must contain an id or revisionId"
});

export type ProductRevision = z.infer<typeof ProductRevisionSchema>;

export { computeContentHash, computeContentHashSync };
