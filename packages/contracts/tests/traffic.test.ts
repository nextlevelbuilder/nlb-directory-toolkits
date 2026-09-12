import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { AnalyticsBlockSchema, BlockSchema } from "../src/blocks.js";
import { ProductTrafficQuerySchema, ProductTrafficResponseSchema } from "../src/api.js";
import { toServerDocument } from "../src/document.js";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Analytics block", () => {
  it("applies defaults and preserves explicit periods in revision documents", () => {
    expect(BlockSchema.parse({ id: "traffic", type: "analytics", props: {} }).props)
      .toEqual({ title: "Traffic", period: "30d" });
    const document = toServerDocument({
      title: "Product", tagline: "Product tagline", description: "A product description",
      websiteUrl: "https://example.com", category: "developer-tools",
      blocks: [{ id: "traffic", type: "analytics", props: { title: "Visitors", period: "7d" } }]
    });
    expect(document.blocks[0]).toEqual({ id: "traffic", type: "analytics", props: { title: "Visitors", period: "7d" } });
    expect(toServerDocument({ ...document, blocks: [{ type: "analytics", title: "Traffic", period: "90d" }] }).blocks[0])
      .toEqual({ id: "block-1", type: "analytics", props: { title: "Traffic", period: "90d" } });
  });

  it("rejects unsupported periods and empty or excessive titles", () => {
    expect(AnalyticsBlockSchema.safeParse({ id: "a", type: "analytics", props: { period: "1y" } }).success).toBe(false);
    expect(AnalyticsBlockSchema.safeParse({ id: "a", type: "analytics", props: { title: "" } }).success).toBe(false);
    expect(AnalyticsBlockSchema.safeParse({ id: "a", type: "analytics", props: { title: "x".repeat(101) } }).success).toBe(false);
  });
});

describe("Product traffic wire contracts", () => {
  it("accepts default and bounded UTC ranges", () => {
    expect(ProductTrafficQuerySchema.parse({})).toEqual({});
    expect(ProductTrafficQuerySchema.safeParse({ from: "2026-06-01T00:00:00Z", to: "2026-08-30T00:00:00Z" }).success).toBe(true);
    expect(ProductTrafficQuerySchema.safeParse({ to: "2026-08-30T00:00:00Z" }).success).toBe(true);
    expect(ProductTrafficQuerySchema.safeParse({ to: "2026-09-01T00:00:00Z" }).success).toBe(true);
  });

  it("rejects a range ending even one millisecond in the future", () => {
    const result = ProductTrafficQuerySchema.safeParse({ to: "2026-09-01T00:00:00.001Z" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ["to"], message: expect.stringContaining("future") })
    ]));
  });

  it.each([
    { from: "2026-06-01", to: "2026-06-02T00:00:00Z" },
    { from: "2026-06-01T00:00:00Z", to: "2026-06-01T00:00:00Z" },
    { from: "2026-06-02T00:00:00Z", to: "2026-06-01T00:00:00Z" },
    { from: "2026-06-01T00:00:00Z", to: "2026-08-31T00:00:00Z" }
  ])("rejects invalid or excessive date ranges: %j", (query) => {
    expect(ProductTrafficQuerySchema.safeParse(query).success).toBe(false);
  });

  it("requires provider-backed totals and breakdowns instead of defaulting missing data to zero", () => {
    expect(ProductTrafficResponseSchema.safeParse({ data: {} }).success).toBe(false);
    expect(ProductTrafficResponseSchema.safeParse({ data: { source: "posthog" } }).success).toBe(false);
  });
});
