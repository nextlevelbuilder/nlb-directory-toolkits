import { afterEach, describe, it, expect, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { createProgram } from "../src/cli.js";
import { NlbBlogClient, BlogApiError } from "../src/api/blog-client.js";

const BASE = "https://nextlevelbuilder.io";
const KEY = "nlb_live_blogtest";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const post = {
  id: "post_1", locale: "en", slug: "hello-world", title: "Hello world", description: null,
  blocks: [{ type: "hero", props: { heading: "Hi" } }], coverUrl: null, tags: ["news"], seo: {},
  authorName: null, status: "draft", translationKey: null, publishedAt: null, version: 3,
  createdAt: "2026-10-13T00:00:00.000Z", updatedAt: "2026-10-13T00:00:00.000Z"
};
const createPayload = { locale: "en", slug: "hello-world", title: "Hello world", blocks: post.blocks };

type FetchCall = [string, RequestInit];

function mockFetch(body: unknown, status = 200) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json(body, { status }));
}

function call(fetchFn: ReturnType<typeof mockFetch>, index = 0) {
  const [url, init] = fetchFn.mock.calls[index] as unknown as FetchCall;
  return { url: new URL(url), init, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined };
}

function tmpJson(value: unknown): string {
  const file = join(mkdtempSync(join(tmpdir(), "nlb-blog-")), "post.json");
  writeFileSync(file, JSON.stringify(value));
  return file;
}

async function run(args: string[], deps: { fetchFn: typeof fetch; stdin?: NodeJS.ReadableStream }) {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  await createProgram({ blog: deps }).parseAsync(["node", "nlb", "blog", ...args, "--api-key", KEY, "--url", BASE]);
  return { log, err, json: () => JSON.parse(String(log.mock.calls[0]?.[0])) };
}

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = 0;
});

