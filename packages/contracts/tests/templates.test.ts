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
      "ai-agent",
      "dev-tool",
      "community-curated",
      "minimalist"
    ]);
  });

  it("should find templates by slug or name (including legacy aliases)", () => {
    expect(getTemplate("dev-tool")).toBe(DeveloperCliTemplate);
    expect(getTemplate("developer-cli")).toBe(DeveloperCliTemplate);
    expect(getTemplate("Developer Framework & CLI Template")).toBe(DeveloperCliTemplate);
    expect(getTemplate("saas-launch")).toBe(SaasLaunchTemplate);
    expect(getTemplate("ai-agent")).toBe(AiAgentTemplate);
    expect(getTemplate("ai-agent-tool")).toBe(AiAgentTemplate);
    expect(getTemplate("community-curated")).toBe(CuratedCommunityTemplate);
    expect(getTemplate("curated-community")).toBe(CuratedCommunityTemplate);
    expect(getTemplate("minimalist")).toBe(MinimalistShowcaseTemplate);
    expect(getTemplate("minimalist-showcase")).toBe(MinimalistShowcaseTemplate);
  });

  it("should build valid ProductDocuments from templates", () => {
    const doc = createDocumentFromTemplate("dev-tool", {
      name: "NLB Toolkit",
      tagline: "The fastest CLI for builders",
      description: "A comprehensive developer toolkit.",
      websiteUrl: "https://nextlevelbuilder.io"
    });

    const parsed = ProductDocumentSchema.parse(doc);
    expect(parsed.title).toBe("NLB Toolkit");
    expect(parsed.categorySlugs).toContain("developer-tools");
    expect(parsed.blocks.length).toBeGreaterThanOrEqual(4);
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
      if (!template.buildDocument) continue;
      const doc = template.buildDocument({
        name: `Sample ${template.name}`,
        tagline: "A sample product",
        description: "Detailed sample description for validation.",
        websiteUrl: "https://example.com"
      });
      expect(() => ProductDocumentSchema.parse(doc)).not.toThrow();
    }
  });
});
