import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { NlbApiClient } from "../src/api/client.js";
import { createProgram } from "../src/cli.js";
import { trafficCommand } from "../src/commands/traffic.js";
import { ProductDocumentSchema } from "@nextlevelbuilder/contracts";
import { renderProductPreview } from "../src/preview/ascii.js";

const response = { data: {
  source: "clickhouse", from: "2026-08-01T00:00:00Z", to: "2026-08-31T00:00:00Z",
  updatedAt: "2026-08-31T00:00:00Z", pageViews: 12, visitors: 8, outboundClicks: 3, activeVisitors: 1,
  series: [{ date: "2026-08-01", pageViews: 12, visitors: 8, outboundClicks: 3 }],
  referrers: [{ name: "example.com", count: 4 }], countries: [{ name: "VN", count: 8 }], devices: [{ name: "desktop", count: 8 }]
} };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); process.exitCode = 0; });

describe("CLI traffic", () => {
  it("encodes range and slug while forwarding existing API credentials", async () => {
    const fetchFn = vi.fn(async () => Response.json(response));
    const client = new NlbApiClient({ baseUrl: "https://nextlevelbuilder.io", apiKey: "nlb_live_test", fetchFn });
    expect(await client.getProductTraffic("a/b", { from: response.data.from, to: response.data.to })).toEqual(response);
    const [rawUrl, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const url = new URL(rawUrl);
    expect(url.pathname).toBe("/api/v1/products/a%2Fb/traffic");
    expect(url.searchParams.get("from")).toBe(response.data.from);
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({ Authorization: "Bearer nlb_live_test", "x-api-key": "nlb_live_test" });
  });

  it("rejects invalid ranges without calling the network and rejects malformed responses", async () => {
    const fetchFn = vi.fn(async () => Response.json({ data: {} }));
    const client = new NlbApiClient({ baseUrl: "https://nextlevelbuilder.io", fetchFn });
    await expect(client.getProductTraffic("example", { from: "bad" })).rejects.toThrow();
    await expect(client.getProductTraffic("example", { to: "2026-09-01T00:00:00.001Z" })).rejects.toThrow("future");
    expect(fetchFn).not.toHaveBeenCalled();
    await expect(client.getProductTraffic("example")).rejects.toThrow("schema mismatch");
  });

  it("registers the command and emits the complete response as JSON", async () => {
    const fetchFn = vi.fn(async () => Response.json(response));
    vi.stubGlobal("fetch", fetchFn);
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    await createProgram().parseAsync(["node", "nlb", "traffic", "example", "--from", response.data.from, "--to", response.data.to, "--api-key", "nlb_live_test", "--json"]);
    expect(JSON.parse(output.mock.calls[0][0])).toEqual(response);
  });

  it("reports unavailable traffic with failure status rather than fabricated counts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Traffic unavailable" }, { status: 503 })));
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    await trafficCommand("example", { json: true });
    expect(JSON.parse(output.mock.calls[0][0])).toMatchObject({ success: false, error: expect.stringContaining("503") });
    expect(process.exitCode).toBe(1);
  });

  it("explains daily visitor sessions in human output", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(response)));
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    await trafficCommand("example");
    const text = output.mock.calls.map(([value]) => String(value)).join("\n");
    expect(text).toContain("Daily visitor sessions: 8");
    expect(text).toContain("reset each UTC day");
    expect(text).toContain("counts again");
  });

  it("previews analytics settings and public aggregate disclosure without inventing stats", () => {
    const doc = ProductDocumentSchema.parse({ title: "Product", tagline: "Tagline", description: "Product description", websiteUrl: "https://example.com", categorySlugs: ["developer-tools"], blocks: [{ id: "traffic", type: "analytics", props: {} }] });
    expect(renderProductPreview(doc)).toContain("Traffic (30d)");
    expect(renderProductPreview(doc)).toContain("publishing makes aggregates public");
  });
});
