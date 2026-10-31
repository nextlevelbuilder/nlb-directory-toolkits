export const MCP_SCOPES = ["mcp:read", "mcp:write", "mcp:keys", "mcp:operator"] as const;
export type McpScope = typeof MCP_SCOPES[number];

/**
 * Affiliate member reads (mcp:read), bound to the caller's own affiliate account. The program overview
 * (affiliate_get_program) is public and therefore not listed here.
 */
export const AFFILIATE_MEMBER_READ_TOOLS = [
  "affiliate_get_me",
  "affiliate_preview_incentive",
  "affiliate_list_links",
  "affiliate_list_conversions",
  "affiliate_get_commissions",
  "affiliate_list_payouts"
] as const;

/** Affiliate member writes (mcp:write): owner-only self-service. Payout methods stay session-only on the website. */
export const AFFILIATE_MEMBER_WRITE_TOOLS = [
  "affiliate_join",
  "affiliate_create_link",
  "affiliate_update_link"
] as const;

/**
 * Affiliate finance operator reads and previews (mcp:operator). Previews never write. The web checks the
 * affiliate operator grant on every call.
 */
export const AFFILIATE_OPERATOR_READ_TOOLS = [
  "affiliate_admin_get_rules",
  "affiliate_admin_preview_rules",
  "affiliate_admin_list_affiliates",
  "affiliate_admin_list_conversions",
  "affiliate_admin_preview_payouts",
  "affiliate_admin_list_batches",
  "affiliate_admin_get_batch",
  "affiliate_admin_reconciliation",
  "affiliate_admin_list_approvals"
] as const;

/**
 * Affiliate operator writes (mcp:operator). None of them moves money out: publishing rules, approving
 * batches, marking items paid, revealing payee details and ledger adjustments are deliberately not tools.
 */
export const AFFILIATE_OPERATOR_WRITE_TOOLS = [
  "affiliate_admin_hold_conversion",
  "affiliate_admin_release_conversion",
  "affiliate_admin_create_batch",
  "affiliate_admin_cancel_batch"
] as const;

/** Operator reads: private, and advertised as read-only even when they POST a preview. */
export const OPERATOR_READ_TOOLS = [...AFFILIATE_OPERATOR_READ_TOOLS] as const;
/** Operator writes (mcp:operator, mutating). */
export const OPERATOR_WRITE_TOOLS = [...AFFILIATE_OPERATOR_WRITE_TOOLS] as const;

/** Reads that always need an identity (no anonymous fallback). */
export const PRIVATE_READ_TOOLS = [
  "get_product_traffic",
  ...AFFILIATE_MEMBER_READ_TOOLS,
  ...OPERATOR_READ_TOOLS
] as const;

const KEY_TOOLS = ["list_api_keys", "create_api_key", "revoke_api_key"];
const WRITE_TOOLS = ["submit_product", "cast_vote", "upload_media", "create_checkout", ...AFFILIATE_MEMBER_WRITE_TOOLS];

export function isOperatorTool(name: string): boolean {
  return (OPERATOR_READ_TOOLS as readonly string[]).includes(name) || (OPERATOR_WRITE_TOOLS as readonly string[]).includes(name);
}

export function requiredToolScope(name: string): McpScope {
  if (KEY_TOOLS.includes(name)) return "mcp:keys";
  if (isOperatorTool(name)) return "mcp:operator";
  if (WRITE_TOOLS.includes(name)) return "mcp:write";
  return "mcp:read";
}

/** Tools that mutate remote state: anonymous HTTP callers are refused before they run. */
export function isMutatingTool(name: string): boolean {
  return WRITE_TOOLS.includes(name) ||
    ["create_api_key", "revoke_api_key"].includes(name) ||
    (OPERATOR_WRITE_TOOLS as readonly string[]).includes(name);
}

export function isPrivateReadTool(name: string): boolean {
  return (PRIVATE_READ_TOOLS as readonly string[]).includes(name);
}

/** Tool failure with structured data (e.g. HTTP status, code, validation details) merged into the MCP error payload. */
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
