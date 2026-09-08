import { describe, it, expect } from "vitest";
import {
  AuthorProductDocumentSchema,
  ProductDocumentSchema,
  toServerDocument,
  sanitizeAuthorDocument,
  computeContentHashSync
} from "../src/document.js";
import { createDocumentFromTemplate } from "../src/templates.js";

describe("Contracts: Author vs Canonical Document Schemas", () => {
  it("should validate a canonical server document", () => {
    const doc = createDocumentFromTemplate("dev-tool", {
      title: "Clean Tool",
      tagline: "A clean author submission",
      description: "Description of a modern developer tool.",
      websiteUrl: "https://example.com"
    });

    const parsed = ProductDocumentSchema.parse(doc);
    expect(parsed.title).toBe("Clean Tool");
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.categorySlugs).toContain("developer-tools");
    expect(parsed.blocks.length).toBeGreaterThan(0);
  });

  it("should convert author documents with name/category to canonical server document", () => {
    const authorDoc = {
      name: "Author Name Tool",
      category: "Developer Tools",
      tags: ["ai", "agents"],
      tagline: "High impact tool",
      description: "A comprehensive description that exceeds ten characters.",
      websiteUrl: "https://example.com",
      blocks: [
        {
          id: "hero-1",
          type: "hero",
          props: {
            headline: "My Headline",
            primaryCtaText: "Go",
            primaryCtaUrl: "https://example.com"
          }
        }
      ]
    };

    const parsedAuthor = AuthorProductDocumentSchema.parse(authorDoc);
    const serverDoc = toServerDocument(parsedAuthor);

    expect(serverDoc.title).toBe("Author Name Tool");
    expect(serverDoc.categorySlugs).toEqual(["developer-tools"]);
    expect(serverDoc.tagSlugs).toEqual(["ai", "agents"]);
    expect(ProductDocumentSchema.parse(serverDoc)).toEqual(serverDoc);
  });

  it("should compute deterministic content hash matching server format", () => {
    const doc = createDocumentFromTemplate("saas-launch", {
      title: "Hash Test Product",
      tagline: "Deterministic content hashing test",
      description: "A robust description for hash stability verification.",
      websiteUrl: "https://example.com"
    });

    const hash1 = computeContentHashSync(doc);
    const hash2 = computeContentHashSync(doc);

    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).toBe(hash2);
  });
});
