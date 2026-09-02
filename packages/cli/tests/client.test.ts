import { describe, it, expect } from "vitest";
import { NlbApiClient } from "../src/api/client.js";
import { createDocumentFromTemplate } from "@nextlevelbuilder/contracts";

describe("CLI: NlbApiClient", () => {
  it("should execute createProduct, createRevision, and submitProduct with mock fetch", async () => {
    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/v1/products") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Created",
            product: {
              id: "prod_1",
              name: "Mock Product",
              slug: "mock-product",
              tagline: "A mock product",
              category: "Developer Tools",
              tags: ["tools"],
              websiteUrl: "https://example.com",
              trustScore: 90,
              status: "draft",
              createdAt: "2026-09-01T00:00:00Z",
              updatedAt: "2026-09-01T00:00:00Z"
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/revisions") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({
            success: true,
            message: "Revision uploaded",
            revision: {
              revisionId: "rev_1",
              productSlug: "mock-product",
              contentHash: body.contentHash,
              hashVersion: "v1",
              document: body.document,
              status: "draft"
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/submit") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Submitted",
            submissionId: "sub_1",
            status: "pending_review",
            estimatedReviewHours: 24
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ message: "Not found" }), { status: 404 });
    };

    const client = new NlbApiClient({
      baseUrl: "https://test.nextlevelbuilder.io",
      apiKey: "test_key",
      fetchFn: mockFetch as unknown as typeof fetch
    });

    const doc = createDocumentFromTemplate("developer-cli", {
      name: "Mock Product",
      slug: "mock-product",
      tagline: "A mock product",
      description: "Description",
      websiteUrl: "https://example.com"
    });

    const createResp = await client.createProduct({
      name: doc.name,
      slug: doc.slug,
      tagline: doc.tagline,
      description: doc.description,
      category: doc.category,
      tags: doc.tags,
      websiteUrl: doc.websiteUrl
    });
    expect(createResp.success).toBe(true);
    expect(createResp.product.slug).toBe("mock-product");

    const revResp = await client.createRevision("mock-product", {
      contentHash: "1111111111111111111111111111111111111111111111111111111111111111",
      hashVersion: "v1",
      document: doc
    });
    expect(revResp.success).toBe(true);
    expect(revResp.revision.revisionId).toBe("rev_1");

    const submitResp = await client.submitProduct("mock-product", {
      revisionId: "rev_1"
    });
    expect(submitResp.success).toBe(true);
    expect(submitResp.submissionId).toBe("sub_1");
    expect(submitResp.status).toBe("pending_review");
  });
});
