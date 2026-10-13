import { readFile } from "node:fs/promises";
import { Command, InvalidArgumentError } from "commander";
import pc from "picocolors";
import type { BlogPost, BlogPostSummary } from "@nextlevelbuilder/contracts";
import { resolveConfig } from "../config.js";
import { BlogApiError, BlogInputError, NlbBlogClient } from "../api/blog-client.js";
import { sanitizeTerminalText as safe } from "../preview/ascii.js";

export interface BlogCommonOptions {
  apiKey?: string;
  url?: string;
  json?: boolean;
}

export interface BlogListOptions extends BlogCommonOptions {
  locale?: string;
  status?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

export interface BlogVersionedOptions extends BlogCommonOptions {
  version: number;
}

/** Injection points for tests and embedding; defaults are the real process streams and global fetch. */
export interface BlogCommandDeps {
  stdin?: NodeJS.ReadableStream;
  fetchFn?: typeof fetch;
}

/** Reads a JSON document from a file path, or from stdin when `file` is `-`. */
export async function readJsonInput(file: string, stdin: NodeJS.ReadableStream = process.stdin): Promise<unknown> {
  let raw: string;
  if (file === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of stdin) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array));
    }
    raw = Buffer.concat(chunks).toString("utf-8");
    if (!raw.trim()) throw new Error("No JSON received on stdin");
  } else {
    try {
      raw = await readFile(file, "utf-8");
    } catch (err) {
      throw new Error(`Cannot read ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${file === "-" ? "stdin" : file}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Commander parser for `--version N` (the post's current optimistic-concurrency version). */
export function parseVersionOption(value: string): number {
  const n = Number(value);
  if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(n) || n < 1) {
    throw new InvalidArgumentError("version must be a positive integer (the post's current version)");
  }
  return n;
}

function parseNonNegativeInt(value: string): number {
  if (!/^\d+$/.test(value.trim())) throw new InvalidArgumentError("must be a non-negative integer");
  return Number(value);
}

function createClient(opts: BlogCommonOptions, deps: BlogCommandDeps): NlbBlogClient {
  const config = resolveConfig(opts);
  return new NlbBlogClient({ baseUrl: config.apiUrl, apiKey: config.apiKey, fetchFn: deps.fetchFn });
}

function reportFailure(err: unknown, opts: BlogCommonOptions): void {
  const message = err instanceof Error ? err.message : String(err);
  if (opts.json) {
    const payload: Record<string, unknown> = { success: false, error: message };
    if (err instanceof BlogApiError) {
      payload.status = err.status;
      if (err.currentVersion !== undefined) payload.currentVersion = err.currentVersion;
      if (err.details !== undefined) payload.details = err.details;
    } else if (err instanceof BlogInputError) {
      payload.details = err.issues;
    }
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.error(pc.red(`✖ ${safe(message)}`));
    if (err instanceof BlogApiError && err.status === 409 && err.currentVersion !== undefined) {
      console.error(pc.yellow(`  Current version is ${err.currentVersion}. Re-fetch with 'nlb blog get' and retry with --version ${err.currentVersion}.`));
    }
    if (err instanceof BlogApiError && (err.status === 401 || err.status === 403)) {
      console.error(pc.dim("  Blog management requires an admin account API key (--api-key, NLB_API_KEY, or 'nlb config set api-key')."));
    }
  }
  process.exitCode = 1;
}

/** Runs one blog action: resolves the client, prints JSON or human output, and maps failures to exit code 1. */
async function runBlogAction<T>(
  opts: BlogCommonOptions,
  deps: BlogCommandDeps,
  action: (client: NlbBlogClient) => Promise<T>,
  render: (result: T) => void
): Promise<void> {
  try {
    const result = await action(createClient(opts, deps));
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else render(result);
  } catch (err) {
    reportFailure(err, opts);
  }
}

function postLine(post: BlogPostSummary): string {
  return `${safe(post.id)}  ${post.locale}  ${safe(post.slug)}  ${post.status}  v${post.version}  ${safe(post.title)}`;
}

function renderPostResult(verb: string) {
  return ({ data }: { data: BlogPost }) => {
    console.log(pc.green(`✔ ${verb} ${safe(data.locale)}/${safe(data.slug)} (id ${safe(data.id)})`));
    console.log(`  status: ${data.status} | version: ${data.version} | blocks: ${data.blocks.length}${data.publishedAt ? ` | publishedAt: ${safe(data.publishedAt)}` : ""}`);
  };
}

function withCommonOptions(cmd: Command): Command {
  return cmd
    .option("-k, --api-key <key>", "NextLevelBuilder admin API key (or NLB_API_KEY)")
    .option("-u, --url <url>", "Directory API base URL")
    .option("--json", "Output the API response (or error) as JSON");
}

const VERSION_HELP = "Current post version (optimistic concurrency; a stale version returns 409 with currentVersion)";

export function registerBlogCommands(program: Command, deps: BlogCommandDeps = {}): Command {
  const blog = program
    .command("blog")
    .description("Manage NLB blog posts (admin): block catalogue, validation, drafts, publishing, and revisions");

  withCommonOptions(blog.command("blocks").description("List the blog block catalogue (types, props JSON Schema, examples)"))
    .action(async (opts: BlogCommonOptions) => {
      await runBlogAction(opts, deps, (c) => c.listBlocks(), ({ data }) => {
        console.log(pc.cyan(`\n${data.length} blog block types (use --json for props schemas and examples):\n`));
        for (const def of data) console.log(`  ${pc.bold(safe(def.type))} [${def.category}] ${safe(def.title)} — ${safe(def.description)}`);
        console.log("");
      });
    });

  withCommonOptions(blog.command("validate").description("Validate blocks server-side against the block catalogue"))
    .argument("<file>", "JSON file with { blocks } or a full post payload ('-' for stdin)")
    .action(async (file: string, opts: BlogCommonOptions) => {
      await runBlogAction(opts, deps, async (c) => {
        const input = await readJsonInput(file, deps.stdin);
        const blocks = input && typeof input === "object" ? (input as { blocks?: unknown }).blocks : undefined;
        const result = await c.validate({ blocks });
        if (!result.data.valid) process.exitCode = 1;
        return result;
      }, ({ data }) => {
        if (data.valid) {
          console.log(pc.green("✔ Blocks are valid"));
          return;
        }
        console.error(pc.red(`✖ ${data.errors.length} validation error(s):`));
        for (const e of data.errors) console.error(`  ${safe(Array.isArray(e.path) ? e.path.join(".") : e.path)}: ${safe(e.message)}`);
      });
    });

  withCommonOptions(blog.command("list").description("List blog posts (published by default; admin key for draft/archived/all)"))
    .option("--locale <locale>", "Filter by locale (en, vi)")
    .option("--status <status>", "Filter by status (draft, published, archived, all)")
    .option("--tag <tag>", "Filter by tag")
    .option("-l, --limit <n>", "Page size", parseNonNegativeInt)
    .option("--offset <n>", "Pagination offset", parseNonNegativeInt)
    .action(async (opts: BlogListOptions) => {
      const query = { locale: opts.locale, status: opts.status, tag: opts.tag, limit: opts.limit, offset: opts.offset };
      await runBlogAction(opts, deps, (c) => c.listPosts(query), ({ data, pagination }) => {
        if (data.length === 0) console.log(pc.yellow("No blog posts found."));
        for (const post of data) console.log(postLine(post));
        console.log(pc.dim(`\nshowing ${data.length} (offset ${pagination.offset}, limit ${pagination.limit}, total ${pagination.count})`));
      });
    });

  withCommonOptions(blog.command("get").description("Get a blog post by id or slug"))
    .argument("<idOrSlug>", "Post id or slug")
    .option("--locale <locale>", "Locale for slug lookup (en, vi)")
    .action(async (idOrSlug: string, opts: BlogCommonOptions & { locale?: string }) => {
      await runBlogAction(opts, deps, (c) => c.getPost(idOrSlug, opts.locale), ({ data }) => {
        console.log(pc.cyan(`\n${safe(data.title)}`));
        console.log(postLine(data));
        if (data.description) console.log(safe(data.description));
        console.log(`tags: ${data.tags.map(safe).join(", ") || "-"} | publishedAt: ${safe(data.publishedAt ?? "-")} | updatedAt: ${safe(data.updatedAt)}`);
        console.log(`blocks (${data.blocks.length}): ${data.blocks.map((b) => safe(b.type)).join(", ")}\n`);
      });
    });

  withCommonOptions(blog.command("create").description("Create a draft post from a JSON payload"))
    .argument("<file>", "Post JSON { locale, slug, title, blocks, ... } ('-' for stdin)")
    .action(async (file: string, opts: BlogCommonOptions) => {
      await runBlogAction(opts, deps, async (c) => c.createPost(await readJsonInput(file, deps.stdin)), renderPostResult("Created draft"));
    });

  withCommonOptions(blog.command("update").description("Update a post with a partial JSON payload"))
    .argument("<id>", "Post id")
    .argument("<file>", "JSON with the fields to change ('-' for stdin)")
    .requiredOption("--version <n>", VERSION_HELP, parseVersionOption)
    .action(async (id: string, file: string, opts: BlogVersionedOptions) => {
      await runBlogAction(opts, deps, async (c) => {
        const input = await readJsonInput(file, deps.stdin);
        if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Update payload must be a JSON object");
        const fileVersion = (input as { version?: unknown }).version;
        if (fileVersion !== undefined && fileVersion !== opts.version) {
          throw new Error(`Payload version (${String(fileVersion)}) does not match --version ${opts.version}`);
        }
        return c.updatePost(id, { ...(input as Record<string, unknown>), version: opts.version });
      }, renderPostResult("Updated"));
    });

  for (const [name, verb] of [["publish", "Published"], ["unpublish", "Unpublished"]] as const) {
    withCommonOptions(blog.command(name).description(name === "publish" ? "Publish a post" : "Return a published post to draft"))
      .argument("<id>", "Post id")
      .requiredOption("--version <n>", VERSION_HELP, parseVersionOption)
      .action(async (id: string, opts: BlogVersionedOptions) => {
        await runBlogAction(opts, deps, (c) => (name === "publish" ? c.publishPost(id, opts.version) : c.unpublishPost(id, opts.version)), renderPostResult(verb));
      });
  }

  withCommonOptions(blog.command("archive").description("Archive a post (soft delete)"))
    .argument("<id>", "Post id")
    .requiredOption("--version <n>", VERSION_HELP, parseVersionOption)
    .action(async (id: string, opts: BlogVersionedOptions) => {
      await runBlogAction(opts, deps, (c) => c.archivePost(id, opts.version), renderPostResult("Archived"));
    });

  withCommonOptions(blog.command("revisions").description("List a post's revisions (newest first)"))
    .argument("<id>", "Post id")
    .action(async (id: string, opts: BlogCommonOptions) => {
      await runBlogAction(opts, deps, (c) => c.listRevisions(id), ({ data }) => {
        if (data.length === 0) console.log(pc.yellow("No revisions found."));
        for (const rev of data) console.log(`v${rev.version}  ${safe(rev.id)}  ${safe(rev.createdAt)}  ${safe(rev.note ?? "")}`);
      });
    });

  withCommonOptions(blog.command("restore").description("Restore a revision's content as a new version (status unchanged)"))
    .argument("<id>", "Post id")
    .argument("<revisionId>", "Revision id to restore")
    .requiredOption("--version <n>", VERSION_HELP, parseVersionOption)
    .action(async (id: string, revisionId: string, opts: BlogVersionedOptions) => {
      await runBlogAction(opts, deps, (c) => c.restoreRevision(id, revisionId, opts.version), renderPostResult("Restored revision into"));
    });

  return blog;
}
