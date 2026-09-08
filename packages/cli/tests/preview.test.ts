import { describe, it, expect } from "vitest";
import { renderProductPreview } from "../src/preview/ascii.js";
import { createDocumentFromTemplate } from "@nextlevelbuilder/contracts";

describe("CLI: Preview ASCII Renderer", () => {
  it("should render Unicode box preview for a valid product document", () => {
    const doc = createDocumentFromTemplate("saas-launch", {
      name: "SaaS Pro",
      slug: "saas-pro",
      tagline: "Scale with confidence",
      description: "High velocity SaaS platform.",
      websiteUrl: "https://saaspro.example.com"
    });

    const rendered = renderProductPreview(doc, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(rendered).toContain("SaaS Pro");
    expect(rendered).toContain("saas-pro");
    expect(rendered).toContain("Scale with confidence");
    expect(rendered).toContain("Product Blocks");
    expect(rendered).toContain("HERO");
    expect(rendered).toContain("GRID");
    expect(rendered).toContain("FAQ");
    expect(rendered).toContain("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});
