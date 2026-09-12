import { McpServer, SERVER_VERSION, SUPPORTED_PROTOCOL_VERSIONS } from "../server.js";
import { authorizeOAuthMessage, oauthMetadata, type OAuthEnv } from "../oauth.js";

export interface WorkerEnv extends OAuthEnv {
  NLB_API_KEY?: string;
  NLB_API_URL?: string;
  WORKER_AUTH_TOKEN?: string;
  NLB_ALLOWED_ORIGINS?: string;
}

const serverInstance = new McpServer();

// Active SSE session stream listeners
type SseListener = (event: string, data: unknown) => void;
const sseSessions = new Map<string, SseListener>();

function generateSessionId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = (Math.random() * 256) | 0;
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // UUID v4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id",
    "Access-Control-Expose-Headers": "WWW-Authenticate"
  };

  const origin = request.headers.get("Origin");
  if (origin) {
    const allowedOrigins = [url.origin, ...(env?.NLB_ALLOWED_ORIGINS?.split(",").map((value) => value.trim()) ?? [])];
    if (!allowedOrigins.includes(origin)) {
      return new Response("Forbidden origin", { status: 403 });
    }
    corsHeaders["Access-Control-Allow-Origin"] = origin;
    corsHeaders.Vary = "Origin";
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (env?.NLB_OAUTH_ENABLED === "true" && request.method === "GET" &&
      ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"].includes(url.pathname)) {
    const response = oauthMetadata(env);
    Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }

  // Health check
  if (url.pathname === "/health" || (url.pathname === "/" && request.method === "GET")) {
    return new Response(
      JSON.stringify({
        status: "ok",
        service: "nlb-directory-mcp",
        version: SERVER_VERSION,
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

  // This endpoint is stateless: POST returns JSON, and no GET stream or session is needed.
  if (url.pathname === "/mcp" && request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { ...corsHeaders, Allow: "POST, OPTIONS" }
    });
  }

  // Optional worker authentication check when WORKER_AUTH_TOKEN is configured
  // Fail-closed worker authentication: mutations require explicit valid WORKER_AUTH_TOKEN
  let isWorkerAuthenticated = false;
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
      const context = await authorizeOAuthMessage(request, rawJson, env || {}, {
        workerAuth: isWorkerAuthenticated,
        env: { NLB_API_KEY: env?.NLB_API_KEY, NLB_API_URL: env?.NLB_API_URL }
      });
      if (context instanceof Response) {
        Object.entries(corsHeaders).forEach(([key, value]) => context.headers.set(key, value));
        return context;
      }
      const response = await serverInstance.handleMessage(rawJson, context);

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
    const protocolVersion = request.headers.get("MCP-Protocol-Version");
    if (protocolVersion && !SUPPORTED_PROTOCOL_VERSIONS.some((version) => version === protocolVersion)) {
      return new Response("Unsupported MCP protocol version", { status: 400, headers: corsHeaders });
    }
    if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return new Response("Content-Type must be application/json", { status: 415, headers: corsHeaders });
    }
    try {
      const rawJson = await request.json();
      const context = await authorizeOAuthMessage(request, rawJson, env || {}, {
        workerAuth: isWorkerAuthenticated,
        env: { NLB_API_KEY: env?.NLB_API_KEY, NLB_API_URL: env?.NLB_API_URL }
      });
      if (context instanceof Response) {
        Object.entries(corsHeaders).forEach(([key, value]) => context.headers.set(key, value));
        return context;
      }
      const response = await serverInstance.handleMessage(rawJson, context);

      if (response === null) {
        return new Response(null, { status: 202, headers: corsHeaders });
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
