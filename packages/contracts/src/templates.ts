import { ProductDocument, ProductDocumentSchema, ProductMetadataSchema } from "./document.js";
import { Block } from "./blocks/types.js";

function cloneBlocks(blocks: Block[]): Block[] {
  return JSON.parse(JSON.stringify(blocks)) as Block[];
}

export interface LayoutTemplate {
  name: string;
  slug: string;
  description: string;
  recommendedCategory: string;
  blockTypes: Block["type"][];
  sampleBlocks: Block[];
  buildDocument: (overrides: Partial<ProductDocument> & { name: string; slug: string; tagline: string; description: string; websiteUrl: string }) => ProductDocument;
}

// 1. SaaS Launch
export const SaasLaunchTemplate: LayoutTemplate = {
  name: "SaaS Launch",
  slug: "saas-launch",
  description: "Designed for commercial SaaS products with feature grids, pricing tiers, FAQs, and founder credibility.",
  recommendedCategory: "SaaS",
  blockTypes: ["hero", "mediaGallery", "grid", "pricing", "faq", "founder", "cta"],
  sampleBlocks: [
    {
      type: "hero",
      title: "Supercharge Your Workflow",
      subtitle: "The all-in-one platform built for modern high-velocity teams.",
      tagline: "Build faster, scale smarter.",
      badge: "Now in Public Beta",
      primaryCta: { label: "Get Started Free", url: "https://example.com/signup" },
      secondaryCta: { label: "Book a Demo", url: "https://example.com/demo" },
      alignment: "center",
      theme: "gradient"
    },
    {
      type: "mediaGallery",
      title: "Product Showcase",
      columns: 3,
      aspectRatio: "16:9",
      items: [
        { id: "img-1", type: "image", url: "https://example.com/screenshot1.png", alt: "Dashboard" },
        { id: "img-2", type: "image", url: "https://example.com/screenshot2.png", alt: "Analytics" },
        { id: "img-3", type: "image", url: "https://example.com/screenshot3.png", alt: "Automations" }
      ]
    },
    {
      type: "grid",
      title: "Core Capabilities",
      subtitle: "Everything you need to deliver faster.",
      columns: 3,
      items: [
        { id: "feat-1", title: "Realtime Sync", description: "Instant updates with low latency across all devices.", icon: "zap" },
        { id: "feat-2", title: "Security & Encryption", description: "Built-in encryption and modern security practices.", icon: "shield" },
        { id: "feat-3", title: "Workflow Automation", description: "Intelligent automations that streamline your team workflow.", icon: "bot" }
      ]
    },
    {
      type: "pricing",
      title: "Transparent Pricing",
      currency: "USD",
      tiers: [
        {
          id: "starter",
          name: "Starter",
          price: 0,
          billingPeriod: "monthly",
          description: "For individuals and side projects.",
          features: ["Up to 3 projects", "Community support", "1 GB storage"],
          isPopular: false,
          cta: { label: "Start Free", url: "https://example.com/signup" }
        },
        {
          id: "pro",
          name: "Pro",
          price: 29,
          billingPeriod: "monthly",
          description: "For fast-growing builders and teams.",
          features: ["Unlimited projects", "Priority support", "50 GB storage", "Custom domain", "API access"],
          isPopular: true,
          cta: { label: "Upgrade to Pro", url: "https://example.com/pro" },
          badge: "Popular"
        }
      ]
    },
    {
      type: "faq",
      title: "Frequently Asked Questions",
      items: [
        { question: "Can I cancel anytime?", answer: "Yes, you can cancel your subscription at any time without extra fees." },
        { question: "Is there a free trial?", answer: "We offer a full-featured 14-day free trial on our Pro plan." }
      ]
    },
    {
      type: "founder",
      title: "Meet the Creators",
      founders: [
        {
          name: "Alex Builder",
          role: "Founder & Lead Architect",
          bio: "Engineer scaling developer tools and cloud infrastructure.",
          socialLinks: { twitter: "https://twitter.com/alexbuilder", github: "https://github.com/alexbuilder" }
        }
      ]
    },
    {
      type: "cta",
      title: "Ready to accelerate your product?",
      subtitle: "Join builders shipping faster today.",
      buttonText: "Create Free Account",
      buttonUrl: "https://example.com/signup",
      style: "gradient"
    }
  ],
  buildDocument(overrides) {
    const raw = {
      name: overrides.name,
      slug: overrides.slug,
      tagline: overrides.tagline,
      description: overrides.description,
      category: overrides.category || "SaaS",
      tags: overrides.tags || ["saas", "productivity", "developer-tools"],
      websiteUrl: overrides.websiteUrl,
      repoUrl: overrides.repoUrl,
      logoUrl: overrides.logoUrl,
      blocks: overrides.blocks ? cloneBlocks(overrides.blocks) : cloneBlocks(this.sampleBlocks),
      metadata: ProductMetadataSchema.parse({
        version: "1.0.0",
        layoutTemplate: this.name,
        pricingModel: "freemium",
        ...overrides.metadata
      })
    };
    return ProductDocumentSchema.parse(raw);
  }
};

