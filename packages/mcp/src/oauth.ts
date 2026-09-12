import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { MCP_SCOPES, requiredToolScope, type McpScope, type ToolContext } from "./tool-context.js";

export interface OAuthEnv {
  NLB_OAUTH_ENABLED?: string;
  NLB_OAUTH_ISSUER?: string;
  NLB_OAUTH_RESOURCE?: string;
  MCP_DELEGATION_SECRET?: string;
  NLB_API_URL?: string;
}

interface OAuthConfig {
  issuer: string;
  resource: string;
  apiUrl: string;
  secret: Uint8Array;
}

function canonicalUrl(value: string): string {
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) || url.username || url.password || url.search || url.hash) {
    throw new Error("OAuth configuration requires HTTPS URLs (HTTP loopback is allowed for development)");
  }
  return url.href.replace(/\/$/, "");
}

function getConfig(env: OAuthEnv): OAuthConfig {
  const issuer = canonicalUrl(env.NLB_OAUTH_ISSUER || "https://nextlevelbuilder.io/api/auth");
  const resource = canonicalUrl(env.NLB_OAUTH_RESOURCE || "https://mcp.nextlevelbuilder.io/mcp");
  const apiUrl = canonicalUrl(env.NLB_API_URL || "https://nextlevelbuilder.io");
  const secret = new TextEncoder().encode(env.MCP_DELEGATION_SECRET || "");
  if (secret.byteLength < 32 || apiUrl !== new URL(apiUrl).origin || new URL(issuer).origin !== apiUrl) {
    throw new Error("OAuth requires a delegation secret and matching issuer/API origins");
  }
  return { issuer, resource, apiUrl, secret };
}

export function oauthMetadata(env: OAuthEnv): Response {
  try {
    const config = getConfig(env);
    return Response.json({
      resource: config.resource,
      authorization_servers: [config.issuer],
      scopes_supported: [...MCP_SCOPES, "offline_access"],
      bearer_methods_supported: ["header"],
      resource_name: "Next Level Builders MCP"
    });
  } catch {
    return Response.json({ error: "OAuth is not configured" }, { status: 503 });
  }
}

function challenge(config: OAuthConfig, status: 401 | 403, scope: McpScope, invalidToken = false): Response {
  const metadataUrl = new URL(`/.well-known/oauth-protected-resource${new URL(config.resource).pathname}`, config.resource);
  const error = status === 403 ? "insufficient_scope" : invalidToken ? "invalid_token" : undefined;
  return Response.json({ error: error || "unauthorized" }, {
    status,
    headers: {
      "WWW-Authenticate": `Bearer resource_metadata="${metadataUrl}", scope="${scope} offline_access"${error ? `, error="${error}"` : ""}`,
      "Cache-Control": "no-store"
    }
  });
}

// Cache only public signing keys. Identity and delegation state are request-local.
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function getKeySet(issuer: string) {
  let keys = keySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${issuer}/jwks`), { timeoutDuration: 5000 });
    keySets.set(issuer, keys);
  }
  return keys;
}

function delegatedFetch(config: OAuthConfig, subject: string, expiresAt: number, scope: McpScope): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin !== config.apiUrl || !url.pathname.startsWith("/api/")) {
      throw new Error("OAuth calls must use the configured NLB API");
    }
    const now = Math.floor(Date.now() / 1000);
    if (expiresAt <= now) throw new Error("OAuth access token expired");
    const headers = new Headers(request.headers);
    headers.delete("Authorization");
    headers.delete("Cookie");
    headers.delete("x-api-key");
    headers.delete("X-NLB-MCP-Assertion");
    if (scope !== "mcp:read") {
      const assertion = await new SignJWT({ scope, method: request.method, path: url.pathname })
        .setProtectedHeader({ alg: "HS256", typ: "nlb-mcp-delegation+jwt" })
        .setIssuer(config.resource).setAudience(`${config.apiUrl}/api`).setSubject(subject)
        .setJti(crypto.randomUUID()).setIssuedAt(now).setExpirationTime(Math.min(now + 60, expiresAt))
        .sign(config.secret);
      headers.set("X-NLB-MCP-Assertion", assertion);
    }
    // Never forward credentials across an upstream redirect.
    return fetch(new Request(request, { headers, redirect: "error" }));
  };
}

export async function authorizeOAuthMessage(
  request: Request,
  message: unknown,
  env: OAuthEnv,
  legacyContext: ToolContext
): Promise<ToolContext | Response> {
  if (env.NLB_OAUTH_ENABLED !== "true" || legacyContext.workerAuth) return legacyContext;
  let config: OAuthConfig;
  try { config = getConfig(env); } catch {
    return Response.json({ error: "OAuth is not configured" }, { status: 503 });
  }
  const rpc = message as { method?: unknown; params?: { name?: unknown } } | null;
  const toolName = rpc?.method === "tools/call" && typeof rpc.params?.name === "string" ? rpc.params.name : "";
  const scope = requiredToolScope(toolName);
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return toolName && scope !== "mcp:read" ? challenge(config, 401, scope) : legacyContext;
  }
  const token = /^Bearer ([^\s]+)$/i.exec(authorization)?.[1];
  if (!token) return challenge(config, 401, scope, true);
  try {
    const { payload } = await jwtVerify(token, getKeySet(config.issuer), {
      issuer: config.issuer,
      audience: config.resource,
      algorithms: ["RS256", "ES256", "EdDSA"],
      typ: "at+jwt",
      requiredClaims: ["sub", "exp", "iat", "scope"],
      maxTokenAge: 300
    });
    if (!payload.sub || typeof payload.scope !== "string" || !payload.exp || !payload.iat || payload.exp - payload.iat > 300) {
      return challenge(config, 401, scope, true);
    }
    const scopes = payload.scope.split(/\s+/);
    if (toolName && !scopes.includes(scope)) return challenge(config, 403, scope);
    return {
      env: { NLB_API_URL: config.apiUrl },
      oauth: { subject: payload.sub, scopes },
      fetch: delegatedFetch(config, payload.sub, payload.exp, scope)
    };
  } catch {
    return challenge(config, 401, scope, true);
  }
}
