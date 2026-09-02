import { describe, it, expect } from "vitest";
import {
  AuthorProductDocumentSchema,
  ProductDocumentSchema,
  sanitizeAuthorDocument
} from "../src/document.js";
import { createDocumentFromTemplate } from "../src/templates.js";

describe("Contracts: Author vs Canonical Document Schemas", () => {
  it("should reject client-assigned trustScore in author submissions", () => {
    const doc = createDocumentFromTemplate("developer-cli", {
      name: "Spoofed Tool",
      slug: "spoofed-tool",
      tagline: "Attempting to spoof trust score",
      description: "Description",
      websiteUrl: "https://example.com"
    });

    const spoofed = {
      ...doc,
      metadata: {
        ...doc.metadata,
        trustScore: 100
      }
    };

    expect(() => AuthorProductDocumentSchema.parse(spoofed)).toThrow(/trustScore is a server-assigned directory signal/);
  });

  it("should reject client-assigned featured placement in author submissions", () => {
    const doc = createDocumentFromTemplate("developer-cli", {
      name: "Spoofed Tool",
      slug: "spoofed-tool",
      tagline: "Attempting to spoof featured status",
      description: "Description",
      websiteUrl: "https://example.com"
    });

    const spoofed = {
      ...doc,
      metadata: {
        ...doc.metadata,
        featured: true
      }
    };

    expect(() => AuthorProductDocumentSchema.parse(spoofed)).toThrow(/featured placement is a server-assigned signal/);
  });

  it("should sanitize author documents and enforce unprivileged defaults", () => {
    const authorDoc = createDocumentFromTemplate("developer-cli", {
      name: "Clean Tool",
      slug: "clean-tool",
      tagline: "A clean author submission",
      description: "Description",
      websiteUrl: "https://example.com"
    });

    const parsedAuthor = AuthorProductDocumentSchema.parse(authorDoc);
    const canonical = sanitizeAuthorDocument(parsedAuthor);

    expect(canonical.metadata.trustScore).toBe(0);
    expect(canonical.metadata.featured).toBe(false);
    expect(ProductDocumentSchema.parse(canonical)).toEqual(canonical);
  });
});
