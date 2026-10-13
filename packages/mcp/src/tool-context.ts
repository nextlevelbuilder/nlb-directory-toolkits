export const MCP_SCOPES = ["mcp:read", "mcp:write", "mcp:keys"] as const;
export type McpScope = typeof MCP_SCOPES[number];

/** Blog tools that mutate posts; they need mcp:write and an authorized caller. */
export const BLOG_WRITE_TOOLS = [
  "blog_create_post",
  "blog_update_post",
  "blog_publish_post",
  "blog_unpublish_post",
  "blog_archive_post",
  "blog_restore_revision"
] as const;

/** Reads that always need an identity (no anonymous fallback). */
export const PRIVATE_READ_TOOLS = ["get_product_traffic", "blog_list_revisions"] as const;

/** Reads that are public anonymously but forward the caller's identity when present (e.g. admin draft access). */
export const IDENTITY_AWARE_READ_TOOLS = ["blog_list_posts", "blog_get_post"] as const;

export function requiredToolScope(name: string): McpScope {
  if (["list_api_keys", "create_api_key", "revoke_api_key"].includes(name)) return "mcp:keys";
  if (["submit_product", "cast_vote", "upload_media", "create_checkout", ...BLOG_WRITE_TOOLS].includes(name)) return "mcp:write";
  return "mcp:read";
}

export function isPrivateReadTool(name: string): boolean {
  return (PRIVATE_READ_TOOLS as readonly string[]).includes(name);
}

export function isIdentityAwareReadTool(name: string): boolean {
  return (IDENTITY_AWARE_READ_TOOLS as readonly string[]).includes(name);
}

/** Tool failure with structured data (e.g. HTTP status, currentVersion, validation details) merged into the MCP error payload. */
export class ToolError extends Error {
  readonly data: Record<string, unknown>;

  constructor(message: string, data: Record<string, unknown>) {
    super(message);
    this.name = "ToolError";
    this.data = data;
  }
}

export interface ToolContext {
  workerAuth?: boolean;
  env?: { NLB_API_KEY?: string; NLB_API_URL?: string };
  oauth?: { subject: string; scopes: string[] };
  fetch?: typeof fetch;
}
