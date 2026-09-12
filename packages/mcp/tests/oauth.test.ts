import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { webcrypto } from "node:crypto";
import { exportJWK, generateKeyPair, jwtVerify, SignJWT } from "jose";
import { handleWorkerFetch, type WorkerEnv } from "../src/transports/worker.js";
import { authorizeOAuthMessage } from "../src/oauth.js";
import { requiredToolScope } from "../src/tool-context.js";

describe("MCP OAuth resource server", () => {
  let upstream: Server;
  let env: WorkerEnv;
  let issuer: string;
  let resource: string;
  let privateKey: CryptoKey;
  let upstreamRequests: Array<{ assertion?: string; authorization?: string; cookie?: string; path?: string; body: string; contentType?: string }> = [];
  const secret = "local-test-delegation-secret-at-least-32-bytes";

  beforeAll(async () => {
    // Workers expose Web Crypto globally; Node 18 test runners need the real Node implementation.
    if (!globalThis.crypto) vi.stubGlobal("crypto", webcrypto);
    const keys = await generateKeyPair("RS256");
    privateKey = keys.privateKey;
    const jwk = { ...await exportJWK(keys.publicKey), kid: "test-key", alg: "RS256", use: "sig" };
    upstream = createServer(async (req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/api/auth/jwks") {
        res.end(JSON.stringify({ keys: [jwk] }));
      } else {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        upstreamRequests.push({
          assertion: req.headers["x-nlb-mcp-assertion"] as string | undefined,
          authorization: req.headers.authorization,
          cookie: req.headers.cookie,
          path: req.url,
          body: Buffer.concat(chunks).toString("utf8"),
          contentType: req.headers["content-type"]
        });
        if (req.url === "/api/redirect") {
          res.writeHead(302, { Location: "/api/redirect-target" }).end();
        } else if (req.url?.startsWith("/api/v1/products/test-product/traffic")) {
          res.end(JSON.stringify({ data: {
            source: "clickhouse", from: "2026-08-01T00:00:00Z", to: "2026-08-31T00:00:00Z",
            updatedAt: "2026-08-31T00:00:00Z", pageViews: 12, visitors: 8, outboundClicks: 3, activeVisitors: 1,
            series: [], referrers: [], countries: [], devices: []
          } }));
        } else {
          res.end(JSON.stringify({ success: true, data: [] }));
        }
      }
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    const address = upstream.address();
    if (!address || typeof address === "string") throw new Error("Missing test listener");
    const api = `http://127.0.0.1:${address.port}`;
    issuer = `${api}/api/auth`;
    resource = `${api}/mcp`;
    env = { NLB_OAUTH_ENABLED: "true", NLB_OAUTH_ISSUER: issuer, NLB_OAUTH_RESOURCE: resource,
      NLB_API_URL: api, MCP_DELEGATION_SECRET: secret, WORKER_AUTH_TOKEN: "legacy-token" };
  });

  afterAll(async () => {
    if (upstream) {
      upstream.closeAllConnections();
      await new Promise<void>((resolve, reject) => upstream.close((error) => error ? reject(error) : resolve()));
    }
    vi.unstubAllGlobals();
  });

  async function token(claims: Record<string, unknown> = {}, signingKey = privateKey) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ sub: "user-1", iss: issuer, aud: resource, iat: now, exp: now + 300,
      scope: "mcp:read mcp:write mcp:keys", ...claims })
      .setProtectedHeader({ alg: "RS256", kid: "test-key", typ: "at+jwt" }).sign(signingKey);
  }

  function call(name: string, authorization?: string, args: Record<string, unknown> = {}, config = env) {
    return handleWorkerFetch(new Request(`${resource}`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } })
    }), config);
  }

  it("serves discovery at both resource metadata locations and exposes challenges to browsers", async () => {
    for (const path of ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"]) {
      const res = await handleWorkerFetch(new Request(new URL(path, resource)), env);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ resource, authorization_servers: [issuer], scopes_supported: expect.arrayContaining(["mcp:write", "offline_access"]) });
    }
    const res = await call("submit_product");
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("oauth-protected-resource/mcp");
    expect(res.headers.get("WWW-Authenticate")).toContain("mcp:write");
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain("WWW-Authenticate");
  });

  it("keeps public reads and static-token callers compatible", async () => {
    expect((await call("list_templates")).status).toBe(200);
    const legacy = await call("submit_product", "legacy-token");
    expect(legacy.status).toBe(200);
    expect((await legacy.json()).result.isError).toBe(true);
    const disabled = await call("submit_product", undefined, {}, { ...env, NLB_OAUTH_ENABLED: "false" });
    expect(disabled.status).toBe(200);
    expect((await disabled.json()).error.code).toBe(-32001);
  });

  it("uses a separate short-lived request-bound assertion without forwarding the OAuth token", async () => {
    upstreamRequests = [];
    const bearer = await token();
    const res = await call("list_api_keys", bearer);
    expect(res.status).toBe(200);
    expect((await res.json()).result.isError).toBe(false);
    expect(upstreamRequests).toHaveLength(1);
    const sent = upstreamRequests[0];
    expect(sent.authorization).toBeUndefined();
    expect(sent.cookie).toBeUndefined();
    expect(sent.assertion).not.toBe(bearer);
    const verified = await jwtVerify(sent.assertion!, new TextEncoder().encode(secret), {
      algorithms: ["HS256"], issuer: resource, audience: `${env.NLB_API_URL}/api`, typ: "nlb-mcp-delegation+jwt"
    });
    expect(verified.payload).toMatchObject({ sub: "user-1", scope: "mcp:keys", method: "GET", path: "/api/v1/api-keys" });
    expect(verified.payload.exp! - verified.payload.iat!).toBeLessThanOrEqual(60);
    expect(verified.payload.jti).toBeTruthy();
  });

  it("rejects insufficient scope without leaking identity into a later anonymous request", async () => {
    expect((await call("list_api_keys", await token({ scope: "mcp:write" }))).status).toBe(403);
    expect((await call("submit_product", await token({ scope: "mcp:read" }))).status).toBe(403);
    expect((await call("submit_product", await token())).status).toBe(200);
    expect((await call("submit_product")).status).toBe(401);
  });

  it("requires mcp:read for private traffic and signs its request without forwarding credentials", async () => {
    expect(requiredToolScope("get_product_traffic")).toBe("mcp:read");
    upstreamRequests = [];
    const anonymous = await call("get_product_traffic", undefined, { slug: "test-product" });
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get("WWW-Authenticate")).toContain("mcp:read");
    expect((await call("get_product_traffic", await token({ scope: "mcp:write" }), { slug: "test-product" })).status).toBe(403);
    expect(upstreamRequests).toHaveLength(0);

    const bearer = await token({ scope: "mcp:read" });
    const result = await call("get_product_traffic", bearer, {
      slug: "test-product", from: "2026-08-01T00:00:00Z", to: "2026-08-31T00:00:00Z"
    }, { ...env, NLB_API_KEY: "nlb_live_shared_key_must_not_be_used" });
    expect(result.status).toBe(200);
    const payload = await result.json();
    expect(payload.result.isError).toBe(false);
    expect(JSON.parse(payload.result.content[0].text).data.pageViews).toBe(12);
    expect(upstreamRequests).toHaveLength(1);
    const sent = upstreamRequests[0];
    expect(sent.authorization).toBeUndefined();
    expect(sent.cookie).toBeUndefined();
    expect(sent.assertion).not.toBe(bearer);
    const { payload: assertion } = await jwtVerify(sent.assertion!, new TextEncoder().encode(secret), {
      algorithms: ["HS256"], issuer: resource, audience: `${env.NLB_API_URL}/api`, typ: "nlb-mcp-delegation+jwt"
    });
    expect(assertion).toMatchObject({ sub: "user-1", scope: "mcp:read", method: "GET", path: "/api/v1/products/test-product/traffic" });
    expect((await call("get_product_traffic", undefined, { slug: "test-product" })).status).toBe(401);
    for (const args of [{ api_key: "another-account" }, { api_url: "https://staging.nextlevelbuilder.io" }]) {
      const denied = await call("get_product_traffic", bearer, { slug: "test-product", ...args });
      expect((await denied.json()).result.isError).toBe(true);
    }
    expect(upstreamRequests).toHaveLength(1);
  });

  it("preserves JSON and multipart bodies through delegated POST requests", async () => {
    upstreamRequests = [];
    const bearer = await token();
    const keyResult = await call("create_api_key", bearer, { name: "integration-test" });
    expect((await keyResult.json()).result.isError).toBe(false);
    const upload = await call("upload_media", bearer, { filename: "test.svg", mime_type: "image/svg+xml", file_base64: btoa('<svg xmlns="http://www.w3.org/2000/svg"/>') });
    expect((await upload.json()).result.isError).toBe(false);
    expect(upstreamRequests).toHaveLength(2);
    expect(JSON.parse(upstreamRequests[0].body)).toMatchObject({ name: "integration-test" });
    expect(upstreamRequests[1].contentType).toContain("multipart/form-data; boundary=");
    expect(upstreamRequests[1].body).toContain('filename="test.svg"');
    expect(upstreamRequests[1].body).toContain('<svg xmlns="http://www.w3.org/2000/svg"/>');
    for (const [index, scope] of ["mcp:keys", "mcp:write"].entries()) {
      const { payload } = await jwtVerify(upstreamRequests[index].assertion!, new TextEncoder().encode(secret));
      expect(payload.method).toBe("POST");
      expect(payload.scope).toBe(scope);
    }
  });

  it("rejects expired, foreign, future, overlong and incomplete tokens", async () => {
    const now = Math.floor(Date.now() / 1000);
    for (const claims of [
      { exp: now - 1 }, { aud: "https://other.example/mcp" }, { iss: "https://other.example/auth" },
      { iat: now + 60, exp: now + 300 }, { exp: now + 301 }, { sub: "" }, { scope: undefined }
    ]) {
      expect((await call("list_templates", await token(claims))).status).toBe(401);
    }
    const other = await generateKeyPair("RS256");
    expect((await call("list_templates", await token({}, other.privateKey))).status).toBe(401);
    expect((await call("list_templates", "not-a-jwt")).status).toBe(401);
  });

  it("rejects credential and upstream overrides before making an API call", async () => {
    upstreamRequests = [];
    for (const args of [{ api_key: "another-account" }, { session_cookie: "another-session" }, { api_url: "https://staging.nextlevelbuilder.io" }]) {
      const res = await call("list_api_keys", await token(), args);
      expect((await res.json()).result).toMatchObject({ isError: true });
    }
    expect(upstreamRequests).toHaveLength(0);
  });

  it("uses Workers-supported manual redirects and rejects redirects or another API", async () => {
    const context = await authorizeOAuthMessage(new Request(resource, { headers: { Authorization: `Bearer ${await token()}` } }),
      { method: "tools/call", params: { name: "submit_product" } }, env, { workerAuth: false });
    if (context instanceof Response || !context.fetch) throw new Error("Expected authenticated context");
    upstreamRequests = [];
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      await expect(context.fetch(`${env.NLB_API_URL}/api/redirect`)).rejects.toThrow("OAuth API redirects are not allowed");
      // Node accepts redirect:error, but the deployed Workers runtime rejects that mode.
      expect((fetchSpy.mock.calls[0][0] as Request).redirect).toBe("manual");
    } finally {
      fetchSpy.mockRestore();
    }
    expect(upstreamRequests.map((r) => r.path)).toEqual(["/api/redirect"]);
    await expect(context.fetch("https://untrusted.example/api/private")).rejects.toThrow("configured NLB API");
  });

  it("fails closed on incomplete OAuth configuration", async () => {
    expect((await call("submit_product", undefined, {}, { ...env, MCP_DELEGATION_SECRET: undefined })).status).toBe(503);
  });
});
