import { describe, it, expect } from "vitest";
import {
  BLOG_LIMITS,
  BlogPostCreateInputSchema,
  BlogPostUpdateInputSchema,
  BlogPostResponseSchema,
  BlogPostListResponseSchema,
  BlogPostSummarySchema,
  BlogValidateInputSchema,
  BlogVersionInputSchema,
  describeBlogApiFailure
} from "../src/index.js";

const validPost = {
  locale: "en",
  slug: "hello-world",
  title: "Hello world",
  blocks: [{ type: "hero", props: { heading: "Hi" } }]
};

const serverPost = {
  id: "post_1", locale: "en", slug: "hello-world", title: "Hello world", description: null,
  blocks: validPost.blocks, coverUrl: null, tags: [], seo: {}, authorName: null, status: "draft",
  translationKey: null, publishedAt: null, version: 1,
  createdAt: "2026-10-13T00:00:00.000Z", updatedAt: "2026-10-13T00:00:00.000Z"
};

describe("Contracts: blog schemas", () => {
  it("accepts a minimal create payload and rejects unknown keys", () => {
    expect(BlogPostCreateInputSchema.parse(validPost)).toEqual(validPost);
    expect(BlogPostCreateInputSchema.safeParse({ ...validPost, status: "published" }).success).toBe(false);
  });

  it("enforces slug, title, description, tag and locale limits", () => {
    for (const slug of ["Hello", "a--b", "-a", "a-", "a".repeat(97)]) {
      expect(BlogPostCreateInputSchema.safeParse({ ...validPost, slug }).success).toBe(false);
    }
    expect(BlogPostCreateInputSchema.safeParse({ ...validPost, slug: "a".repeat(96) }).success).toBe(true);
    expect(BlogPostCreateInputSchema.safeParse({ ...validPost, title: "t".repeat(161) }).success).toBe(false);
    expect(BlogPostCreateInputSchema.safeParse({ ...validPost, description: "d".repeat(321) }).success).toBe(false);
    expect(BlogPostCreateInputSchema.safeParse({ ...validPost, tags: Array(13).fill("x") }).success).toBe(false);
    expect(BlogPostCreateInputSchema.safeParse({ ...validPost, tags: ["x".repeat(33)] }).success).toBe(false);
    expect(BlogPostCreateInputSchema.safeParse({ ...validPost, locale: "fr" }).success).toBe(false);
  });

  it("enforces the 60-block and 200 KB structural limits", () => {
    const block = { type: "paragraph", props: {} };
    expect(BlogValidateInputSchema.safeParse({ blocks: Array(60).fill(block) }).success).toBe(true);
    expect(BlogValidateInputSchema.safeParse({ blocks: Array(61).fill(block) }).success).toBe(false);
    const big = [{ type: "paragraph", props: { text: "x".repeat(BLOG_LIMITS.maxBlocksBytes) } }];
    const result = BlogValidateInputSchema.safeParse({ blocks: big });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("200 KB");
  });

  it("requires a positive integer version and at least one changed field on update", () => {
    expect(BlogPostUpdateInputSchema.safeParse({ version: 2, title: "New" }).success).toBe(true);
    expect(BlogPostUpdateInputSchema.safeParse({ title: "New" }).success).toBe(false);
    expect(BlogPostUpdateInputSchema.safeParse({ version: 2 }).success).toBe(false);
    expect(BlogVersionInputSchema.safeParse({ version: 0 }).success).toBe(false);
    expect(BlogVersionInputSchema.safeParse({ version: 1.5 }).success).toBe(false);
  });

  it("parses server post, summary and list envelopes", () => {
    expect(BlogPostResponseSchema.parse({ data: serverPost }).data.version).toBe(1);
    const { blocks: _blocks, ...summary } = serverPost;
    expect(BlogPostSummarySchema.parse(summary).slug).toBe("hello-world");
    expect(BlogPostListResponseSchema.parse({ data: [summary], pagination: { limit: 20, offset: 0, count: 1 } }).data).toHaveLength(1);
  });

  it("describes 409 conflicts with currentVersion and 400 validation details", () => {
    const conflict = describeBlogApiFailure(409, JSON.stringify({ error: "Version conflict", currentVersion: 4 }));
    expect(conflict.currentVersion).toBe(4);
    expect(conflict.message).toContain("current version is 4");
    const invalid = describeBlogApiFailure(400, JSON.stringify({ error: "Invalid", details: [{ path: "blocks.0.props.heading", message: "Required" }] }));
    expect(invalid.details).toHaveLength(1);
    expect(invalid.message).toContain("blocks.0.props.heading: Required");
    expect(describeBlogApiFailure(502, "Bad gateway").message).toBe("HTTP 502: Bad gateway");
  });
});
