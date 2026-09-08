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
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
        return; // Allow local loopback development endpoints
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

// Base Block Envelope
export const BaseBlockSchema = z.object({
  id: z.string().min(1),
});

// 1. Hero Block
export const HeroBlockSchema = BaseBlockSchema.extend({
  type: z.literal("hero"),
  props: z.object({
    headline: z.string().min(1).max(120),
    subheadline: z.string().max(300).optional(),
    primaryCtaText: z.string().max(50).optional(),
    primaryCtaUrl: z.string().url().refine((u) => u.startsWith("https://") || u.startsWith("http://"), "URL must use HTTP or HTTPS").optional(),
    badge: z.string().max(50).optional(),
  }),
});

// 2. Carousel / Showcase Block
export const CarouselBlockSchema = BaseBlockSchema.extend({
  type: z.literal("carousel"),
  props: z.object({
    items: z
      .array(
        z.object({
          title: z.string(),
          description: z.string().optional(),
          imageUrl: z.string().url(),
        })
      )
      .min(1)
      .max(10),
  }),
});

// 3. Media Gallery Block
export const MediaGalleryBlockSchema = BaseBlockSchema.extend({
  type: z.literal("mediaGallery"),
  props: z.object({
    images: z
      .array(
        z.object({
          url: z.string().url(),
          caption: z.string().optional(),
          aspectRatio: z.enum(["16:9", "4:3", "1:1"]).default("16:9"),
        })
      )
      .min(1)
      .max(8),
  }),
});

// 4. Quote / Testimonial Block
export const QuoteBlockSchema = BaseBlockSchema.extend({
  type: z.literal("quote"),
  props: z.object({
    quote: z.string().min(1).max(500),
    author: z.string().min(1).max(100),
    title: z.string().max(100).optional(),
    avatarUrl: z.string().url().optional(),
  }),
});

// 5. Grid Block (1, 2, or 3 columns)
export const GridBlockSchema = BaseBlockSchema.extend({
  type: z.literal("grid"),
  props: z.object({
    columns: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(3),
    items: z
      .array(
        z.object({
          title: z.string(),
          description: z.string(),
          icon: z.string().optional(),
        })
      )
      .min(1)
      .max(12),
  }),
});

// 6. Changelog Block
export const ChangelogBlockSchema = BaseBlockSchema.extend({
  type: z.literal("changelog"),
  props: z.object({
    entries: z
      .array(
        z.object({
          version: z.string(),
          date: z.string(),
          changes: z.array(z.string()),
        })
      )
      .min(1)
      .max(10),
  }),
});

// 7. Roadmap Block
export const RoadmapBlockSchema = BaseBlockSchema.extend({
  type: z.literal("roadmap"),
  props: z.object({
    milestones: z
      .array(
        z.object({
          quarter: z.string(),
          title: z.string(),
          status: z.enum(["planned", "in_progress", "completed"]),
        })
      )
      .min(1)
      .max(8),
  }),
});

// 8. Pricing Block
export const PricingBlockSchema = BaseBlockSchema.extend({
  type: z.literal("pricing"),
  props: z.object({
    tiers: z
      .array(
        z.object({
          name: z.string(),
          price: z.string(),
          period: z.string().optional(),
          features: z.array(z.string()),
          ctaText: z.string(),
          ctaUrl: z.string().url().optional(),
          isPopular: z.boolean().default(false),
        })
      )
      .min(1)
      .max(4),
  }),
});

// 9. FAQ Block
export const FaqBlockSchema = BaseBlockSchema.extend({
  type: z.literal("faq"),
  props: z.object({
    items: z
      .array(
        z.object({
          question: z.string().min(1),
          answer: z.string().min(1),
        })
      )
      .min(1)
      .max(20),
  }),
});

// 10. Tech Stack Block
export const TechStackBlockSchema = BaseBlockSchema.extend({
  type: z.literal("techStack"),
  props: z.object({
    technologies: z
      .array(
        z.object({
          name: z.string(),
          category: z.string(),
          icon: z.string().optional(),
        })
      )
      .min(1)
      .max(16),
  }),
});

// 11. Live Demo Embed Block
export const LiveDemoBlockSchema = BaseBlockSchema.extend({
  type: z.literal("liveDemo"),
  props: z.object({
    embedUrl: z.string().url(),
    sandboxTokens: z.string().default("allow-scripts allow-popups allow-forms"),
    height: z.number().min(300).max(800).default(500),
  }),
});

// 12. Call to Action Block
export const CtaBlockSchema = BaseBlockSchema.extend({
  type: z.literal("cta"),
  props: z.object({
    title: z.string().min(1),
    subtitle: z.string().optional(),
    buttonText: z.string().min(1),
    buttonUrl: z.string().url(),
  }),
});

// 13. Founder Story Block
export const FounderBlockSchema = BaseBlockSchema.extend({
  type: z.literal("founder"),
  props: z.object({
    name: z.string().min(1),
    bio: z.string().min(1),
    avatarUrl: z.string().url().optional(),
    xHandle: z.string().optional(),
    linkedinUrl: z.string().url().optional(),
  }),
});

// 14. Verification Claims Block
export const VerificationBlockSchema = BaseBlockSchema.extend({
  type: z.literal("verification"),
  props: z.object({
    metricType: z.enum(["revenue", "preorders", "users", "uptime"]),
    verifiedValue: z.string(),
    verificationScope: z.string(),
    verifiedAt: z.string(),
    evidenceStandard: z.string(),
  }),
});

// 15. Milestones Block
export const MilestonesBlockSchema = BaseBlockSchema.extend({
  type: z.literal("milestones"),
  props: z.object({
    items: z
      .array(
        z.object({
          date: z.string(),
          title: z.string(),
          description: z.string().optional(),
        })
      )
      .min(1)
      .max(10),
  }),
});

// 16. Case Study Block
export const CaseStudyBlockSchema = BaseBlockSchema.extend({
  type: z.literal("caseStudy"),
  props: z.object({
    customerName: z.string().min(1),
    problem: z.string().min(1),
    solution: z.string().min(1),
    outcome: z.string().min(1),
    metrics: z.array(z.string()).optional(),
  }),
});

// Discriminated Union of All 16 Block Types
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
  CaseStudyBlockSchema,
]);

export type Block = z.infer<typeof BlockSchema>;
export type HeroBlock = z.infer<typeof HeroBlockSchema>;
export type CarouselBlock = z.infer<typeof CarouselBlockSchema>;
export type MediaGalleryBlock = z.infer<typeof MediaGalleryBlockSchema>;
export type QuoteBlock = z.infer<typeof QuoteBlockSchema>;
export type GridBlock = z.infer<typeof GridBlockSchema>;
export type ChangelogBlock = z.infer<typeof ChangelogBlockSchema>;
export type RoadmapBlock = z.infer<typeof RoadmapBlockSchema>;
export type PricingBlock = z.infer<typeof PricingBlockSchema>;
export type FaqBlock = z.infer<typeof FaqBlockSchema>;
export type TechStackBlock = z.infer<typeof TechStackBlockSchema>;
export type LiveDemoBlock = z.infer<typeof LiveDemoBlockSchema>;
export type CtaBlock = z.infer<typeof CtaBlockSchema>;
export type FounderBlock = z.infer<typeof FounderBlockSchema>;
export type VerificationBlock = z.infer<typeof VerificationBlockSchema>;
export type MilestonesBlock = z.infer<typeof MilestonesBlockSchema>;
export type CaseStudyBlock = z.infer<typeof CaseStudyBlockSchema>;
