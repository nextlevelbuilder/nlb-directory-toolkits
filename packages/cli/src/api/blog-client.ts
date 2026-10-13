import { randomUUID } from "node:crypto";
import type { ZodType, ZodTypeDef } from "zod";
import {
  BlogBlockCatalogueResponseSchema,
  BlogLocaleSchema,
  BlogPostCreateInputSchema,
  BlogPostListQuerySchema,
  BlogPostListResponseSchema,
  BlogPostResponseSchema,
  BlogPostUpdateInputSchema,
  BlogRevisionListResponseSchema,
  BlogValidateInputSchema,
  BlogValidateResponseSchema,
  BlogVersionInputSchema,
  describeBlogApiFailure,
  type BlogApiFailure,
  type BlogBlockCatalogueResponse,
  type BlogLocale,
  type BlogPostListQuery,
  type BlogPostListResponse,
  type BlogPostResponse,
  type BlogRevisionListResponse,
  type BlogValidateResponse
} from "@nextlevelbuilder/contracts";

/** Raised for any non-2xx blog API response; carries the structured failure (status, details, currentVersion). */
export class BlogApiError extends Error {
  readonly status: number;
  readonly details?: unknown;
  readonly currentVersion?: number;

  constructor(failure: BlogApiFailure) {
    super(`API Error (${failure.message})`);
    this.name = "BlogApiError";
    this.status = failure.status;
    this.details = failure.details;
    this.currentVersion = failure.currentVersion;
  }
}

/** Raised when a payload fails the local structural checks before any network call. */
export class BlogInputError extends Error {
  readonly issues: Array<{ path: string; message: string }>;

  constructor(label: string, issues: Array<{ path: string; message: string }>) {
    super(`Invalid ${label}: ${issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("; ")}`);
    this.name = "BlogInputError";
    this.issues = issues;
  }
}

export function parseBlogInput<T>(schema: ZodType<T, ZodTypeDef, unknown>, input: unknown, label: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BlogInputError(
      label,
      result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
    );
  }
  return result.data;
}

export interface BlogClientOptions {
  baseUrl: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

interface BlogRequest<T> {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  /** Writes send a fresh Idempotency-Key so a retried request is not applied twice. */
  write?: boolean;
  schema: ZodType<T, ZodTypeDef, unknown>;
}

const enc = encodeURIComponent;

/**
 * Typed client for `/api/v1/blog/*`. Uses the CLI's resolved API key as a Bearer token.
 */
export class NlbBlogClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: BlogClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey?.trim() || undefined;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  private async send<T>(req: BlogRequest<T>): Promise<T> {
    const url = `${this.baseUrl}${req.path}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
      headers["x-api-key"] = this.apiKey;
    }
    if (req.body !== undefined) headers["Content-Type"] = "application/json";
    if (req.write) headers["Idempotency-Key"] = randomUUID();

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: req.method,
        headers,
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (err) {
      throw new Error(`Network request to ${url} failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const text = await response.text();
    if (!response.ok) {
      throw new BlogApiError(describeBlogApiFailure(response.status, text, response.statusText));
    }

    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`API returned non-JSON response for ${req.path}`);
    }
    const parsed = req.schema.safeParse(data);
    if (!parsed.success) {
      throw new Error(`API Response schema mismatch for ${req.path}: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  async listBlocks(): Promise<BlogBlockCatalogueResponse> {
    return this.send({ method: "GET", path: "/api/v1/blog/blocks", schema: BlogBlockCatalogueResponseSchema });
  }

  async validate(input: unknown): Promise<BlogValidateResponse> {
    const body = parseBlogInput(BlogValidateInputSchema, input, "validate payload");
    return this.send({ method: "POST", path: "/api/v1/blog/validate", body, schema: BlogValidateResponseSchema });
  }

  async listPosts(query: BlogPostListQuery | Record<string, unknown> = {}): Promise<BlogPostListResponse> {
    const q = parseBlogInput(BlogPostListQuerySchema, query, "list query");
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(q)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const search = params.size ? `?${params.toString()}` : "";
    return this.send({ method: "GET", path: `/api/v1/blog/posts${search}`, schema: BlogPostListResponseSchema });
  }

  async getPost(idOrSlug: string, locale?: BlogLocale | string): Promise<BlogPostResponse> {
    const loc = locale === undefined ? undefined : parseBlogInput(BlogLocaleSchema, locale, "locale");
    const search = loc ? `?locale=${enc(loc)}` : "";
    return this.send({ method: "GET", path: `/api/v1/blog/posts/${enc(idOrSlug)}${search}`, schema: BlogPostResponseSchema });
  }

  async createPost(input: unknown): Promise<BlogPostResponse> {
    const body = parseBlogInput(BlogPostCreateInputSchema, input, "post payload");
    return this.send({ method: "POST", path: "/api/v1/blog/posts", body, write: true, schema: BlogPostResponseSchema });
  }

  async updatePost(id: string, input: unknown): Promise<BlogPostResponse> {
    const body = parseBlogInput(BlogPostUpdateInputSchema, input, "update payload");
    return this.send({ method: "PATCH", path: `/api/v1/blog/posts/${enc(id)}`, body, write: true, schema: BlogPostResponseSchema });
  }

  async publishPost(id: string, version: number): Promise<BlogPostResponse> {
    return this.versionedAction(id, "publish", version);
  }

  async unpublishPost(id: string, version: number): Promise<BlogPostResponse> {
    return this.versionedAction(id, "unpublish", version);
  }

  async archivePost(id: string, version: number): Promise<BlogPostResponse> {
    const { version: v } = parseBlogInput(BlogVersionInputSchema, { version }, "version");
    return this.send({ method: "DELETE", path: `/api/v1/blog/posts/${enc(id)}?version=${v}`, write: true, schema: BlogPostResponseSchema });
  }

  async listRevisions(id: string): Promise<BlogRevisionListResponse> {
    return this.send({ method: "GET", path: `/api/v1/blog/posts/${enc(id)}/revisions`, schema: BlogRevisionListResponseSchema });
  }

  async restoreRevision(id: string, revisionId: string, version: number): Promise<BlogPostResponse> {
    const body = parseBlogInput(BlogVersionInputSchema, { version }, "version");
    return this.send({
      method: "POST",
      path: `/api/v1/blog/posts/${enc(id)}/revisions/${enc(revisionId)}/restore`,
      body,
      write: true,
      schema: BlogPostResponseSchema
    });
  }

  private async versionedAction(id: string, action: "publish" | "unpublish", version: number): Promise<BlogPostResponse> {
    const body = parseBlogInput(BlogVersionInputSchema, { version }, "version");
    return this.send({ method: "POST", path: `/api/v1/blog/posts/${enc(id)}/${action}`, body, write: true, schema: BlogPostResponseSchema });
  }
}
