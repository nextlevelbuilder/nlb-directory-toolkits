import { describe, it, expect } from "vitest";
import { NlbApiClient } from "../src/api/client.js";
import { createDocumentFromTemplate } from "@nextlevelbuilder/contracts";

describe("CLI: NlbApiClient", () => {
  it("should execute createProduct, createRevision, and submitProduct with mock fetch", async () => {
    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/v1/products") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({
            data: {
              id: "prod_1",
              slug: body.slug,
              title: body.title,
              tagline: body.tagline,
              websiteUrl: body.websiteUrl,
              trustScore: 0,
              status: "draft"
            }
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/revisions") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            data: {
              id: "rev_1",
              revisionId: "rev_1",
              productId: "prod_1",
              revisionNumber: 1,
              contentHash: "a".repeat(64),
              status: "draft"
            }
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/submit") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        if (body.payOnly) {
          return new Response(
            JSON.stringify({
              requiresPayment: true,
              checkoutUrl: "https://polar.sh/checkout/123",
              amount: "$24.50",
              isEarlyBird: true,
              slotNumber: 10
            }),
            { status: 402, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            data: {
              submissionId: "sub_1",
              caseId: "case_1",
              status: "awaiting_human",
              isEarlyBird: true
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ message: "Not found" }), { status: 404 });
    };

    const client = new NlbApiClient({
      baseUrl: "https://test.nextlevelbuilder.io",
      apiKey: "nlb_live_test_key_12345",
      fetchFn: mockFetch as unknown as typeof fetch
    });

    const doc = createDocumentFromTemplate("dev-tool", {
      name: "Mock Product",
      tagline: "A mock product",
      description: "Description",
      websiteUrl: "https://example.com"
    });

    const createResp = await client.createProduct({
      orgId: "org-123",
      slug: "mock-product",
      title: doc.title,
      tagline: doc.tagline,
      websiteUrl: doc.websiteUrl
    });
    expect(createResp.data?.slug).toBe("mock-product");

    const revResp = await client.createRevision("mock-product", {
      document: doc
    });
    expect(revResp.data?.id).toBe("rev_1");

    // Test successful submission
    const submitResp = await client.submitProduct("mock-product", {
      revisionId: "rev_1"
    });
    expect("data" in submitResp).toBe(true);
    if ("data" in submitResp && submitResp.data) {
      const sub = submitResp.data as Record<string, unknown>;
      expect(sub.submissionId).toBe("sub_1");
    }

    // Test 402 Payment Required submission
    const payResp = await client.submitProduct("mock-product", {
      revisionId: "rev_1",
      payOnly: true
    });
    expect("requiresPayment" in payResp && payResp.requiresPayment).toBe(true);
    if ("amount" in payResp) {
      expect(payResp.amount).toBe("$24.50");
      expect(payResp.checkoutUrl).toBe("https://polar.sh/checkout/123");
    }
  });

  it("should fetch markdown and handle 404 plaintext", async () => {
    const mockFetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/markdown")) {
        if (url.includes("existing-slug")) {
          return new Response("# Product Title\n\n> Tagline", {
            status: 200,
            headers: { "Content-Type": "text/markdown; charset=utf-8" }
          });
        }
        return new Response("Product not found or not published", {
          status: 404,
          headers: { "Content-Type": "text/plain" }
        });
      }
      return new Response("Not found", { status: 404 });
    };

    const client = new NlbApiClient({
      baseUrl: "https://test.nextlevelbuilder.io",
      fetchFn: mockFetch as unknown as typeof fetch
    });

    const md = await client.getProductMarkdown("existing-slug");
    expect(md).toContain("# Product Title");

    await expect(client.getProductMarkdown("non-existent")).rejects.toThrow(/HTTP 404/);
  });

  it("should fetch rankings, stats, and check health", async () => {
    const mockFetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/rankings")) {
        return new Response(
          JSON.stringify({
            data: {
              id: "snap_1",
              windowType: "daily",
              ranks: [{ rank: 1, productId: "p1", voteCount: 10, score: 100 }]
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/stats")) {
        return new Response(
          JSON.stringify({
            success: true,
            stats: { publishedCount: 5, outboundClicks: 50, registeredBuilders: 20, totalVotes: 30 }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/health")) {
        return new Response(
          JSON.stringify({ status: "ok", database: "connected", db_name: "nlb", timestamp: "2026-09-08T00:00:00Z" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not found", { status: 404 });
    };

    const client = new NlbApiClient({
      baseUrl: "https://test.nextlevelbuilder.io",
      fetchFn: mockFetch as unknown as typeof fetch
    });

    const rankings = await client.getRankings({ window: "daily" });
    expect(rankings.data.ranks[0].rank).toBe(1);

    const stats = await client.getStats();
    expect(stats.stats?.publishedCount).toBe(5);

    const health = await client.checkHealth();
    expect(health.status).toBe("ok");
    expect(health.database).toBe("connected");
  });
});
