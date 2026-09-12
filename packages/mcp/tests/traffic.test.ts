import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { McpServer } from "../src/server.js";
import { handleWorkerFetch } from "../src/transports/worker.js";

const response = { data: {
  source: "clickhouse", from: "2026-08-01T00:00:00Z", to: "2026-08-31T00:00:00Z",
  updatedAt: "2026-08-31T00:00:00Z", pageViews: 12, visitors: 8, outboundClicks: 3, activeVisitors: 1,
  series: [{ date: "2026-08-01", pageViews: 12, visitors: 8, outboundClicks: 3 }],
  referrers: [{ name: "example.com", count: 4 }], countries: [{ name: "VN", count: 8 }], devices: [{ name: "desktop", count: 8 }]
} };
const server = new McpServer();
const tool = server.getTool("get_product_traffic")!;
const call = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_product_traffic", arguments: { slug: "product" } } };
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("MCP product traffic", () => {
  it("advertises traffic with explicit product and range inputs", () => {
    expect(server.listTools().map(t => t.name)).toContain("get_product_traffic");
    expect(tool.inputSchema.required).toEqual(["slug"]);
    expect(tool.inputSchema.properties).toHaveProperty("from");
    expect(tool.description).toContain("reset each UTC day");
  });

  it("reuses configured key and URL, encodes inputs, and returns validated traffic", async () => {
    const fetchFn = vi.fn(async () => Response.json(response));
    vi.stubGlobal("fetch", fetchFn);
    expect(await tool.handler({ slug: "a/b", from: response.data.from, to: response.data.to }, { workerAuth: true, env: { NLB_API_KEY: "nlb_live_test", NLB_API_URL: "https://staging.nextlevelbuilder.io" } })).toEqual(response);
    const [rawUrl, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const url = new URL(rawUrl);
    expect(url.origin).toBe("https://staging.nextlevelbuilder.io");
    expect(url.pathname).toBe("/api/v1/products/a%2Fb/traffic");
    expect(url.searchParams.get("to")).toBe(response.data.to);
    expect(init.headers).toMatchObject({ Authorization: "Bearer nlb_live_test" });
  });

  it("blocks anonymous Worker callers before using the configured server key", async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal("fetch", fetchFn);
    const result = await handleWorkerFetch(new Request("https://worker.example/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(call) }), { NLB_API_KEY: "nlb_live_server" });
    expect((await result.json() as { error: { code: number } }).error.code).toBe(-32001);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("allows authenticated Worker callers with configured credentials", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(response)));
    const result = await handleWorkerFetch(new Request("https://worker.example/mcp", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer worker-test" }, body: JSON.stringify(call) }), { WORKER_AUTH_TOKEN: "worker-test", NLB_API_KEY: "nlb_live_server" });
    const payload = await result.json() as { result: { isError: boolean; content: { text: string }[] } };
    expect(payload.result.isError).toBe(false);
    expect(JSON.parse(payload.result.content[0].text)).toEqual(response);
  });

  it("enforces the existing endpoint allowlist and rejects invalid ranges before fetching", async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal("fetch", fetchFn);
    await expect(tool.handler({ slug: "product", api_url: "https://untrusted.example" })).rejects.toThrow("disallowed");
    await expect(tool.handler({ slug: "product", from: "2026-01-01T00:00:00Z", to: "2026-08-31T00:00:00Z" })).rejects.toThrow("90 days");
    await expect(tool.handler({ slug: "product", from: 123 })).rejects.toThrow();
    await expect(tool.handler({ slug: "product", to: "2026-09-01T00:00:00.001Z" })).rejects.toThrow("future");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns explicit errors for unavailable data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Unavailable" }, { status: 503 })));
    const result = await server.handleMessage(call);
    expect(result?.result).toMatchObject({ isError: true });
    expect(JSON.stringify(result)).toContain("503");
  });
});
