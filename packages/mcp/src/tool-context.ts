export const MCP_SCOPES = ["mcp:read", "mcp:write", "mcp:keys"] as const;
export type McpScope = typeof MCP_SCOPES[number];

export function requiredToolScope(name: string): McpScope {
  if (["list_api_keys", "create_api_key", "revoke_api_key"].includes(name)) return "mcp:keys";
  if (["submit_product", "cast_vote", "upload_media", "create_checkout"].includes(name)) return "mcp:write";
  return "mcp:read";
}

export interface ToolContext {
  workerAuth?: boolean;
  env?: { NLB_API_KEY?: string; NLB_API_URL?: string };
  oauth?: { subject: string; scopes: string[] };
  fetch?: typeof fetch;
}
