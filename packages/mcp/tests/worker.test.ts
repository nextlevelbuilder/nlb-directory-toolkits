import { describe, it, expect } from "vitest";
import { handleWorkerFetch } from "../src/transports/worker.js";

describe("MCP: Cloudflare Workers Transport", () => {
  it("should respond to /health endpoint", async () => {
    const req = new Request("https://worker.local/health");
    const res = await handleWorkerFetch(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.service).toBe("nlb-directory-mcp");
    expect(data.toolsCount).toBeGreaterThanOrEqual(6);
  });

  it("should handle CORS preflight OPTIONS request", async () => {
    const req = new Request("https://worker.local/mcp", { method: "OPTIONS" });
    const res = await handleWorkerFetch(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("MCP-Protocol-Version");
  });

  it("should handle direct JSON-RPC POST request", async () => {
    const rpcPayload = {
      jsonrpc: "2.0",
      id: "worker-1",
      method: "initialize"
    };

    const req = new Request("https://worker.local/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpcPayload)
    });

    const res = await handleWorkerFetch(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("worker-1");
    expect(data.result.serverInfo.name).toBe("nlb-directory-mcp");
    expect(data.result.protocolVersion).toBe("2025-06-18");
    expect(res.headers.has("Mcp-Session-Id")).toBe(false);
  });

  it("accepts initialization notifications without a response body", async () => {
    const res = await handleWorkerFetch(new Request("https://worker.local/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "MCP-Protocol-Version": "2025-06-18" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
    }));
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  it.each(["GET", "DELETE", "PUT"])("returns 405 for %s on the stateless endpoint", async (method) => {
    const res = await handleWorkerFetch(new Request("https://worker.local/mcp", { method }));
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST, OPTIONS");
  });

  it.each([
    [{ "Content-Type": "text/plain" }, "{}", 415],
    [{ "Content-Type": "application/json", "MCP-Protocol-Version": "invalid" }, "{}", 400],
    [{ "Content-Type": "application/json" }, "not json", 400]
  ])("rejects invalid HTTP requests", async (headers, body, status) => {
    const res = await handleWorkerFetch(new Request("https://worker.local/mcp", {
      method: "POST", headers: headers as Record<string, string>, body
    }));
    expect(res.status).toBe(status);
  });

  it("rejects untrusted browser origins and allows configured origins", async () => {
    const request = () => new Request("https://worker.local/mcp", {
      method: "OPTIONS", headers: { Origin: "https://client.example" }
    });
    expect((await handleWorkerFetch(request())).status).toBe(403);
    const res = await handleWorkerFetch(request(), { NLB_ALLOWED_ORIGINS: "https://client.example" });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://client.example");
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  it("keeps mutation authorization isolated between HTTP requests", async () => {
    const request = (token?: string) => new Request("https://worker.local/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "submit_product", arguments: {} } })
    });
    const env = { WORKER_AUTH_TOKEN: "test-worker-token" };
    const authorized = await (await handleWorkerFetch(request(env.WORKER_AUTH_TOKEN), env)).json();
    expect(authorized.error).toBeUndefined();
    // Missing document fails local validation, without making a remote mutation.
    expect(authorized.result.isError).toBe(true);
    for (const token of [undefined, "wrong-token"]) {
      const denied = await (await handleWorkerFetch(request(token), env)).json();
      expect(denied.error.code).toBe(-32001);
    }
  });

  it("should initialize SSE stream on /sse and handle /message session routing", async () => {
    const req = new Request("https://worker.local/sse");
    const res = await handleWorkerFetch(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const initialChunk = await reader?.read();
    const initialText = new TextDecoder().decode(initialChunk?.value);
    expect(initialText).toContain("event: endpoint");
    expect(initialText).toContain("sessionId=");

    // Extract session ID
    const match = initialText.match(/sessionId=([a-f0-9-]+)/);
    expect(match).toBeDefined();
    const sessionId = match![1];

    // POST /message with that sessionId
    const msgReq = new Request(`https://worker.local/message?sessionId=${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "sse-msg-1",
        method: "ping"
      })
    });
    const msgRes = await handleWorkerFetch(msgReq);
    expect(msgRes.status).toBe(202);

    // Read response streamed via SSE
    const messageChunk = await reader?.read();
    const messageText = new TextDecoder().decode(messageChunk?.value);
    expect(messageText).toContain("event: message");
    expect(messageText).toContain("sse-msg-1");
    await reader?.cancel();
  });
});