// 2. AI Agent / Tool
export const AiAgentTemplate: LayoutTemplate = {
  name: "AI Agent / Tool",
  slug: "ai-agent-tool",
  description: "Tailored for autonomous agents, LLM toolkits, MCP servers, and intelligent workflows with interactive demo.",
  recommendedCategory: "AI & Agents",
  blockTypes: ["hero", "liveDemo", "techStack", "carousel", "changelog", "verification", "cta"],
  sampleBlocks: [
    {
      type: "hero",
      title: "Autonomous Agent for Deep Research",
      subtitle: "Performs complex multi-step reasoning, fact validation, and code synthesis.",
      tagline: "Autonomous. Deterministic. Verified.",
      badge: "Model Context Protocol Ready",
      primaryCta: { label: "Run Agent", url: "https://example.com/demo" },
      secondaryCta: { label: "View on GitHub", url: "https://github.com/example/agent" },
      alignment: "center",
      theme: "dark"
    },
    {
      type: "liveDemo",
      title: "Interactive Sandbox",
      url: "https://example.com/embed",
      sandboxType: "iframe",
      heightPx: 500,
      allowFullscreen: true,
      instructions: "Type your query or task into the prompt box to see the agent work in real-time."
    },
    {
      type: "techStack",
      title: "Agent Architecture",
      categories: [
        {
          name: "LLM & Reasoning",
          technologies: [
            { name: "Claude 3.7 Sonnet", category: "LLM", description: "Core reasoning engine" },
            { name: "Model Context Protocol", category: "Protocol", website: "https://modelcontextprotocol.io" }
          ]
        },
        {
          name: "Runtime & Backend",
          technologies: [
            { name: "TypeScript", category: "Language", version: "5.7" },
            { name: "Node.js", category: "Runtime", version: "22" }
          ]
        }
      ]
    },
    {
      type: "carousel",
      items: [
        { id: "slide-1", title: "Automated Exploration", description: "Reads docs and summarizes facts accurately.", imageUrl: "https://example.com/step1.png" },
        { id: "slide-2", title: "Code Synthesis", description: "Generates code and validates syntax automatically.", imageUrl: "https://example.com/step2.png" }
      ],
      autoplay: true,
      intervalMs: 4000,
      layout: "cards"
    },
    {
      type: "changelog",
      title: "Recent Upgrades",
      releases: [
        {
          version: "v1.2.0",
          date: "2026-08-15",
          title: "MCP Stdio Transport Support",
          changes: [
            { type: "feature", text: "Added official Model Context Protocol stdio transport" },
            { type: "improvement", text: "Optimized context retrieval through semantic caching" }
          ]
        }
      ]
    },
    {
      type: "verification",
      proofType: "github",
      verifiedAt: "2026-09-01",
      status: "pending",
      details: "Repository provenance and test suites submitted for verification."
    },
    {
      type: "cta",
      title: "Integrate This Agent Into Your Workflow",
      subtitle: "Connect via MCP, CLI, or API in under 2 minutes.",
      buttonText: "Install via npx",
      buttonUrl: "https://example.com/install",
      style: "card"
    }
  ],
  buildDocument(overrides) {
    const raw = {
      name: overrides.name,
      slug: overrides.slug,
      tagline: overrides.tagline,
      description: overrides.description,
      category: overrides.category || "AI & Agents",
      tags: overrides.tags || ["ai", "agent", "mcp", "automation", "llm"],
      websiteUrl: overrides.websiteUrl,
      repoUrl: overrides.repoUrl,
      logoUrl: overrides.logoUrl,
      blocks: overrides.blocks ? cloneBlocks(overrides.blocks) : cloneBlocks(this.sampleBlocks),
      metadata: ProductMetadataSchema.parse({
        version: "1.0.0",
        layoutTemplate: this.name,
        pricingModel: "open_source",
        ...overrides.metadata
      })
    };
    return ProductDocumentSchema.parse(raw);
  }
};

