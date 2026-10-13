import { z, type ZodType, type ZodTypeDef } from "zod";
import {
  BLOG_LIMITS,
  BLOG_LOCALES,
  BLOG_STATUSES,
  BlogBlockCatalogueResponseSchema,
  BlogBlocksSchema,
  BlogLocaleSchema,
  BlogPostCreateInputSchema,
  BlogPostListQuerySchema,
  BlogPostListResponseSchema,
  BlogPostResponseSchema,
  BlogPostUpdateInputSchema,
  BlogRevisionListResponseSchema,
  BlogValidateResponseSchema,
  BlogVersionSchema,
  describeBlogApiFailure
} from "@nextlevelbuilder/contracts";
import { ToolError, type ToolContext } from "../tool-context.js";
import type { McpToolDefinition, resolveToolEnv } from "./index.js";

type ResolveToolEnv = typeof resolveToolEnv;

// --- Shared helpers ---

const credentialArgs = {
  api_key: z.string().optional(),
  api_url: z.string().optional(),
};

const credentialProps = {
  api_key: { type: "string", description: "NLB admin API key; otherwise uses the configured NLB_API_KEY (ignored for OAuth calls)" },
  api_url: { type: "string", description: "Allowed directory API endpoint (optional)" }
};

const idempotencyArg = z.string().min(1).max(BLOG_LIMITS.idempotencyKeyMaxLength).optional();
const idempotencyProp = {
  type: "string",
  maxLength: BLOG_LIMITS.idempotencyKeyMaxLength,
  description: "Optional Idempotency-Key. Reuse the same key when retrying the same write so it is applied once; a random UUID is used when omitted."
};

const versionProp = {
  type: "integer",
  minimum: 1,
  description: "The post's current version (from blog_get_post). A stale version fails with HTTP 409 and returns currentVersion; re-read the post and retry."
};

const postIdProp = { type: "string", minLength: 1, description: "Post id (not slug)" };

function parseArgs<T>(schema: ZodType<T, ZodTypeDef, unknown>, args: unknown, tool: string): T {
  const result = schema.safeParse(args);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    throw new ToolError(
      `Invalid arguments for ${tool}: ${details.map((d) => (d.path ? `${d.path}: ${d.message}` : d.message)).join("; ")}`,
      { details }
    );
  }
  return result.data;
}

/**
 * Resolves endpoint and credentials. Unauthenticated Worker callers never borrow the server's
 * configured API key, so anonymous reads only ever see public (published) posts.
 */
function resolveBlogEnv(resolveEnv: ResolveToolEnv, args: { api_key?: string; api_url?: string }, context?: ToolContext): { apiUrl: string; apiKey?: string } {
  const env = resolveEnv(args, context);
  const anonymousWorker = context !== undefined && !context.oauth && context.workerAuth !== true;
  if (anonymousWorker && !args.api_key?.trim()) return { apiUrl: env.apiUrl };
  return env;
}

interface BlogCall<T> {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  /** Write calls send an Idempotency-Key (caller-supplied or random). */
  idempotencyKey?: string | true;
  schema: ZodType<T, ZodTypeDef, unknown>;
}