describe("CLI blog commands", () => {
  it("lists the block catalogue with the API key", async () => {
    const catalogue = { data: [{ type: "hero", title: "Hero", description: "Top", category: "section", propsSchema: { type: "object" }, example: post.blocks[0] }] };
    const fetchFn = mockFetch(catalogue);
    const { json } = await run(["blocks", "--json"], { fetchFn });
    expect(json()).toEqual(catalogue);
    const c = call(fetchFn);
    expect(c.url.pathname).toBe("/api/v1/blog/blocks");
    expect(c.headers).toMatchObject({ Authorization: `Bearer ${KEY}` });
    expect(c.headers["Idempotency-Key"]).toBeUndefined();
  });

  it("creates a post from a file with an Idempotency-Key", async () => {
    const fetchFn = mockFetch({ data: { ...post, version: 1 } }, 201);
    const { json } = await run(["create", tmpJson(createPayload), "--json"], { fetchFn });
    expect(json().data.version).toBe(1);
    const c = call(fetchFn);
    expect(c.init.method).toBe("POST");
    expect(c.url.pathname).toBe("/api/v1/blog/posts");
    expect(c.body).toEqual(createPayload);
    expect(c.headers["Idempotency-Key"]).toMatch(UUID_RE);
  });

  it("reads the payload from stdin when the file is '-'", async () => {
    const fetchFn = mockFetch({ data: post }, 201);
    await run(["create", "-", "--json"], { fetchFn, stdin: Readable.from([Buffer.from(JSON.stringify(createPayload))]) });
    expect(call(fetchFn).body).toEqual(createPayload);
  });

  it("validates blocks via the server and exits non-zero when invalid", async () => {
    const fetchFn = mockFetch({ data: { valid: false, errors: [{ path: "blocks.0.props.heading", message: "Required" }] } });
    const { err } = await run(["validate", tmpJson(createPayload)], { fetchFn });
    expect(call(fetchFn).body).toEqual({ blocks: createPayload.blocks });
    expect(err.mock.calls.flat().join("\n")).toContain("blocks.0.props.heading: Required");
    expect(process.exitCode).toBe(1);
  });

  it("rejects structurally invalid payloads before any network call", async () => {
    const fetchFn = mockFetch({});
    const { json } = await run(["create", tmpJson({ ...createPayload, slug: "Bad Slug" }), "--json"], { fetchFn });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(json()).toMatchObject({ success: false, details: [expect.objectContaining({ path: "slug" })] });
    expect(process.exitCode).toBe(1);
  });

  it("sends --version with update, publish, unpublish, archive and restore", async () => {
    const fetchFn = mockFetch({ data: post });
    await run(["update", "post_1", tmpJson({ title: "New" }), "--version", "3", "--json"], { fetchFn });
    await run(["publish", "post_1", "--version", "3", "--json"], { fetchFn });
    await run(["unpublish", "post_1", "--version", "3", "--json"], { fetchFn });
    await run(["archive", "post_1", "--version", "3", "--json"], { fetchFn });
    await run(["restore", "post_1", "rev_9", "--version", "3", "--json"], { fetchFn });
    const calls = [0, 1, 2, 3, 4].map((i) => call(fetchFn, i));
    expect(calls.map((c) => `${c.init.method} ${c.url.pathname}${c.url.search}`)).toEqual([
      "PATCH /api/v1/blog/posts/post_1",
      "POST /api/v1/blog/posts/post_1/publish",
      "POST /api/v1/blog/posts/post_1/unpublish",
      "DELETE /api/v1/blog/posts/post_1?version=3",
      "POST /api/v1/blog/posts/post_1/revisions/rev_9/restore"
    ]);
    expect(calls[0].body).toEqual({ title: "New", version: 3 });
    expect(calls[1].body).toEqual({ version: 3 });
    for (const c of calls) expect(c.headers["Idempotency-Key"]).toMatch(UUID_RE);
    expect(new Set(calls.map((c) => c.headers["Idempotency-Key"])).size).toBe(5);
  });

  it("requires --version for versioned writes", async () => {
    const fetchFn = mockFetch({ data: post });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => { throw new Error(`exit ${code}`); }) as never);
    await expect(run(["publish", "post_1"], { fetchFn })).rejects.toThrow("exit 1");
    await expect(run(["archive", "post_1", "--version", "0"], { fetchFn })).rejects.toThrow("exit 1");
    expect(exit).toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("keeps the root --version flag working before subcommands", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const program = createProgram().exitOverride();
    await expect(program.parseAsync(["node", "nlb", "--version"])).rejects.toMatchObject({ code: "commander.version" });
    expect(write.mock.calls.flat().join("")).toContain("0.2.1");
  });

  it("surfaces 409 conflicts with currentVersion", async () => {
    const fetchFn = mockFetch({ error: "Version conflict", currentVersion: 5 }, 409);
    const { json } = await run(["publish", "post_1", "--version", "3", "--json"], { fetchFn });
    expect(json()).toMatchObject({ success: false, status: 409, currentVersion: 5, error: expect.stringContaining("current version is 5") });
    expect(process.exitCode).toBe(1);

    const human = await run(["publish", "post_1", "--version", "3"], { fetchFn });
    expect(human.err.mock.calls.flat().join("\n")).toContain("retry with --version 5");
  });

  it("surfaces 400 validation details", async () => {
    const details = [{ path: "blocks.0.type", message: "Unknown block type" }];
    const fetchFn = mockFetch({ error: "Validation failed", details }, 400);
    const { json } = await run(["create", tmpJson(createPayload), "--json"], { fetchFn });
    expect(json()).toMatchObject({ success: false, status: 400, details });
    expect(json().error).toContain("blocks.0.type: Unknown block type");
  });

  it("rejects an update whose payload version disagrees with --version", async () => {
    const fetchFn = mockFetch({ data: post });
    const { json } = await run(["update", "post_1", tmpJson({ version: 2, title: "x" }), "--version", "3", "--json"], { fetchFn });
    expect(json().error).toContain("does not match --version 3");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("lists posts with filters, gets by slug and lists revisions", async () => {
    const { blocks: _b, ...summary } = post;
    const listFetch = mockFetch({ data: [summary], pagination: { limit: 20, offset: 0, count: 1 } });
    const { log } = await run(["list", "--locale", "vi", "--status", "all", "--tag", "news"], { fetchFn: listFetch });
    const params = call(listFetch).url.searchParams;
    expect([params.get("locale"), params.get("status"), params.get("tag")]).toEqual(["vi", "all", "news"]);
    expect(log.mock.calls.flat().join("\n")).toContain("hello-world");

    const getFetch = mockFetch({ data: post });
    await run(["get", "hello-world", "--locale", "en", "--json"], { fetchFn: getFetch });
    expect(`${call(getFetch).url.pathname}${call(getFetch).url.search}`).toBe("/api/v1/blog/posts/hello-world?locale=en");

    const revFetch = mockFetch({ data: [{ id: "rev_1", postId: "post_1", version: 3, note: null, actorId: "u1", createdAt: post.createdAt }] });
    const revs = await run(["revisions", "post_1"], { fetchFn: revFetch });
    expect(revs.log.mock.calls.flat().join("\n")).toContain("v3  rev_1");
  });

  it("rejects an invalid status filter locally", async () => {
    const fetchFn = mockFetch({});
    const client = new NlbBlogClient({ baseUrl: BASE, fetchFn });
    await expect(client.listPosts({ status: "deleted" })).rejects.toThrow("Invalid list query");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("exposes BlogApiError fields to programmatic callers", async () => {
    const client = new NlbBlogClient({ baseUrl: BASE, apiKey: KEY, fetchFn: mockFetch({ error: "Version conflict", currentVersion: 7 }, 409) });
    const error = await client.archivePost("post_1", 6).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BlogApiError);
    expect((error as BlogApiError).currentVersion).toBe(7);
  });
});
