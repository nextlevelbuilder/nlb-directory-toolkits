import { afterEach, describe, it, expect, vi } from "vitest";
import { McpServer } from "../src/server.js";
import { handleWorkerFetch } from "../src/transports/worker.js";
import { requiredToolScope } from "../src/tool-context.js";

const server = new McpServer();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ENV = { NLB_API_KEY: "nlb_live_server", NLB_API_URL: "https://staging.nextlevelbuilder.io" };
const AUTHED = { workerAuth: true, env: ENV };

const post = {
  id: "post_1", locale: "en", slug: "hello-world", title: "Hello world", description: null,
  blocks: [{ type: "hero", props: { heading: "Hi" } }], coverUrl: null, tags: [], seo: {},
  authorName: null, status: "draft", translationKey: null, publishedAt: null, version: 2,
  createdAt: "2026-10-13T00:00:00.000Z", updatedAt: "2026-10-13T00:00:00.000Z"
};
const createPayload = { locale: "en", slug: "hello-world", title: "Hello world", blocks: post.blocks };

function mockFetch(body: unknown, status = 200) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json(body, { status }));
}

function call(fetchFn: ReturnType<typeof mockFetch>, index = 0) {
  const [url, init] = fetchFn.mock.calls[index] as unknown as [string, RequestInit];
  return { url: new URL(url), init, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined };
}

async function callTool(name: string, args: Record<string, unknown>, context: Record<string, unknown> = AUTHED) {
  const res = await server.handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, context);
  const result = res?.result as { isError: boolean; content: { text: string }[] } | undefined;
  return { res, isError: result?.isError, payload: result ? JSON.parse(result.content[0].text) : undefined };
}

afterEach(() => vi.unstubAllGlobals());

const BLOG_TOOL_NAMES = [
  "blog_list_blocks", "blog_validate", "blog_list_posts", "blog_get_post", "blog_create_post", "blog_update_post",
  "blog_publish_post", "blog_unpublish_post", "blog_archive_post", "blog_list_revisions", "blog_restore_revision"
];

