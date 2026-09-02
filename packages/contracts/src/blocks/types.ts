import { z } from "zod";

/**
 * Validates that a string is a safe web URL (HTTP/HTTPS only).
 * Rejects dangerous/executable protocols: javascript:, data:, file:, ftp:, etc.
 */
export const SafeHttpUrlSchema = z.string().superRefine((val, ctx) => {
  try {
    const parsed = new URL(val);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === "https:") return;
    if (protocol === "http:") {
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".local")) {
        return; // Allow local development endpoints
      }
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "URL must use HTTPS protocol (HTTP is allowed only for localhost development)"
    });
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid URL format"
    });
  }
});

export const SafeEmailUrlSchema = z.string().superRefine((val, ctx) => {
  try {
    const parsed = new URL(val);
    if (parsed.protocol.toLowerCase() === "mailto:") return;
    if (parsed.protocol.toLowerCase() === "https:") return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Link must use HTTPS or mailto: protocol"
    });
  } catch {
    // If not a URL, check if valid email format
    const emailCheck = z.string().email().safeParse(val);
    if (!emailCheck.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be a valid email or mailto:/https: URL"
      });
    }
  }
});

// 1. Hero Block
export const HeroBlockSchema = z.object({
  type: z.literal("hero"),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional(),
  tagline: z.string().max(300).optional(),
  badge: z.string().max(100).optional(),
  primaryCta: z
    .object({
      label: z.string().min(1).max(100),
      url: SafeHttpUrlSchema,
      icon: z.string().max(50).optional()
    })
    .optional(),
  secondaryCta: z
    .object({
      label: z.string().min(1).max(100),
      url: SafeHttpUrlSchema,
      icon: z.string().max(50).optional()
    })
    .optional(),
  backgroundImage: SafeHttpUrlSchema.optional(),
  alignment: z.enum(["left", "center", "right"]).default("center"),
  theme: z.enum(["light", "dark", "gradient", "minimal"]).default("gradient")
});
export type HeroBlock = z.infer<typeof HeroBlockSchema>;

// 2. Carousel Block
export const CarouselItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  imageUrl: SafeHttpUrlSchema,
  link: SafeHttpUrlSchema.optional(),
  caption: z.string().max(300).optional()
});
export const CarouselBlockSchema = z.object({
  type: z.literal("carousel"),
  items: z.array(CarouselItemSchema).min(1).max(20),
  autoplay: z.boolean().default(true),
  intervalMs: z.number().int().min(1000).max(60000).default(5000),
  layout: z.enum(["cards", "fullwidth", "slideshow"]).default("cards")
});
export type CarouselBlock = z.infer<typeof CarouselBlockSchema>;

// 3. Media Gallery Block
export const MediaGalleryItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["image", "video", "embed"]).default("image"),
  url: SafeHttpUrlSchema,
  thumbnail: SafeHttpUrlSchema.optional(),
  alt: z.string().max(200).optional(),
  caption: z.string().max(300).optional()
});
export const MediaGalleryBlockSchema = z.object({
  type: z.literal("mediaGallery"),
  title: z.string().max(200).optional(),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(3),
  aspectRatio: z.enum(["16:9", "4:3", "1:1", "auto"]).default("16:9"),
  items: z.array(MediaGalleryItemSchema).min(1).max(50)
});
export type MediaGalleryBlock = z.infer<typeof MediaGalleryBlockSchema>;

// 4. Quote Block
export const QuoteBlockSchema = z.object({
  type: z.literal("quote"),
  text: z.string().min(1).max(2000),
  author: z.string().min(1).max(100),
  role: z.string().max(100).optional(),
  company: z.string().max(100).optional(),
  avatarUrl: SafeHttpUrlSchema.optional(),
  rating: z.number().min(1).max(5).optional(),
  verified: z.boolean().default(false)
});
export type QuoteBlock = z.infer<typeof QuoteBlockSchema>;

