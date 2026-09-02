import { describe, it, expect } from "vitest";
import {
  listTemplates,
  getTemplate,
  createDocumentFromTemplate,
  SaasLaunchTemplate,
  AiAgentTemplate,
  DeveloperCliTemplate,
  CuratedCommunityTemplate,
  MinimalistShowcaseTemplate
} from "../src/templates.js";
import { ProductDocumentSchema } from "../src/document.js";

describe("Contracts: Layout Templates", () => {
  it("should provide 5 standard layout templates", () => {
    const templates = listTemplates();
    expect(templates).toHaveLength(5);
    const slugs = templates.map((t) => t.slug);
    expect(slugs).toEqual([
      "saas-launch",
      "ai-agent-tool",
      "developer-cli",
      "curated-community",
      "minimalist-showcase"
    ]);
  });

  it("should find templates by slug or name", () => {
    expect(getTemplate("developer-cli")).toBe(DeveloperCliTemplate);
    expect(getTemplate("Developer CLI")).toBe(DeveloperCliTemplate);
    expect(getTemplate("saas-launch")).toBe(SaasLaunchTemplate);
    expect(getTemplate("ai-agent-tool")).toBe(AiAgentTemplate);
    expect(getTemplate("curated-community")).toBe(CuratedCommunityTemplate);
    expect(getTemplate("minimalist-showcase")).toBe(MinimalistShowcaseTemplate);
  });

  it("should build valid ProductDocuments from templates", () => {
    const doc = createDocumentFromTemplate("developer-cli", {
      name: "NLB Toolkit",
      slug: "nlb-toolkit",
      tagline: "The fastest CLI for builders",
      description: "A comprehensive developer toolkit.",
      websiteUrl: "https://nextlevelbuilder.io"
    });

    const parsed = ProductDocumentSchema.parse(doc);
    expect(parsed.name).toBe("NLB Toolkit");
    expect(parsed.slug).toBe("nlb-toolkit");
    expect(parsed.blocks.length).toBeGreaterThanOrEqual(5);
    expect(parsed.metadata.layoutTemplate).toBe("Developer CLI");
  });

  it("should validate all template sample documents against ProductDocumentSchema", () => {
    const templates = [
      SaasLaunchTemplate,
      AiAgentTemplate,
      DeveloperCliTemplate,
      CuratedCommunityTemplate,
      MinimalistShowcaseTemplate
    ];

    for (const template of templates) {
      const doc = template.buildDocument({
        name: `Sample ${template.name}`,
        slug: `sample-${template.slug}`,
        tagline: "A sample product",
        description: "Detailed sample description for validation.",
        websiteUrl: "https://example.com"
      });
      expect(() => ProductDocumentSchema.parse(doc)).not.toThrow();
    }
  });
});
