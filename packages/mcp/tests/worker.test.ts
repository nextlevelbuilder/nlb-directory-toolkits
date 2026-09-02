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
  });
});
