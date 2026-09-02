import { McpServer } from "../server.js";

export interface WorkerEnv {
  NLB_API_KEY?: string;
  NLB_API_URL?: string;
  WORKER_AUTH_TOKEN?: string;
}

const serverInstance = new McpServer();

// Active SSE session stream listeners
type SseListener = (event: string, data: unknown) => void;
const sseSessions = new Map<string, SseListener>();

function generateSessionId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // Compatible UUIDv4 fallback for runtimes where crypto is not on globalThis
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Cloudflare Workers standard fetch handler.
 * Handles:
 * - POST / or POST /mcp: Direct JSON-RPC request/response
 * - GET /sse: Server-Sent Events stream initialization
 * - POST /message?sessionId=<id>: Process client messages and stream responses to SSE
 * - GET /health: Health check endpoint
 */
export async function handleWorkerFetch(request: Request, env?: WorkerEnv): Promise<Response> {
  const url = new URL(request.url);

  // CORS headers
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Health check
  if (url.pathname === "/health" || (url.pathname === "/" && request.method === "GET")) {
    return new Response(
      JSON.stringify({
        status: "ok",
        service: "nlb-directory-mcp",
        version: "0.1.0",
        toolsCount: serverInstance.listTools().length
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }

  // Optional worker authentication check when WORKER_AUTH_TOKEN is configured
  let isWorkerAuthenticated = true;
  if (env?.WORKER_AUTH_TOKEN) {
    const authHeader = request.headers.get("Authorization");
    const expectedToken = `Bearer ${env.WORKER_AUTH_TOKEN}`;
    isWorkerAuthenticated = authHeader === expectedToken;
  }

  // SSE Transport initialization
  if (url.pathname === "/sse" && request.method === "GET") {
    const sessionId = generateSessionId();
    const messageEndpoint = `/message?sessionId=${sessionId}`;

    let streamListener: SseListener;

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        // Send initial endpoint event per MCP SSE spec
        controller.enqueue(encoder.encode(`event: endpoint\ndata: ${messageEndpoint}\n\n`));

        streamListener = (event: string, data: unknown) => {
          try {
            const payload = typeof data === "string" ? data : JSON.stringify(data);
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
          } catch {
            // Stream might be closed
          }
        };

        sseSessions.set(sessionId, streamListener);
      },
      cancel() {
        sseSessions.delete(sessionId);
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      }
    });
  }

  // POST /message (SSE message routing)
  if (url.pathname === "/message" && request.method === "POST") {
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId || !sseSessions.has(sessionId)) {
      return new Response(JSON.stringify({ error: "Invalid or expired SSE session" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      const rawJson = await request.json();
      const listener = sseSessions.get(sessionId);
      const response = await serverInstance.handleMessage(rawJson, { workerAuth: isWorkerAuthenticated });

      if (response !== null && listener) {
        listener("message", response);
      }

      return new Response(JSON.stringify({ status: "accepted" }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: `Parse error: ${err instanceof Error ? err.message : String(err)}` }
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Direct JSON-RPC POST (/ or /mcp)
  if (request.method === "POST" && (url.pathname === "/" || url.pathname === "/mcp")) {
    try {
      const rawJson = await request.json();
      const response = await serverInstance.handleMessage(rawJson, { workerAuth: isWorkerAuthenticated });

      if (response === null) {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: `Parse error: ${err instanceof Error ? err.message : String(err)}`
          }
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }
  }

  return new Response("Not Found", { status: 404, headers: corsHeaders });
}

export default {
  fetch: handleWorkerFetch
};