// 5. Grid Block
export const GridItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(150),
  description: z.string().max(1000),
  icon: z.string().max(50).optional(),
  badge: z.string().max(50).optional(),
  link: SafeHttpUrlSchema.optional()
});
export const GridBlockSchema = z.object({
  type: z.literal("grid"),
  title: z.string().max(200).optional(),
  subtitle: z.string().max(500).optional(),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6)]).default(3),
  items: z.array(GridItemSchema).min(1).max(50)
});
export type GridBlock = z.infer<typeof GridBlockSchema>;

// 6. Changelog Block
export const ChangelogEntrySchema = z.object({
  version: z.string().min(1).max(50),
  date: z.string().max(50),
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  changes: z.array(
    z.object({
      type: z.enum(["feature", "fix", "improvement", "breaking"]),
      text: z.string().min(1).max(500)
    })
  ).min(1)
});
export const ChangelogBlockSchema = z.object({
  type: z.literal("changelog"),
  title: z.string().max(200).optional(),
  releases: z.array(ChangelogEntrySchema).min(1).max(50)
});
export type ChangelogBlock = z.infer<typeof ChangelogBlockSchema>;

// 7. Roadmap Block
export const RoadmapStageSchema = z.object({
  stage: z.enum(["planned", "in_progress", "completed"]),
  title: z.string().min(1).max(150),
  description: z.string().max(1000).optional(),
  targetDate: z.string().max(50).optional(),
  items: z.array(z.string().min(1).max(300)).min(1)
});
export const RoadmapBlockSchema = z.object({
  type: z.literal("roadmap"),
  title: z.string().max(200).optional(),
  stages: z.array(RoadmapStageSchema).min(1).max(20)
});
export type RoadmapBlock = z.infer<typeof RoadmapBlockSchema>;

// 8. Pricing Block
export const PricingTierSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  price: z.union([z.number(), z.string()]),
  billingPeriod: z.enum(["monthly", "yearly", "one-time", "free", "usage"]).default("monthly"),
  description: z.string().max(500).optional(),
  features: z.array(z.string().min(1).max(300)).min(1),
  isPopular: z.boolean().default(false),
  cta: z.object({
    label: z.string().min(1).max(100),
    url: SafeHttpUrlSchema
  }),
  badge: z.string().max(50).optional()
});
export const PricingBlockSchema = z.object({
  type: z.literal("pricing"),
  title: z.string().max(200).optional(),
  currency: z.string().max(10).default("USD"),
  tiers: z.array(PricingTierSchema).min(1).max(10),
  notes: z.string().max(500).optional()
});
export type PricingBlock = z.infer<typeof PricingBlockSchema>;

// 9. FAQ Block
export const FaqItemSchema = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(3000),
  category: z.string().max(100).optional()
});
export const FaqBlockSchema = z.object({
  type: z.literal("faq"),
  title: z.string().max(200).optional(),
  items: z.array(FaqItemSchema).min(1).max(50)
});
export type FaqBlock = z.infer<typeof FaqBlockSchema>;

// 10. Tech Stack Block
export const TechnologySchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(50).optional(),
  version: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  description: z.string().max(300).optional(),
  website: SafeHttpUrlSchema.optional()
});
export const TechStackCategorySchema = z.object({
  name: z.string().min(1).max(100),
  technologies: z.array(TechnologySchema).min(1)
});
export const TechStackBlockSchema = z.object({
  type: z.literal("techStack"),
  title: z.string().max(200).optional(),
  categories: z.array(TechStackCategorySchema).min(1).max(20)
});
export type TechStackBlock = z.infer<typeof TechStackBlockSchema>;

// 11. Live Demo Block
export const LiveDemoBlockSchema = z.object({
  type: z.literal("liveDemo"),
  title: z.string().max(200).optional(),
  url: SafeHttpUrlSchema,
  embedUrl: SafeHttpUrlSchema.optional(),
  sandboxType: z.enum(["iframe", "codesandbox", "stackblitz", "replit", "custom"]).default("iframe"),
  heightPx: z.number().int().min(200).max(2000).default(600),
  allowFullscreen: z.boolean().default(true),
  instructions: z.string().max(2000).optional()
});
export type LiveDemoBlock = z.infer<typeof LiveDemoBlockSchema>;

