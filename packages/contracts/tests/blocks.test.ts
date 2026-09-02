import { describe, it, expect } from "vitest";
import { BlockSchema, Block } from "../src/blocks/types.js";

describe("Contracts: 16 Block Types", () => {
  it("should validate a Hero block", () => {
    const hero: Block = {
      type: "hero",
      title: "Hero Title",
      subtitle: "Hero Subtitle",
      tagline: "Tagline",
      badge: "Beta",
      primaryCta: { label: "Click Me", url: "https://example.com" },
      alignment: "center",
      theme: "gradient"
    };
    expect(BlockSchema.parse(hero)).toEqual(hero);
  });

  it("should reject dangerous URL schemes like javascript:, data:, file:, ftp:", () => {
    const badHero = {
      type: "hero",
      title: "Bad Hero",
      primaryCta: { label: "Click Me", url: "javascript:alert(1)" }
    };
    expect(() => BlockSchema.parse(badHero)).toThrow(/HTTPS protocol/);

    const badDataHero = {
      type: "hero",
      title: "Bad Hero",
      primaryCta: { label: "Click Me", url: "data:text/html,<html>bad</html>" }
    };
    expect(() => BlockSchema.parse(badDataHero)).toThrow(/HTTPS protocol/);

    const badFileHero = {
      type: "hero",
      title: "Bad Hero",
      primaryCta: { label: "Click Me", url: "file:///etc/passwd" }
    };
    expect(() => BlockSchema.parse(badFileHero)).toThrow(/HTTPS protocol/);
  });

  it("should validate a Carousel block", () => {
    const carousel: Block = {
      type: "carousel",
      items: [
        { id: "1", title: "Slide 1", imageUrl: "https://example.com/1.png" },
        { id: "2", title: "Slide 2", imageUrl: "https://example.com/2.png" }
      ],
      autoplay: true,
      intervalMs: 5000,
      layout: "cards"
    };
    expect(BlockSchema.parse(carousel)).toEqual(carousel);
  });

  it("should validate a MediaGallery block", () => {
    const gallery: Block = {
      type: "mediaGallery",
      title: "Gallery",
      columns: 3,
      aspectRatio: "16:9",
      items: [{ id: "m1", type: "image", url: "https://example.com/shot.png", alt: "Screenshot" }]
    };
    expect(BlockSchema.parse(gallery)).toEqual(gallery);
  });

  it("should validate a Quote block", () => {
    const quote: Block = {
      type: "quote",
      text: "Outstanding product!",
      author: "Jane Doe",
      role: "CTO",
      company: "Acme",
      rating: 5,
      verified: true
    };
    expect(BlockSchema.parse(quote)).toEqual(quote);
  });

  it("should validate a Grid block", () => {
    const grid: Block = {
      type: "grid",
      title: "Features",
      columns: 3,
      items: [{ id: "f1", title: "Feature 1", description: "Desc 1" }]
    };
    expect(BlockSchema.parse(grid)).toEqual(grid);
  });

  it("should validate a Changelog block", () => {
    const changelog: Block = {
      type: "changelog",
      releases: [
        {
          version: "1.0.0",
          date: "2026-09-01",
          title: "Initial",
          changes: [{ type: "feature", text: "First release" }]
        }
      ]
    };
    expect(BlockSchema.parse(changelog)).toEqual(changelog);
  });

  it("should validate a Roadmap block", () => {
    const roadmap: Block = {
      type: "roadmap",
      stages: [
        {
          stage: "planned",
          title: "Next Gen",
          items: ["Item 1"]
        }
      ]
    };
    expect(BlockSchema.parse(roadmap)).toEqual(roadmap);
  });

  it("should validate a Pricing block", () => {
    const pricing: Block = {
      type: "pricing",
      currency: "USD",
      tiers: [
        {
          id: "free",
          name: "Free",
          price: 0,
          billingPeriod: "free",
          features: ["Feature A"],
          isPopular: false,
          cta: { label: "Start", url: "https://example.com" }
        }
      ]
    };
    expect(BlockSchema.parse(pricing)).toEqual(pricing);
  });

  it("should validate an FAQ block", () => {
    const faq: Block = {
      type: "faq",
      items: [{ question: "Is this free?", answer: "Yes." }]
    };
    expect(BlockSchema.parse(faq)).toEqual(faq);
  });

  it("should validate a TechStack block", () => {
    const techStack: Block = {
      type: "techStack",
      categories: [
        {
          name: "Frontend",
          technologies: [{ name: "React", version: "19" }]
        }
      ]
    };
    expect(BlockSchema.parse(techStack)).toEqual(techStack);
  });

  it("should validate a LiveDemo block", () => {
    const liveDemo: Block = {
      type: "liveDemo",
      url: "https://example.com/demo",
      sandboxType: "iframe",
      heightPx: 600,
      allowFullscreen: true
    };
    expect(BlockSchema.parse(liveDemo)).toEqual(liveDemo);
  });

  it("should validate a CTA block", () => {
    const cta: Block = {
      type: "cta",
      title: "Join Today",
      buttonText: "Sign Up",
      buttonUrl: "https://example.com/signup",
      style: "card"
    };
    expect(BlockSchema.parse(cta)).toEqual(cta);
  });

  it("should validate a Founder block", () => {
    const founder: Block = {
      type: "founder",
      founders: [
        {
          name: "Alice",
          role: "Founder",
          bio: "Engineer",
          socialLinks: { twitter: "https://twitter.com/alice" }
        }
      ]
    };
    expect(BlockSchema.parse(founder)).toEqual(founder);
  });
  it("should validate a Verification block with default pending status", () => {
    const verification = {
      type: "verification" as const,
      proofType: "domain" as const,
      verifiedAt: "2026-09-01"
    };
    const parsed = BlockSchema.parse(verification);
    expect(parsed.type).toBe("verification");
    if (parsed.type === "verification") {
      expect(parsed.status).toBe("pending");
    }
  });

  it("should validate a Milestones block", () => {
    const milestones: Block = {
      type: "milestones",
      milestones: [
        {
          date: "2026-01-01",
          title: "Launch",
          description: "Project launched"
        }
      ]
    };
    expect(BlockSchema.parse(milestones)).toEqual(milestones);
  });

  it("should validate a CaseStudy block", () => {
    const caseStudy: Block = {
      type: "caseStudy",
      title: "How Acme Scaled",
      clientName: "Acme Corp",
      problem: "Slow builds",
      solution: "Adopted NLB CLI"
    };
    expect(BlockSchema.parse(caseStudy)).toEqual(caseStudy);
  });

  it("should reject invalid block types", () => {
    expect(() => {
      BlockSchema.parse({ type: "unknownBlock", data: 123 });
    }).toThrow();
  });
});