describe("MCP blog tools", () => {
  it("registers all 11 blog tools with schemas and agent guidance", () => {
    const names = server.listTools().map((t) => t.name);
    for (const name of BLOG_TOOL_NAMES) expect(names).toContain(name);
    expect(server.getTool("blog_list_blocks")!.description).toMatch(/before composing/i);
    expect(server.getTool("blog_update_post")!.inputSchema.required).toEqual(["post_id", "changes", "version"]);
    expect(server.getTool("blog_restore_revision")!.inputSchema.required).toEqual(["post_id", "revision_id", "version"]);
    expect(requiredToolScope("blog_create_post")).toBe("mcp:write");
    expect(requiredToolScope("blog_list_posts")).toBe("mcp:read");
  });

  it("lists blocks and validates via the server", async () => {
    const catalogue = { data: [{ type: "hero", title: "Hero", description: "Top", category: "section", propsSchema: {}, example: post.blocks[0] }] };
    const fetchFn = mockFetch(catalogue);
    vi.stubGlobal("fetch", fetchFn);
    expect((await callTool("blog_list_blocks", {})).payload).toEqual(catalogue);
    expect(call(fetchFn).url.toString()).toBe("https://staging.nextlevelbuilder.io/api/v1/blog/blocks");

    const validFetch = mockFetch({ data: { valid: true, errors: [] } });
    vi.stubGlobal("fetch", validFetch);
    expect((await callTool("blog_validate", { blocks: post.blocks })).payload.data.valid).toBe(true);
    expect(call(validFetch).body).toEqual({ blocks: post.blocks });
  });

  it("creates a post with the configured key and a random Idempotency-Key", async () => {
    const fetchFn = mockFetch({ data: { ...post, version: 1 } }, 201);
    vi.stubGlobal("fetch", fetchFn);
    const { isError, payload } = await callTool("blog_create_post", { post: createPayload });
    expect(isError).toBe(false);
    expect(payload.data.version).toBe(1);
    const c = call(fetchFn);
    expect(c.init.method).toBe("POST");
    expect(c.body).toEqual(createPayload);
    expect(c.headers).toMatchObject({ Authorization: "Bearer nlb_live_server" });
    expect(c.headers["Idempotency-Key"]).toMatch(UUID_RE);
  });

  it("reuses a caller-supplied idempotency key", async () => {
    const fetchFn = mockFetch({ data: post });
    vi.stubGlobal("fetch", fetchFn);
    await callTool("blog_publish_post", { post_id: "post_1", version: 2, idempotency_key: "retry-1" });
    expect(call(fetchFn).headers["Idempotency-Key"]).toBe("retry-1");
  });

  it("sends version on update, publish, unpublish, archive and restore", async () => {
    const fetchFn = mockFetch({ data: post });
    vi.stubGlobal("fetch", fetchFn);
    await callTool("blog_update_post", { post_id: "post_1", version: 2, changes: { title: "New" } });
    await callTool("blog_publish_post", { post_id: "post_1", version: 2 });
    await callTool("blog_unpublish_post", { post_id: "post_1", version: 2 });
    await callTool("blog_archive_post", { post_id: "post_1", version: 2 });
    await callTool("blog_restore_revision", { post_id: "post_1", revision_id: "rev_1", version: 2 });
    const calls = [0, 1, 2, 3, 4].map((i) => call(fetchFn, i));
    expect(calls.map((c) => `${c.init.method} ${c.url.pathname}${c.url.search}`)).toEqual([
      "PATCH /api/v1/blog/posts/post_1",
      "POST /api/v1/blog/posts/post_1/publish",
      "POST /api/v1/blog/posts/post_1/unpublish",
      "DELETE /api/v1/blog/posts/post_1?version=2",
      "POST /api/v1/blog/posts/post_1/revisions/rev_1/restore"
    ]);
    expect(calls[0].body).toEqual({ title: "New", version: 2 });
    for (const c of calls) expect(c.headers["Idempotency-Key"]).toMatch(UUID_RE);
  });

  it("requires version for versioned writes and rejects bad payloads before fetching", async () => {
    const fetchFn = mockFetch({ data: post });
    vi.stubGlobal("fetch", fetchFn);
    const missing = await callTool("blog_publish_post", { post_id: "post_1" });
    expect(missing.isError).toBe(true);
    expect(missing.payload.error).toContain("version");
    expect((await callTool("blog_update_post", { post_id: "post_1", version: 2, changes: { slug: "Bad Slug" } })).isError).toBe(true);
    expect((await callTool("blog_create_post", { post: { ...createPayload, blocks: Array(61).fill(post.blocks[0]) } })).isError).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns 409 conflicts with currentVersion as structured tool errors", async () => {
    vi.stubGlobal("fetch", mockFetch({ error: "Version conflict", currentVersion: 4 }, 409));
    const { isError, payload } = await callTool("blog_update_post", { post_id: "post_1", version: 2, changes: { title: "x" } });
    expect(isError).toBe(true);
    expect(payload).toMatchObject({ status: 409, currentVersion: 4 });
    expect(payload.error).toContain("current version is 4");
  });

  it("returns 400 validation details", async () => {
    const details = [{ path: "blocks.0.props.heading", message: "Required" }];
    vi.stubGlobal("fetch", mockFetch({ error: "Validation failed", details }, 400));
    const { payload } = await callTool("blog_create_post", { post: createPayload });
    expect(payload).toMatchObject({ status: 400, details });
  });

  it("lists posts with filters, gets a post and lists revisions", async () => {
    const { blocks: _b, ...summary } = post;
    const listFetch = mockFetch({ data: [summary], pagination: { limit: 10, offset: 0, count: 1 } });
    vi.stubGlobal("fetch", listFetch);
    await callTool("blog_list_posts", { locale: "vi", status: "draft", limit: 10 });
    expect(call(listFetch).url.search).toBe("?locale=vi&status=draft&limit=10");

    const getFetch = mockFetch({ data: post });
    vi.stubGlobal("fetch", getFetch);
    expect((await callTool("blog_get_post", { id_or_slug: "hello-world", locale: "en" })).payload.data.id).toBe("post_1");
    expect(`${call(getFetch).url.pathname}${call(getFetch).url.search}`).toBe("/api/v1/blog/posts/hello-world?locale=en");

    const revFetch = mockFetch({ data: [{ id: "rev_1", postId: "post_1", version: 2, note: null, actorId: null, createdAt: post.createdAt }] });
    vi.stubGlobal("fetch", revFetch);
    expect((await callTool("blog_list_revisions", { post_id: "post_1" })).payload.data).toHaveLength(1);
  });

  it("blocks anonymous Worker writes and private reads, and never lends the server key to anonymous reads", async () => {
    const fetchFn = mockFetch({ data: [], pagination: { limit: 20, offset: 0, count: 0 } });
    vi.stubGlobal("fetch", fetchFn);
    const anonymous = { workerAuth: false, env: ENV };
    expect((await callTool("blog_create_post", { post: createPayload }, anonymous)).res?.error?.code).toBe(-32001);
    expect((await callTool("blog_list_revisions", { post_id: "post_1" }, anonymous)).res?.error?.code).toBe(-32001);
    expect(fetchFn).not.toHaveBeenCalled();

    await callTool("blog_list_posts", { status: "draft" }, anonymous);
    expect(call(fetchFn).headers.Authorization).toBeUndefined();
    expect(call(fetchFn).headers["x-api-key"]).toBeUndefined();
  });

  it("rejects unauthenticated Worker HTTP writes before fetching", async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal("fetch", fetchFn);
    const body = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "blog_publish_post", arguments: { post_id: "p", version: 1 } } };
    const result = await handleWorkerFetch(new Request("https://worker.example/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), { NLB_API_KEY: "nlb_live_server" });
    expect((await result.json() as { error: { code: number } }).error.code).toBe(-32001);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