// 12. CTA Block
export const CtaBlockSchema = z.object({
  type: z.literal("cta"),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional(),
  buttonText: z.string().min(1).max(100),
  buttonUrl: SafeHttpUrlSchema,
  secondaryButtonText: z.string().max(100).optional(),
  secondaryButtonUrl: SafeHttpUrlSchema.optional(),
  bannerImage: SafeHttpUrlSchema.optional(),
  style: z.enum(["card", "banner", "minimal", "gradient"]).default("card")
});
export type CtaBlock = z.infer<typeof CtaBlockSchema>;

// 13. Founder Block
export const FounderProfileSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(100),
  bio: z.string().max(2000).optional(),
  avatarUrl: SafeHttpUrlSchema.optional(),
  socialLinks: z
    .object({
      twitter: SafeHttpUrlSchema.optional(),
      github: SafeHttpUrlSchema.optional(),
      linkedin: SafeHttpUrlSchema.optional(),
      website: SafeHttpUrlSchema.optional()
    })
    .optional(),
  email: z.string().email().optional()
});
export const FounderBlockSchema = z.object({
  type: z.literal("founder"),
  title: z.string().max(200).optional(),
  founders: z.array(FounderProfileSchema).min(1).max(20)
});
export type FounderBlock = z.infer<typeof FounderBlockSchema>;

// 14. Verification Block
export const VerificationBlockSchema = z.object({
  type: z.literal("verification"),
  proofType: z.enum(["domain", "dns", "github", "manual"]),
  verifiedAt: z.string().max(50).optional(),
  verifiedBy: z.string().max(100).optional(),
  status: z.enum(["verified", "pending", "failed"]).default("pending"),
  details: z.string().max(1000).optional(),
  proofUrl: SafeHttpUrlSchema.optional()
});
export type VerificationBlock = z.infer<typeof VerificationBlockSchema>;

// 15. Milestones Block
export const MilestoneItemSchema = z.object({
  date: z.string().min(1).max(50),
  title: z.string().min(1).max(150),
  description: z.string().max(1000).optional(),
  metrics: z.record(z.union([z.string(), z.number()])).optional(),
  icon: z.string().max(50).optional()
});
export const MilestonesBlockSchema = z.object({
  type: z.literal("milestones"),
  title: z.string().max(200).optional(),
  milestones: z.array(MilestoneItemSchema).min(1).max(50)
});
export type MilestonesBlock = z.infer<typeof MilestonesBlockSchema>;

// 16. Case Study Block
export const CaseStudyResultSchema = z.object({
  metric: z.string().min(1).max(100),
  value: z.string().min(1).max(50),
  change: z.string().max(50).optional()
});
export const CaseStudyBlockSchema = z.object({
  type: z.literal("caseStudy"),
  title: z.string().min(1).max(200),
  clientName: z.string().min(1).max(100),
  industry: z.string().max(100).optional(),
  problem: z.string().max(3000).optional(),
  solution: z.string().max(3000).optional(),
  results: z.array(CaseStudyResultSchema).min(1).max(10).optional(),
  testimonial: z
    .object({
      quote: z.string().max(1500),
      author: z.string().max(100),
      role: z.string().max(100).optional()
    })
    .optional(),
  logoUrl: SafeHttpUrlSchema.optional()
});
export type CaseStudyBlock = z.infer<typeof CaseStudyBlockSchema>;

// Discriminated Union of all 16 Blocks
export const BlockSchema = z.discriminatedUnion("type", [
  HeroBlockSchema,
  CarouselBlockSchema,
  MediaGalleryBlockSchema,
  QuoteBlockSchema,
  GridBlockSchema,
  ChangelogBlockSchema,
  RoadmapBlockSchema,
  PricingBlockSchema,
  FaqBlockSchema,
  TechStackBlockSchema,
  LiveDemoBlockSchema,
  CtaBlockSchema,
  FounderBlockSchema,
  VerificationBlockSchema,
  MilestonesBlockSchema,
  CaseStudyBlockSchema
]);
export type Block = z.infer<typeof BlockSchema>;
export type BlockType = Block["type"];