// 3. Developer CLI
export const DeveloperCliTemplate: LayoutTemplate = {
  name: "Developer CLI",
  slug: "developer-cli",
  description: "Optimized for command-line utilities, developer toolchains, terminal apps, and open-source packages.",
  recommendedCategory: "Developer Tools",
  blockTypes: ["hero", "techStack", "grid", "roadmap", "changelog", "verification", "cta"],
  sampleBlocks: [
    {
      type: "hero",
      title: "The Developer Terminal Toolkit",
      subtitle: "Fast, zero-config CLI designed for developers and automation pipelines.",
      tagline: "Ship faster from your terminal.",
      badge: "Zero Runtime Dependencies",
      primaryCta: { label: "Install CLI", url: "https://example.com/install" },
      secondaryCta: { label: "GitHub Repo", url: "https://github.com/example/cli" },
      alignment: "center",
      theme: "minimal"
    },
    {
      type: "techStack",
      title: "Built With",
      categories: [
        {
          name: "Core Engine",
          technologies: [
            { name: "TypeScript", category: "Language", version: "5.7" },
            { name: "Commander.js", category: "CLI Framework", website: "https://github.com/tj/commander.js" },
            { name: "Zod", category: "Validation", website: "https://zod.dev" }
          ]
        }
      ]
    },
    {
      type: "grid",
      title: "Command-Line Highlights",
      columns: 3,
      items: [
        { id: "cmd-1", title: "Instant Validation", description: "Validate schemas and compute canonical hashes in milliseconds.", icon: "check" },
        { id: "cmd-2", title: "Terminal Box Previews", description: "Render beautiful ASCII and Unicode box previews directly in stdout.", icon: "terminal" },
        { id: "cmd-3", title: "Scriptable JSON Mode", description: "Pass --json on every command for effortless CI/CD piping.", icon: "code" }
      ]
    },
    {
      type: "roadmap",
      title: "Development Roadmap",
      stages: [
        {
          stage: "completed",
          title: "v1.0 Core Release",
          items: ["Core CLI commands", "Zod contract validation", "Deterministic SHA-256 hasher"]
        },
        {
          stage: "in_progress",
          title: "v1.1 MCP & Cloudflare Edge",
          items: ["MCP stdio transport", "Cloudflare Workers SSE integration"]
        },
        {
          stage: "planned",
          title: "v2.0 Plugin Ecosystem",
          items: ["Custom block extensions", "Decentralized registry support"]
        }
      ]
    },
    {
      type: "changelog",
      title: "Changelog",
      releases: [
        {
          version: "1.0.0",
          date: "2026-09-01",
          title: "Initial Public Release",
          changes: [
            { type: "feature", text: "Implemented validate, preview, submit, list, get, status commands" }
          ]
        }
      ]
    },
    {
      type: "verification",
      proofType: "domain",
      verifiedAt: "2026-09-01",
      status: "pending",
      details: "Domain ownership record submitted for verification."
    },
    {
      type: "cta",
      title: "Get Started via npx",
      subtitle: "No global installation required.",
      buttonText: "View Documentation",
      buttonUrl: "https://example.com/docs",
      style: "card"
    }
  ],
  buildDocument(overrides) {
    const raw = {
      name: overrides.name,
      slug: overrides.slug,
      tagline: overrides.tagline,
      description: overrides.description,
      category: overrides.category || "Developer Tools",
      tags: overrides.tags || ["cli", "terminal", "devtools", "typescript"],
      websiteUrl: overrides.websiteUrl,
      repoUrl: overrides.repoUrl,
      logoUrl: overrides.logoUrl,
      blocks: overrides.blocks ? cloneBlocks(overrides.blocks) : cloneBlocks(this.sampleBlocks),
      metadata: ProductMetadataSchema.parse({
        version: "1.0.0",
        layoutTemplate: this.name,
        pricingModel: "open_source",
        ...overrides.metadata
      })
    };
    return ProductDocumentSchema.parse(raw);
  }
};

