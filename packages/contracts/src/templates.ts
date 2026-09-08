import type { Block } from "./blocks.js";
import { ProductDocument, ProductDocumentSchema } from "./document.js";

export interface LayoutTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  badge: string;
  recommendedCategory?: string;
  blockTypes?: Block["type"][];
  generateBlocks: (meta: { title: string; tagline: string; websiteUrl: string; screenshotUrl?: string }) => Block[];
  buildDocument?: (overrides: Partial<ProductDocument> & { title?: string; name?: string; slug?: string; tagline: string; description?: string; websiteUrl: string }) => ProductDocument;
}

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: "saas-launch",
    slug: "saas-launch",
    name: "SaaS Launch Template",
    description: "Standard high-conversion layout for software products, micro-SaaS, and web platforms.",
    badge: "Most Popular",
    recommendedCategory: "saas",
    blockTypes: ["hero", "mediaGallery", "grid", "techStack", "faq", "cta"],
    generateBlocks: (meta) => [
      {
        id: "hero-1",
        type: "hero",
        props: {
          headline: meta.title,
          subheadline: meta.tagline,
          primaryCtaText: "Get Started",
          primaryCtaUrl: meta.websiteUrl,
          badge: "Verified Launch"
        }
      },
      ...(meta.screenshotUrl
        ? [
            {
              id: "media-1",
              type: "mediaGallery" as const,
              props: {
                images: [
                  {
                    url: meta.screenshotUrl,
                    aspectRatio: "16:9" as const,
                    caption: `${meta.title} Official Dashboard Preview`
                  }
                ]
              }
            }
          ]
        : []),
      {
        id: "grid-1",
        type: "grid",
        props: {
          columns: 3,
          items: [
            {
              title: "Sub-millisecond Latency",
              description: "Engineered for maximum edge performance and instant client responses."
            },
            {
              title: "Deterministic Security",
              description: "Protected by Turnstile verification and cryptographic audit hashes."
            },
            {
              title: "Frictionless Integration",
              description: "Connect with developer CLI tools, MCP servers, and modern SDKs."
            }
          ]
        }
      },
      {
        id: "tech-1",
        type: "techStack",
        props: {
          technologies: [
            { name: "TypeScript", category: "Runtime" },
            { name: "Next.js", category: "Framework" },
            { name: "Cloudflare", category: "Edge Infrastructure" },
            { name: "PostgreSQL", category: "Database" }
          ]
        }
      },
      {
        id: "faq-1",
        type: "faq",
        props: {
          items: [
            {
              question: `How does ${meta.title} work?`,
              answer: `${meta.title} provides a streamlined, high-trust developer experience.`
            },
            {
              question: "Can I integrate with my existing workflow?",
              answer: "Yes, standard APIs and CLI tools are provided out of the box."
            }
          ]
        }
      },
      {
        id: "cta-1",
        type: "cta",
        props: {
          title: `Start Building with ${meta.title}`,
          subtitle: "Join hundreds of builders accelerating their product development today.",
          buttonText: "Launch Now",
          buttonUrl: meta.websiteUrl
        }
      }
    ]
  },
  {
    id: "ai-agent",
    slug: "ai-agent",
    name: "AI Tool & Autonomous Agent Template",
    description: "Designed for LLM applications, AI agents, cognitive memory layers, and MCP toolkits.",
    badge: "AI Native",
    recommendedCategory: "ai-agent",
    blockTypes: ["hero", "mediaGallery", "grid", "milestones", "cta"],
    generateBlocks: (meta) => [
      {
        id: "hero-1",
        type: "hero",
        props: {
          headline: `${meta.title} - Autonomous Intelligence`,
          subheadline: meta.tagline,
          primaryCtaText: "Deploy Agent",
          primaryCtaUrl: meta.websiteUrl,
          badge: "AI Agent Framework"
        }
      },
      ...(meta.screenshotUrl
        ? [
            {
              id: "media-1",
              type: "mediaGallery" as const,
              props: {
                images: [
                  {
                    url: meta.screenshotUrl,
                    aspectRatio: "16:9" as const,
                    caption: `${meta.title} Agent Runtime Console`
                  }
                ]
              }
            }
          ]
        : []),
      {
        id: "grid-1",
        type: "grid",
        props: {
          columns: 3,
          items: [
            {
              title: "Continuous Reasoning",
              description: "Multi-model reasoning protocols with autonomous verification loops."
            },
            {
              title: "Long-Term Memory",
              description: "Episodic and semantic memory that survives session resets."
            },
            {
              title: "Model Context Protocol",
              description: "Full MCP server integration for Cursor, Claude Code, and Codex."
            }
          ]
        }
      },
      {
        id: "milestones-1",
        type: "milestones",
        props: {
          items: [
            {
              title: "v1.0 Architecture Released",
              date: "2026-08",
              description: "Core autonomous execution protocol finalized."
            },
            {
              title: "10,000+ Agent Tasks Executed",
              date: "2026-09",
              description: "High-throughput production milestone reached."
            }
          ]
        }
      },
      {
        id: "cta-1",
        type: "cta",
        props: {
          title: `Supercharge Your AI Stack with ${meta.title}`,
          subtitle: "Connect your autonomous agents to production-grade intelligence.",
          buttonText: "Explore Agent",
          buttonUrl: meta.websiteUrl
        }
      }
    ]
  },
  {
    id: "dev-tool",
    slug: "dev-tool",
    name: "Developer Framework & CLI Template",
    description: "Tailored for command-line tools, backend engines, npm packages, and infrastructure frameworks.",
    badge: "Developer First",
    recommendedCategory: "developer-tools",
    blockTypes: ["hero", "techStack", "grid", "changelog", "cta"],
    generateBlocks: (meta) => [
      {
        id: "hero-1",
        type: "hero",
        props: {
          headline: `${meta.title} — Built for High-Impact Engineers`,
          subheadline: meta.tagline,
          primaryCtaText: "Install Package",
          primaryCtaUrl: meta.websiteUrl,
          badge: "Open Source / CLI"
        }
      },
      {
        id: "tech-1",
        type: "techStack",
        props: {
          technologies: [
            { name: "Node.js", category: "Engine" },
            { name: "Commander.js", category: "CLI" },
            { name: "Zod", category: "Schema Validation" }
          ]
        }
      },
      {
        id: "grid-1",
        type: "grid",
        props: {
          columns: 2,
          items: [
            {
              title: "Zero Configuration Required",
              description: "Sane defaults with declarative config overrides when needed."
            },
            {
              title: "CI/CD Automation",
              description: "Seamless execution in GitHub Actions, GitLab CI, and Docker."
            }
          ]
        }
      },
      {
        id: "changelog-1",
        type: "changelog",
        props: {
          entries: [
            {
              version: "1.0.0",
              date: "2026-09-02",
              changes: ["Initial stable release with full CLI suite", "Cryptographic SHA-256 validation"]
            }
          ]
        }
      },
      {
        id: "cta-1",
        type: "cta",
        props: {
          title: `Start Building with ${meta.title}`,
          subtitle: "Read the complete developer documentation and get started in seconds.",
          buttonText: "Read Docs",
          buttonUrl: meta.websiteUrl
        }
      }
    ]
  },
  {
    id: "community-curated",
    slug: "community-curated",
    name: "Curated Directory / Community Template",
    description: "Ideal for curated catalogs, founder collectives, community directories, and knowledge wikis.",
    badge: "Community Hub",
    recommendedCategory: "community",
    blockTypes: ["hero", "founder", "grid", "cta"],
    generateBlocks: (meta) => [
      {
        id: "hero-1",
        type: "hero",
        props: {
          headline: meta.title,
          subheadline: meta.tagline,
          primaryCtaText: "Join Community",
          primaryCtaUrl: meta.websiteUrl,
          badge: "Verified Community"
        }
      },
      {
        id: "founder-1",
        type: "founder",
        props: {
          name: "Next Level Builders Board",
          bio: "Empowering indie hackers, solopreneurs, and engineers to ship verifiable products with transparent distribution.",
          xHandle: "nextlevelbuilders"
        }
      },
      {
        id: "grid-1",
        type: "grid",
        props: {
          columns: 3,
          items: [
            { title: "Peer Reviewed", description: "Every submission is vetted by experienced builders." },
            { title: "Public Metrics", description: "Transparent community voting and organic rank snapshots." },
            { title: "Zero Pay-to-Rank", description: "Integrity-first platform without sponsored placement bias." }
          ]
        }
      },
      {
        id: "cta-1",
        type: "cta",
        props: {
          title: `Join ${meta.title} Today`,
          subtitle: "Connect with fellow builders and accelerate your journey.",
          buttonText: "Visit Hub",
          buttonUrl: meta.websiteUrl
        }
      }
    ]
  },
  {
    id: "minimalist",
    slug: "minimalist",
    name: "Minimalist High-Impact Showcase",
    description: "Compact single-fold layout highlighting essential product screenshots, core metrics, and primary CTA.",
    badge: "Minimalist",
    recommendedCategory: "showcase",
    blockTypes: ["hero", "mediaGallery", "cta"],
    generateBlocks: (meta) => [
      {
        id: "hero-1",
        type: "hero",
        props: {
          headline: meta.title,
          subheadline: meta.tagline,
          primaryCtaText: "Visit Website",
          primaryCtaUrl: meta.websiteUrl
        }
      },
      ...(meta.screenshotUrl
        ? [
            {
              id: "media-1",
              type: "mediaGallery" as const,
              props: {
                images: [
                  {
                    url: meta.screenshotUrl,
                    aspectRatio: "16:9" as const,
                    caption: `${meta.title} Showcase Screenshot`
                  }
                ]
              }
            }
          ]
        : []),
      {
        id: "cta-1",
        type: "cta",
        props: {
          title: `Discover ${meta.title}`,
          subtitle: "Visit the live application.",
          buttonText: "Open App",
          buttonUrl: meta.websiteUrl
        }
      }
    ]
  }
];