async function blogRequest<T>(
  resolveEnv: ResolveToolEnv,
  args: { api_key?: string; api_url?: string },
  context: ToolContext | undefined,
  call: BlogCall<T>
): Promise<T> {
  const { apiUrl, apiKey } = resolveBlogEnv(resolveEnv, args, context);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["x-api-key"] = apiKey;
  }
  if (call.body !== undefined) headers["Content-Type"] = "application/json";
  if (call.idempotencyKey) {
    headers["Idempotency-Key"] = call.idempotencyKey === true ? crypto.randomUUID() : call.idempotencyKey;
  }

  const response = await (context?.fetch ?? fetch)(`${apiUrl}${call.path}`, {
    method: call.method,
    headers,
    body: call.body !== undefined ? JSON.stringify(call.body) : undefined,
    signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  if (!response.ok) {
    const failure = describeBlogApiFailure(response.status, text, response.statusText);
    const data: Record<string, unknown> = { status: failure.status };
    if (failure.currentVersion !== undefined) data.currentVersion = failure.currentVersion;
    if (failure.details !== undefined) data.details = failure.details;
    if (response.status === 401 || response.status === 403) {
      data.hint = context?.oauth
        ? "The NLB API rejected this OAuth identity; blog management requires an admin account."
        : "Blog management requires an admin account API key (api_key or NLB_API_KEY).";
    }
    throw new ToolError(`Blog API error (${failure.message})`, data);
  }
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Blog API returned non-JSON response for ${call.path}`);
  }
  const parsed = call.schema.safeParse(json);
  if (!parsed.success) throw new Error(`Blog API response schema mismatch for ${call.path}: ${parsed.error.message}`);
  return parsed.data;
}

const enc = encodeURIComponent;

// --- Tool argument schemas ---

const ListBlocksArgs = z.object(credentialArgs);
const ValidateArgs = z.object({ blocks: BlogBlocksSchema, ...credentialArgs });
const ListPostsArgs = BlogPostListQuerySchema.extend(credentialArgs);
const GetPostArgs = z.object({ id_or_slug: z.string().min(1), locale: BlogLocaleSchema.optional(), ...credentialArgs });
const CreatePostArgs = z.object({ post: BlogPostCreateInputSchema, idempotency_key: idempotencyArg, ...credentialArgs });
const UpdatePostArgs = z.object({
  post_id: z.string().min(1),
  version: BlogVersionSchema,
  changes: z.record(z.unknown()),
  idempotency_key: idempotencyArg,
  ...credentialArgs
});
const VersionedPostArgs = z.object({ post_id: z.string().min(1), version: BlogVersionSchema, idempotency_key: idempotencyArg, ...credentialArgs });
const ListRevisionsArgs = z.object({ post_id: z.string().min(1), ...credentialArgs });
const RestoreRevisionArgs = VersionedPostArgs.extend({ revision_id: z.string().min(1) });

// --- JSON Schemas advertised to agents ---

const blockJsonSchema = {
  type: "object",
  required: ["type", "props"],
  properties: {
    type: { type: "string", description: "Block type from blog_list_blocks" },
    props: { type: "object", description: "Props matching that block's propsSchema" },
    id: { type: "string", description: "Optional stable block id" }
  }
};

const blocksJsonSchema = {
  type: "array",
  maxItems: BLOG_LIMITS.maxBlocks,
  items: blockJsonSchema,
  description: `Ordered content blocks (max ${BLOG_LIMITS.maxBlocks}, serialized ≤ 200 KB). Compose with types from blog_list_blocks.`
};

const postFieldsJsonSchema = {
  locale: { type: "string", enum: [...BLOG_LOCALES] },
  slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$", maxLength: BLOG_LIMITS.slugMaxLength, description: "Unique per locale" },
  title: { type: "string", maxLength: BLOG_LIMITS.titleMaxLength },
  description: { type: ["string", "null"], maxLength: BLOG_LIMITS.descriptionMaxLength },
  blocks: blocksJsonSchema,
  coverUrl: { type: ["string", "null"] },
  tags: { type: "array", maxItems: BLOG_LIMITS.maxTags, items: { type: "string", maxLength: BLOG_LIMITS.tagMaxLength } },
  seo: {
    type: "object",
    properties: {
      title: { type: "string" }, description: { type: "string" }, ogImage: { type: "string" },
      canonical: { type: "string" }, noindex: { type: "boolean" }
    }
  },
  translationKey: { type: ["string", "null"], description: "Shared key linking en/vi translations of the same post" },
  authorName: { type: ["string", "null"] }
};

const versionedInputSchema = (extra: Record<string, unknown> = {}, required: string[] = []) => ({
  type: "object" as const,
  properties: { post_id: postIdProp, ...extra, version: versionProp, idempotency_key: idempotencyProp, ...credentialProps },
  required: ["post_id", ...required, "version"]
});

const postResponse = BlogPostResponseSchema;

/**
 * Builds the blog management tools. The endpoint/credential resolver is injected by the tool
 * registry so this module does not import it back (avoids a circular module dependency).
 */
export function createBlogTools(resolveEnv: ResolveToolEnv): McpToolDefinition[] {
  const request = <T>(args: { api_key?: string; api_url?: string }, context: ToolContext | undefined, call: BlogCall<T>) =>
    blogRequest(resolveEnv, args, context, call);

  return [
    {
      name: "blog_list_blocks",
      description: "List the NLB blog block catalogue: every block type with title, description, category (section or primitive), props JSON Schema and an example block. ALWAYS call this before composing or editing a post, and build `blocks` only from these types and props schemas. Public; no auth required.",
      inputSchema: { type: "object", properties: { ...credentialProps } },
      handler: async (args, context) => {
        const a = parseArgs(ListBlocksArgs, args, "blog_list_blocks");
        return request(a, context, { method: "GET", path: "/api/v1/blog/blocks", schema: BlogBlockCatalogueResponseSchema });
      }
    },
    {
      name: "blog_validate",
      description: "Validate a blog `blocks` array server-side against the block catalogue without saving anything. Returns { data: { valid, errors: [{ path, message }] } }. Use it before blog_create_post / blog_update_post and fix every error by its path. Public; no auth required.",
      inputSchema: { type: "object", properties: { blocks: blocksJsonSchema, ...credentialProps }, required: ["blocks"] },
      handler: async (args, context) => {
        const a = parseArgs(ValidateArgs, args, "blog_validate");
        return request(a, context, { method: "POST", path: "/api/v1/blog/validate", body: { blocks: a.blocks }, schema: BlogValidateResponseSchema });
      }
    },
    {
      name: "blog_list_posts",
      description: "List blog post summaries (no blocks) with pagination. Anonymous callers see published posts only; status draft, archived or all requires an admin identity (OAuth mcp:read or admin API key).",
      inputSchema: {
        type: "object",
        properties: {
          locale: { type: "string", enum: [...BLOG_LOCALES] },
          status: { type: "string", enum: [...BLOG_STATUSES, "all"], description: "Default published" },
          tag: { type: "string" },
          limit: { type: "integer", minimum: 1 },
          offset: { type: "integer", minimum: 0 },
          ...credentialProps
        }
      },
      handler: async (args, context) => {
        const a = parseArgs(ListPostsArgs, args, "blog_list_posts");
        const params = new URLSearchParams();
        for (const key of ["locale", "status", "tag", "limit", "offset"] as const) {
          if (a[key] !== undefined) params.set(key, String(a[key]));
        }
        const search = params.size ? `?${params.toString()}` : "";
        return request(a, context, { method: "GET", path: `/api/v1/blog/posts${search}`, schema: BlogPostListResponseSchema });
      }
    },
    {
      name: "blog_get_post",
      description: "Get one blog post with its blocks and current `version` (needed for every write). Look up by id, or by slug plus locale. Drafts and archived posts require an admin identity.",
      inputSchema: {
        type: "object",
        properties: {
          id_or_slug: { type: "string", minLength: 1, description: "Post id or slug" },
          locale: { type: "string", enum: [...BLOG_LOCALES], description: "Locale for slug lookup (default en)" },
          ...credentialProps
        },
        required: ["id_or_slug"]
      },
      handler: async (args, context) => {
        const a = parseArgs(GetPostArgs, args, "blog_get_post");
        const search = a.locale ? `?locale=${enc(a.locale)}` : "";
        return request(a, context, { method: "GET", path: `/api/v1/blog/posts/${enc(a.id_or_slug)}${search}`, schema: postResponse });
      }
    },
    {
      name: "blog_create_post",
      description: "Create a blog post as a draft (version 1). Call blog_list_blocks first and blog_validate on the blocks. Fails with 409 if (locale, slug) already exists. Requires an admin identity (OAuth mcp:write or admin API key). Publish separately with blog_publish_post.",
      inputSchema: {
        type: "object",
        properties: {
          post: { type: "object", required: ["locale", "slug", "title", "blocks"], properties: postFieldsJsonSchema, additionalProperties: false },
          idempotency_key: idempotencyProp,
          ...credentialProps
        },
        required: ["post"]
      },
      handler: async (args, context) => {
        const a = parseArgs(CreatePostArgs, args, "blog_create_post");
        return request(a, context, { method: "POST", path: "/api/v1/blog/posts", body: a.post, idempotencyKey: a.idempotency_key ?? true, schema: postResponse });
      }
    },
    {
      name: "blog_update_post",
      description: "Update fields of a blog post (partial). `changes` contains only the fields to change (same shape as blog_create_post's post). Requires the current `version`; on 409 re-read with blog_get_post and retry with currentVersion. Returns the post at version+1. Requires an admin identity.",
      inputSchema: versionedInputSchema(
        { changes: { type: "object", properties: postFieldsJsonSchema, additionalProperties: false, description: "Fields to change" } },
        ["changes"]
      ),
      handler: async (args, context) => {
        const a = parseArgs(UpdatePostArgs, args, "blog_update_post");
        const body = parseArgs(BlogPostUpdateInputSchema, { ...a.changes, version: a.version }, "blog_update_post changes");
        return request(a, context, { method: "PATCH", path: `/api/v1/blog/posts/${enc(a.post_id)}`, body, idempotencyKey: a.idempotency_key ?? true, schema: postResponse });
      }
    },
    {
      name: "blog_publish_post",
      description: "Publish a blog post (status published; publishedAt is set on first publish and kept on republish). Requires the current `version`. Requires an admin identity.",
      inputSchema: versionedInputSchema(),
      handler: async (args, context) => {
        const a = parseArgs(VersionedPostArgs, args, "blog_publish_post");
        return request(a, context, { method: "POST", path: `/api/v1/blog/posts/${enc(a.post_id)}/publish`, body: { version: a.version }, idempotencyKey: a.idempotency_key ?? true, schema: postResponse });
      }
    },
    {
      name: "blog_unpublish_post",
      description: "Return a published blog post to draft. Requires the current `version`. Requires an admin identity.",
      inputSchema: versionedInputSchema(),
      handler: async (args, context) => {
        const a = parseArgs(VersionedPostArgs, args, "blog_unpublish_post");
        return request(a, context, { method: "POST", path: `/api/v1/blog/posts/${enc(a.post_id)}/unpublish`, body: { version: a.version }, idempotencyKey: a.idempotency_key ?? true, schema: postResponse });
      }
    },
    {
      name: "blog_archive_post",
      description: "Archive a blog post (soft delete; status archived, content and revisions kept). Requires the current `version`. Requires an admin identity.",
      inputSchema: versionedInputSchema(),
      handler: async (args, context) => {
        const a = parseArgs(VersionedPostArgs, args, "blog_archive_post");
        return request(a, context, { method: "DELETE", path: `/api/v1/blog/posts/${enc(a.post_id)}?version=${a.version}`, idempotencyKey: a.idempotency_key ?? true, schema: postResponse });
      }
    },
    {
      name: "blog_list_revisions",
      description: "List a blog post's revisions, newest first (metadata only, no snapshot). Every successful write creates one. Use a revision id with blog_restore_revision. Requires an admin identity.",
      inputSchema: { type: "object", properties: { post_id: postIdProp, ...credentialProps }, required: ["post_id"] },
      handler: async (args, context) => {
        const a = parseArgs(ListRevisionsArgs, args, "blog_list_revisions");
        return request(a, context, { method: "GET", path: `/api/v1/blog/posts/${enc(a.post_id)}/revisions`, schema: BlogRevisionListResponseSchema });
      }
    },
    {
      name: "blog_restore_revision",
      description: "Restore a revision's content into a blog post as a new version (status unchanged). Requires the post's current `version`. Requires an admin identity.",
      inputSchema: versionedInputSchema({ revision_id: { type: "string", minLength: 1, description: "Revision id from blog_list_revisions" } }, ["revision_id"]),
      handler: async (args, context) => {
        const a = parseArgs(RestoreRevisionArgs, args, "blog_restore_revision");
        return request(a, context, {
          method: "POST",
          path: `/api/v1/blog/posts/${enc(a.post_id)}/revisions/${enc(a.revision_id)}/restore`,
          body: { version: a.version },
          idempotencyKey: a.idempotency_key ?? true,
          schema: postResponse
        });
      }
    }
  ];
}