// 4. Curated Community
export const CuratedCommunityTemplate: LayoutTemplate = {
  name: "Curated Community",
  slug: "curated-community",
  description: "Created for builder communities, creator hubs, learning platforms, and curated directories.",
  recommendedCategory: "Community",
  blockTypes: ["hero", "grid", "quote", "milestones", "faq", "founder", "cta"],
  sampleBlocks: [
    {
      type: "hero",
      title: "Where Builders Connect & Level Up",
      subtitle: "A collaborative network of software engineers, AI researchers, and founders.",
      tagline: "Build together. Ship together.",
      badge: "Active Builders Hub",
      primaryCta: { label: "Join the Community", url: "https://example.com/join" },
      alignment: "center",
      theme: "gradient"
    },
    {
      type: "grid",
      title: "Community Pillars",
      columns: 3,
      items: [
        { id: "col-1", title: "Collaborative Sprints", description: "Collaborative sprints shipping products in public.", icon: "code" },
        { id: "col-2", title: "Peer Code Reviews", description: "Get rigorous feedback from top industry peers.", icon: "eye" },
        { id: "col-3", title: "Showcase & Distribution", description: "Direct visibility for newly launched products.", icon: "globe" }
      ]
    },
    {
      type: "quote",
      text: "Collaborating with fellow builders accelerated our roadmap significantly.",
      author: "Sarah Chen",
      role: "Founder",
      company: "AgentFlow AI",
      verified: false
    },
    {
      type: "milestones",
      title: "Community Journey",
      milestones: [
        { date: "2025-01", title: "Community Founded", description: "Launched founding cohort." },
        { date: "2025-06", title: "Projects Shipped", description: "Builders launched first milestone of projects." },
        { date: "2026-01", title: "Directory Launch", description: "Official directory went live." }
      ]
    },
    {
      type: "faq",
      title: "Membership FAQ",
      items: [
        { question: "How do I apply?", answer: "Submit your GitHub profile and latest project via our application form." },
        { question: "Is membership free?", answer: "Yes, our core community is free for active builders." }
      ]
    },
    {
      type: "founder",
      title: "Community Stewards",
      founders: [
        {
          name: "Liam Foster",
          role: "Community Lead",
          bio: "Passionate about empowering creators and open source.",
          socialLinks: { twitter: "https://twitter.com/liamfoster" }
        }
      ]
    },
    {
      type: "cta",
      title: "Ready to join the next cohort?",
      subtitle: "Applications are reviewed on a rolling weekly basis.",
      buttonText: "Apply Now",
      buttonUrl: "https://example.com/apply",
      style: "gradient"
    }
  ],
  buildDocument(overrides) {
    const raw = {
      name: overrides.name,
      slug: overrides.slug,
      tagline: overrides.tagline,
      description: overrides.description,
      category: overrides.category || "Community",
      tags: overrides.tags || ["community", "builders", "startups", "networking"],
      websiteUrl: overrides.websiteUrl,
      repoUrl: overrides.repoUrl,
      logoUrl: overrides.logoUrl,
      blocks: overrides.blocks ? cloneBlocks(overrides.blocks) : cloneBlocks(this.sampleBlocks),
      metadata: ProductMetadataSchema.parse({
        version: "1.0.0",
        layoutTemplate: this.name,
        pricingModel: "free",
        ...overrides.metadata
      })
    };
    return ProductDocumentSchema.parse(raw);
  }
};

