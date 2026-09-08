import { describe, it, expect } from "vitest";
import { BlockSchema, Block } from "../src/blocks.js";

describe("Contracts: 16 Block Types", () => {
  it("should validate a Hero block", () => {
    const hero: Block = {
      id: "hero-1",
      type: "hero",
      props: {
        headline: "Supercharge Your Stack",
        subheadline: "Built for high-velocity engineering teams.",
        primaryCtaText: "Get Started",
        primaryCtaUrl: "https://example.com",
        badge: "Beta"
      }
    };
    expect(BlockSchema.parse(hero)).toEqual(hero);
  });

  it("should reject invalid URL schemes in Hero block", () => {
    const badHero = {
      id: "hero-bad",
      type: "hero",
      props: {
        headline: "Bad Hero",
        primaryCtaUrl: "javascript:alert(1)"
      }
    };
    expect(() => BlockSchema.parse(badHero)).toThrow();
  });

  it("should validate a Carousel block", () => {
    const carousel: Block = {
      id: "carousel-1",
      type: "carousel",
      props: {
        items: [
          { title: "Slide 1", description: "First slide", imageUrl: "https://example.com/1.png" },
          { title: "Slide 2", imageUrl: "https://example.com/2.png" }
        ]
      }
    };
    expect(BlockSchema.parse(carousel)).toEqual(carousel);
  });

  it("should validate a MediaGallery block", () => {
    const gallery: Block = {
      id: "media-1",
      type: "mediaGallery",
      props: {
        images: [
          { url: "https://example.com/shot.png", caption: "Screenshot", aspectRatio: "16:9" }
        ]
      }
    };
    expect(BlockSchema.parse(gallery)).toEqual(gallery);
  });

  it("should validate a Quote block", () => {
    const quote: Block = {
      id: "quote-1",
      type: "quote",
      props: {
        quote: "This tool saved us months of development.",
        author: "Alice Engineer",
        title: "Staff Architect",
        avatarUrl: "https://example.com/alice.png"
      }
    };
    expect(BlockSchema.parse(quote)).toEqual(quote);
  });

  it("should validate a Grid block", () => {
    const grid: Block = {
      id: "grid-1",
      type: "grid",
      props: {
        columns: 3,
        items: [
          { title: "Feature 1", description: "Desc 1", icon: "zap" }
        ]
      }
    };
    expect(BlockSchema.parse(grid)).toEqual(grid);
  });

  it("should validate a Changelog block", () => {
    const changelog: Block = {
      id: "changelog-1",
      type: "changelog",
      props: {
        entries: [
          {
            version: "1.0.0",
            date: "2026-09-01",
            changes: ["Initial release", "Full MCP server integration"]
          }
        ]
      }
    };
    expect(BlockSchema.parse(changelog)).toEqual(changelog);
  });

  it("should validate a Roadmap block", () => {
    const roadmap: Block = {
      id: "roadmap-1",
      type: "roadmap",
      props: {
        milestones: [
          {
            quarter: "Q3 2026",
            title: "Launch Autonomous Pipeline",
            status: "completed"
          }
        ]
      }
    };
    expect(BlockSchema.parse(roadmap)).toEqual(roadmap);
  });

  it("should validate a Pricing block", () => {
    const pricing: Block = {
      id: "pricing-1",
      type: "pricing",
      props: {
        tiers: [
          {
            name: "Pro",
            price: "$49",
            period: "month",
            features: ["Full CLI access", "MCP tools"],
            ctaText: "Buy Now",
            ctaUrl: "https://example.com/checkout",
            isPopular: true
          }
        ]
      }
    };
    expect(BlockSchema.parse(pricing)).toEqual(pricing);
  });

  it("should validate an FAQ block", () => {
    const faq: Block = {
      id: "faq-1",
      type: "faq",
      props: {
        items: [
          { question: "Is this free?", answer: "Yes, standard tier is free." }
        ]
      }
    };
    expect(BlockSchema.parse(faq)).toEqual(faq);
  });

  it("should validate a TechStack block", () => {
    const techStack: Block = {
      id: "tech-1",
      type: "techStack",
      props: {
        technologies: [
          { name: "TypeScript", category: "Language" },
          { name: "Node.js", category: "Runtime" }
        ]
      }
    };
    expect(BlockSchema.parse(techStack)).toEqual(techStack);
  });

  it("should validate a LiveDemo block", () => {
    const liveDemo: Block = {
      id: "demo-1",
      type: "liveDemo",
      props: {
        embedUrl: "https://example.com/embed",
        sandboxTokens: "allow-scripts allow-popups",
        height: 600
      }
    };
    expect(BlockSchema.parse(liveDemo)).toEqual(liveDemo);
  });

  it("should validate a CTA block", () => {
    const cta: Block = {
      id: "cta-1",
      type: "cta",
      props: {
        title: "Ready to ship?",
        subtitle: "Join the community today.",
        buttonText: "Sign Up",
        buttonUrl: "https://example.com/signup"
      }
    };
    expect(BlockSchema.parse(cta)).toEqual(cta);
  });

  it("should validate a Founder block", () => {
    const founder: Block = {
      id: "founder-1",
      type: "founder",
      props: {
        name: "Duy Nguyen",
        bio: "Founder building open tools for autonomous agents.",
        xHandle: "duynguyen"
      }
    };
    expect(BlockSchema.parse(founder)).toEqual(founder);
  });

  it("should validate a Verification block", () => {
    const verification: Block = {
      id: "verify-1",
      type: "verification",
      props: {
        metricType: "revenue",
        verifiedValue: "$50,000 MRR",
        verificationScope: "Stripe production metrics",
        verifiedAt: "2026-09-01",
        evidenceStandard: "Cryptographic audit"
      }
    };
    expect(BlockSchema.parse(verification)).toEqual(verification);
  });

  it("should validate a Milestones block", () => {
    const milestones: Block = {
      id: "miles-1",
      type: "milestones",
      props: {
        items: [
          { date: "2026-09-01", title: "10,000 Submissions", description: "Milestone reached." }
        ]
      }
    };
    expect(BlockSchema.parse(milestones)).toEqual(milestones);
  });

  it("should validate a CaseStudy block", () => {
    const caseStudy: Block = {
      id: "case-1",
      type: "caseStudy",
      props: {
        customerName: "Acme Corp",
        problem: "Manual review bottleneck",
        solution: "Adopted NLB toolkits",
        outcome: "10x throughput improvement",
        metrics: ["Reduced latency 80%"]
      }
    };
    expect(BlockSchema.parse(caseStudy)).toEqual(caseStudy);
  });

  it("should reject invalid block types", () => {
    const invalid = {
      id: "invalid-1",
      type: "unknownType",
      props: {}
    };
    expect(() => BlockSchema.parse(invalid)).toThrow();
  });
});
