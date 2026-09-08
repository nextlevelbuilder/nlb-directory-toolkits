import { describe, it, expect } from "vitest";
import {
  ProductCreateInputSchema,
  ProductCreateResponseSchema,
  ProductRevisionInputSchema,
  ProductRevisionResponseSchema,
  ProductSubmitInputSchema,
  ProductSubmitResponseSchema,
  ProductListQuerySchema,
  ProductListResponseSchema,
  ProductDetailResponseSchema,
  RankingsQuerySchema,
  RankingsResponseSchema,
  StatsResponseSchema,
  HealthResponseSchema,
  VoteInputSchema,
  ApiKeyListResponseSchema,
  ApiKeyCreateResponseSchema,
  ApiKeyRevokeResponseSchema,
  MediaUploadResponseSchema,
  CheckoutInputSchema,
  CheckoutResponseSchema
} from "../src/api.js";

describe("Contracts: API Endpoint Wire Schemas", () => {
  it("should parse ProductCreateInput with title or name", () => {
    const inputWithName = {
      orgId: "org-123",
      slug: "my-tool",
      name: "My Tool",
      tagline: "A great tool",
      websiteUrl: "https://example.com"
    };
    const parsed = ProductCreateInputSchema.parse(inputWithName);
    expect(parsed.title).toBe("My Tool");
    expect(parsed.orgId).toBe("org-123");
    expect(parsed.slug).toBe("my-tool");
  });

  it("should parse ProductCreateResponse wire shape", () => {
    const wireResponse = {
      data: {
        id: "prod-1",
        slug: "my-tool",
        title: "My Tool",
        tagline: "A great tool",
        websiteUrl: "https://example.com",
        trustScore: 0,
        status: "draft"
      }
    };
    const parsed = ProductCreateResponseSchema.parse(wireResponse);
    expect(parsed.data?.title).toBe("My Tool");
  });

  it("should parse ProductRevisionResponse wire shape", () => {
    const wireResponse = {
      data: {
        id: "rev-1",
        productId: "prod-1",
        revisionNumber: 1,
        contentHash: "a".repeat(64),
        status: "draft"
      }
    };
    const parsed = ProductRevisionResponseSchema.parse(wireResponse);
    expect(parsed.data?.revisionNumber).toBe(1);
  });

  it("should parse ProductSubmitResponse for HTTP 200 and HTTP 402", () => {
    const successPayload = {
      data: {
        submissionId: "sub-1",
        caseId: "case-1",
        status: "awaiting_human",
        isEarlyBird: true
      }
    };
    const parsedSuccess = ProductSubmitResponseSchema.parse(successPayload);
    expect("data" in parsedSuccess).toBe(true);

    const paymentPayload = {
      requiresPayment: true,
      checkoutUrl: "https://polar.sh/checkout/123",
      amount: "$24.50",
      isEarlyBird: true,
      slotNumber: 42
    };
    const parsedPayment = ProductSubmitResponseSchema.parse(paymentPayload);
    expect("requiresPayment" in parsedPayment && parsedPayment.requiresPayment).toBe(true);
    if ("amount" in parsedPayment) {
      expect(parsedPayment.amount).toBe("$24.50");
    }
  });

  it("should parse ProductListQuery and ProductListResponse", () => {
    const query = ProductListQuerySchema.parse({ limit: 10, offset: 20 });
    expect(query.limit).toBe(10);
    expect(query.offset).toBe(20);

    const listResp = {
      data: [
        {
          id: "prod-1",
          slug: "tool-1",
          title: "Tool 1",
          tagline: "Tagline",
          websiteUrl: "https://example.com",
          trustScore: 85,
          status: "published"
        }
      ],
      pagination: {
        limit: 10,
        offset: 20,
        count: 1
      }
    };
    const parsedList = ProductListResponseSchema.parse(listResp);
    expect(parsedList.data).toHaveLength(1);
    expect(parsedList.pagination.count).toBe(1);
  });

  it("should parse RankingsResponse wire shape with ranks array", () => {
    const rankingsResp = {
      data: {
        id: "snap-1",
        windowType: "daily",
        windowDate: "2026-09-08",
        ranks: [
          { rank: 1, productId: "prod-1", voteCount: 45, score: 450 }
        ],
        snapshotHash: "hash123"
      }
    };
    const parsed = RankingsResponseSchema.parse(rankingsResp);
    expect(parsed.data.ranks[0].rank).toBe(1);
    expect(parsed.data.ranks[0].voteCount).toBe(45);
  });

  it("should parse StatsResponse with nullable stats", () => {
    const statsOk = {
      success: true,
      stats: {
        publishedCount: 15,
        outboundClicks: 320,
        registeredBuilders: 80,
        totalVotes: 120
      },
      updatedAt: "2026-09-08T00:00:00Z"
    };
    expect(StatsResponseSchema.parse(statsOk).success).toBe(true);

    const statsDegraded = {
      success: false,
      stats: null,
      error: "Temporarily unavailable"
    };
    expect(StatsResponseSchema.parse(statsDegraded).stats).toBeNull();
  });

  it("should parse HealthResponse with connected or disconnected database", () => {
    const healthy = {
      status: "ok",
      database: "connected",
      products_count: 15,
      timestamp: "2026-09-08T00:00:00Z"
    };
    expect(HealthResponseSchema.parse(healthy).status).toBe("ok");

    const degraded = {
      status: "degraded",
      database: "disconnected",
      error: "DB timeout",
      stack: "Error: DB timeout\n    at ...",
      timestamp: "2026-09-08T00:00:00Z"
    };
    expect(HealthResponseSchema.parse(degraded).database).toBe("disconnected");
  });

  it("should parse MediaUploadResponse with relative dev url or full url", () => {
    const devUpload = {
      success: true,
      url: "/uploads/abc.png",
      storageKey: "public/uploads/abc.png",
      provider: "local-dev" as const
    };
    expect(MediaUploadResponseSchema.parse(devUpload).url).toBe("/uploads/abc.png");

    const r2Upload = {
      success: true,
      url: "https://pub-r2.nextlevelbuilder.io/uploads/abc.png",
      provider: "cloudflare-r2" as const
    };
    expect(MediaUploadResponseSchema.parse(r2Upload).provider).toBe("cloudflare-r2");
  });

  it("should parse CheckoutInput and Response", () => {
    const checkoutIn = {
      productId: "e0a6d0c7-0002-4b47-b89a-000000000002",
      customerEmail: "user@example.com"
    };
    expect(CheckoutInputSchema.parse(checkoutIn).productId).toBe("e0a6d0c7-0002-4b47-b89a-000000000002");

    const checkoutOut = {
      url: "https://polar.sh/checkout/session-123"
    };
    expect(CheckoutResponseSchema.parse(checkoutOut).url).toContain("polar.sh");
  });
});