// 5. Minimalist Showcase
export const MinimalistShowcaseTemplate: LayoutTemplate = {
  name: "Minimalist Showcase",
  slug: "minimalist-showcase",
  description: "A clean, high-impact aesthetic for design studios, indie products, and focused tools.",
  recommendedCategory: "Design & Creative",
  blockTypes: ["hero", "mediaGallery", "caseStudy", "quote", "cta"],
  sampleBlocks: [
    {
      type: "hero",
      title: "Simplicity at Scale",
      subtitle: "Crafted with precision, zero noise, and relentless attention to detail.",
      tagline: "Pure focus.",
      primaryCta: { label: "Explore Work", url: "https://example.com/work" },
      alignment: "left",
      theme: "minimal"
    },
    {
      type: "mediaGallery",
      title: "Visual Artifacts",
      columns: 2,
      aspectRatio: "4:3",
      items: [
        { id: "art-1", type: "image", url: "https://example.com/art1.png", alt: "Editorial Layout" },
        { id: "art-2", type: "image", url: "https://example.com/art2.png", alt: "Typography System" }
      ]
    },
    {
      type: "caseStudy",
      title: "Redesigning the Modern Directory Experience",
      clientName: "NextLevelBuilder",
      industry: "Developer Ecosystems",
      problem: "Traditional product directories are cluttered and lack verifiable authenticity.",
      solution: "Engineered a cryptographic canonical hashing pipeline coupled with modular block architecture.",
      results: [
        { metric: "Submission Speed", value: "3x Faster", change: "+200%" },
        { metric: "Verification Rate", value: "99.8%", change: "+45%" }
      ]
    },
    {
      type: "quote",
      text: "A clean and aesthetic software experience.",
      author: "Elena Rostova",
      role: "Design Principal",
      company: "Vanguard Studio",
      verified: false
    },
    {
      type: "cta",
      title: "Let's build something remarkable.",
      subtitle: "Get in touch with our studio team.",
      buttonText: "Start a Conversation",
      buttonUrl: "https://example.com/contact",
      style: "minimal"
    }
  ],
  buildDocument(overrides) {
    const raw = {
      name: overrides.name,
      slug: overrides.slug,
      tagline: overrides.tagline,
      description: overrides.description,
      category: overrides.category || "Design & Creative",
      tags: overrides.tags || ["design", "minimalism", "showcase", "portfolio"],
      websiteUrl: overrides.websiteUrl,
      repoUrl: overrides.repoUrl,
      logoUrl: overrides.logoUrl,
      blocks: overrides.blocks ? cloneBlocks(overrides.blocks) : cloneBlocks(this.sampleBlocks),
      metadata: ProductMetadataSchema.parse({
        version: "1.0.0",
        layoutTemplate: this.name,
        pricingModel: "freemium",
        ...overrides.metadata
      })
    };
    return ProductDocumentSchema.parse(raw);
  }
};

export const TEMPLATES: Record<string, LayoutTemplate> = {
  "saas-launch": SaasLaunchTemplate,
  "ai-agent-tool": AiAgentTemplate,
  "developer-cli": DeveloperCliTemplate,
  "curated-community": CuratedCommunityTemplate,
  "minimalist-showcase": MinimalistShowcaseTemplate
};

export function listTemplates(): LayoutTemplate[] {
  return Object.values(TEMPLATES);
}

export function getTemplate(nameOrSlug: string): LayoutTemplate | undefined {
  const normalized = nameOrSlug.toLowerCase().trim();
  if (TEMPLATES[normalized]) return TEMPLATES[normalized];
  return Object.values(TEMPLATES).find(
    (t) => t.name.toLowerCase() === normalized || t.slug.toLowerCase() === normalized
  );
}

export function createDocumentFromTemplate(
  templateNameOrSlug: string,
  overrides: Partial<ProductDocument> & { name: string; slug: string; tagline: string; description: string; websiteUrl: string }
): ProductDocument {
  const template = getTemplate(templateNameOrSlug);
  if (!template) {
    throw new Error(`Template '${templateNameOrSlug}' not found. Available: ${Object.keys(TEMPLATES).join(", ")}`);
  }
  return template.buildDocument(overrides);
}
