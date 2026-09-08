import { describe, it, expect } from "vitest";
import { McpServer } from "../src/server.js";

describe("MCP: Server JSON-RPC 2.0 Engine", () => {
  const server = new McpServer();

  it("should handle 'initialize' request", async () => {
    const res = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05" }
    });

    expect(res).toBeDefined();
    expect(res?.id).toBe(1);
    expect(res?.result).toBeDefined();
    const result = res?.result as { serverInfo: { name: string }; protocolVersion: string };
    expect(result.serverInfo.name).toBe("nlb-directory-mcp");
    expect(result.protocolVersion).toBe("2024-11-05");
  });

  it("should handle 'ping' request", async () => {
    const res = await server.handleMessage({
      jsonrpc: "2.0",
      id: "ping-123",
      method: "ping"
    });
    expect(res?.id).toBe("ping-123");
    expect(res?.result).toEqual({});
  });

  it("should return list of tools on 'tools/list'", async () => {
    const res = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list"
    });

    const result = res?.result as { tools: Array<{ name: string }> };
    expect(result.tools).toBeDefined();
    expect(result.tools.length).toBeGreaterThanOrEqual(6);
    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain("validate_listing");
    expect(toolNames).toContain("submit_product");
    expect(toolNames).toContain("get_product");
    expect(toolNames).toContain("get_product_markdown");
    expect(toolNames).toContain("list_products");
    expect(toolNames).toContain("get_leaderboard");
    expect(toolNames).toContain("get_stats");
    expect(toolNames).toContain("check_health");
    expect(toolNames).toContain("cast_vote");
    expect(toolNames).toContain("upload_media");
    expect(toolNames).toContain("create_checkout");
    expect(toolNames).toContain("list_templates");
  });

  it("should return error for unknown method", async () => {
    const res = await server.handleMessage({
      jsonrpc: "2.0",
      id: 99,
      method: "unknown/method"
    });
    expect(res?.error).toBeDefined();
    expect(res?.error?.code).toBe(-32601);
  });
  it("should return error for invalid request payload", async () => {
    const res = await server.handleMessage("invalid");
    expect(res?.error?.code).toBe(-32600);
  });
});