export function listTemplates(): LayoutTemplate[] {
  return LAYOUT_TEMPLATES;
}

const SLUG_ALIASES: Record<string, string> = {
  "developer-cli": "dev-tool",
  "ai-agent-tool": "ai-agent",
  "curated-community": "community-curated",
  "minimalist-showcase": "minimalist"
};

export function getTemplate(slugOrName: string): LayoutTemplate | undefined {
  const raw = slugOrName.toLowerCase().trim();
  const query = SLUG_ALIASES[raw] || raw;
  return LAYOUT_TEMPLATES.find(
    (t) =>
      t.id.toLowerCase() === query ||
      t.slug.toLowerCase() === query ||
      t.name.toLowerCase() === query ||
      t.name.toLowerCase().includes(query)
  );
}

export function buildDocumentFromTemplate(
  templateSlug: string,
  overrides: {
    title?: string;
    name?: string;
    slug?: string;
    tagline?: string;
    description?: string;
    websiteUrl?: string;
    categorySlugs?: string[];
    tagSlugs?: string[];
    screenshotUrl?: string;
  }
): ProductDocument {
  const t = getTemplate(templateSlug) || LAYOUT_TEMPLATES[0];
  const title = overrides.title || overrides.name || "My Project";
  const tagline = overrides.tagline || "Built for high-impact developers.";
  const description = overrides.description || `${title} provides high-trust capabilities for modern builders.`;
  const websiteUrl = overrides.websiteUrl || "https://example.com";
  const categorySlugs = overrides.categorySlugs && overrides.categorySlugs.length > 0 ? overrides.categorySlugs : [t.recommendedCategory || "developer-tools"];
  const tagSlugs = overrides.tagSlugs || ["ai", "devtools"];

  const blocks = t.generateBlocks({
    title,
    tagline,
    websiteUrl,
    screenshotUrl: overrides.screenshotUrl
  });

  return ProductDocumentSchema.parse({
    schemaVersion: 1,
    title,
    tagline,
    description: description.length < 10 ? `${description} - Next Level Builders` : description,
    websiteUrl,
    categorySlugs,
    tagSlugs,
    blocks
  });
}

// Attach buildDocument method to each template
for (const t of LAYOUT_TEMPLATES) {
  t.buildDocument = (overrides) => buildDocumentFromTemplate(t.slug, overrides);
}

export const createDocumentFromTemplate = buildDocumentFromTemplate;

// Backward compatibility aliases
export const SaasLaunchTemplate = LAYOUT_TEMPLATES[0];
export const AiAgentTemplate = LAYOUT_TEMPLATES[1];
export const DeveloperCliTemplate = LAYOUT_TEMPLATES[2];
export const CuratedCommunityTemplate = LAYOUT_TEMPLATES[3];
export const MinimalistShowcaseTemplate = LAYOUT_TEMPLATES[4];
