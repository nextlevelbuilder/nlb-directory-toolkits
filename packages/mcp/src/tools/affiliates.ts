import { z, type ZodType, type ZodTypeDef } from "zod";
import {
  AFFILIATE_APPROVAL_STATUSES,
  AFFILIATE_CONVERSION_STATUSES,
  AFFILIATE_LINK_STATUSES,
  AFFILIATE_MAX_DISCOUNT_BPS,
  AFFILIATE_STATUSES,
  AffiliateAdminAffiliatesQuerySchema,
  AffiliateAdminAffiliatesResponseSchema,
  AffiliateAdminApprovalsResponseSchema,
  AffiliateAdminBatchDetailResponseSchema,
  AffiliateAdminBatchResponseSchema,
  AffiliateAdminBatchesResponseSchema,
  AffiliateAdminConversionResponseSchema,
  AffiliateAdminConversionsResponseSchema,
  AffiliateAdminRulesResponseSchema,
  AffiliateAdminApprovalsQuerySchema,
  AffiliateAdminBatchesQuerySchema,
  AffiliateAdminConversionsQuerySchema,
  AffiliateAdminReconciliationQuerySchema,
  AffiliateCommissionsResponseSchema,
  AffiliateConversionsResponseSchema,
  AffiliateCreateBatchInputSchema,
  AffiliateEnvelopeSchema,
  AffiliateHoldInputSchema,
  AffiliateJoinInputSchema,
  AffiliateLinkCreateInputSchema,
  AffiliateLinkResponseSchema,
  AffiliateLinkUpdateFieldsSchema,
  AffiliateLinksResponseSchema,
  AffiliateListQuerySchema,
  AffiliatePayoutPeriodSchema,
  AffiliatePayoutsResponseSchema,
  AffiliatePreviewQuerySchema,
  AffiliatePreviewResponseSchema,
  AffiliateProgramResponseSchema,
  AffiliateRulesPreviewResponseSchema,
  AffiliateRulesPreviewInputSchema,
  AffiliateSummaryResponseSchema,
  describeAffiliateApiFailure,
  hasAffiliateLinkChange
} from "@nextlevelbuilder/contracts";
import { ToolError, type ToolContext } from "../tool-context.js";
import type { McpToolDefinition, resolveToolEnv } from "./index.js";

type ResolveToolEnv = typeof resolveToolEnv;
type JsonSchemaProps = Record<string, unknown>;
type Args = Record<string, unknown>;

/**
 * Who a tool acts as.
 * - `public`: no credentials at all (the program overview).
 * - `member`: the caller's own affiliate account via OAuth or a member API key.
 * - `operator`: a finance operator via OAuth (mcp:operator) or an operator session cookie; API keys are never sent.
 */
type Mode = "public" | "member" | "operator";

/** Tool arguments that select the endpoint and credentials rather than the request itself. */
const CREDENTIAL_KEYS: Record<Mode, readonly string[]> = {
  public: ["api_url"],
  member: ["api_key", "api_url"],
  operator: ["api_url", "session_cookie"]
};

const apiUrlProp = { api_url: { type: "string", description: "Allowed directory API endpoint (optional)" } };
const CREDENTIAL_PROPS: Record<Mode, JsonSchemaProps> = {
  public: apiUrlProp,
  member: {
    api_key: { type: "string", description: "NLB API key of the member; otherwise uses the configured NLB_API_KEY (ignored for OAuth calls)" },
    ...apiUrlProp
  },
  operator: {
    ...apiUrlProp,
    session_cookie: {
      type: "string",
      description: "Operator's Better Auth session cookie (or NLB_SESSION_COOKIE) for stdio and Worker callers. OAuth calls act as the signed-in operator and refuse it. API keys are refused."
    }
  }
};

const UNITS_NOTE = "Money fields end in Minor and are integer minor units (USD cents); rates end in Bps and are integer basis points (10000 = 100%).";
const MEMBER_NOTE = "Owner-only: acts on the caller's own affiliate account (OAuth, member API key or NLB_API_KEY). While AFFILIATES_ENABLED is off the API answers 404 and the error has notEnabled: true.";
const OPERATOR_NOTE = "Finance operator only: OAuth with the mcp:operator scope (offered only to platform operators) or an operator's session cookie; the web checks the affiliate operator grant and audits every call. API keys are refused.";

interface AffiliateCall {
  method: "GET" | "POST" | "PATCH";
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /** The path names one item, so a 404 may also mean it does not exist. */
  resource?: boolean;
  /** Response validation; the raw JSON is returned so no field is ever dropped. */
  schema?: ZodType<unknown, ZodTypeDef, unknown>;
  idempotencyKey?: string;
}

function isAnonymousWorker(context?: ToolContext): boolean {
  return context !== undefined && !context.oauth && context.workerAuth !== true;
}

function resolveSessionCookie(credentials: Args, context?: ToolContext): string | undefined {
  if (context?.oauth) return undefined;
  if (typeof credentials.session_cookie === "string" && credentials.session_cookie.trim()) return credentials.session_cookie.trim();
  return typeof process !== "undefined" ? process.env?.NLB_SESSION_COOKIE?.trim() || undefined : undefined;
}

function splitCredentials(mode: Mode, args: Args): { credentials: Args; rest: Args } {
  const credentials: Args = {};
  const rest: Args = {};
  for (const [key, value] of Object.entries(args)) {
    if (CREDENTIAL_KEYS[mode].includes(key)) {
      if (value !== undefined && typeof value !== "string") throw new ToolError(`Invalid arguments: ${key} must be a string`, { details: [{ path: key, message: "Expected string" }] });
      if (typeof value === "string") credentials[key] = value;
    } else {
      rest[key] = value;
    }
  }
  return { credentials, rest };
}

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

async function affiliateRequest(
  resolveEnv: ResolveToolEnv,
  mode: Mode,
  credentials: Args,
  context: ToolContext | undefined,
  call: AffiliateCall
): Promise<unknown> {
  // Only member calls may carry an API key; operator routes refuse keys and the program overview needs none.
  const { apiUrl, apiKey } = resolveEnv(mode === "member" ? credentials : { api_url: credentials.api_url }, context);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (mode === "member" && apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["x-api-key"] = apiKey;
  } else if (mode === "operator") {
    const cookie = resolveSessionCookie(credentials, context);
    if (cookie) headers.Cookie = cookie;
  }
  if (call.body !== undefined) headers["Content-Type"] = "application/json";
  if (call.method !== "GET") headers["Idempotency-Key"] = call.idempotencyKey ?? crypto.randomUUID();

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(call.query ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.size ? `?${params.toString()}` : "";

  const response = await (context?.fetch ?? fetch)(`${apiUrl}${call.path}${search}`, {
    method: call.method,
    headers,
    body: call.body !== undefined ? JSON.stringify(call.body) : undefined,
    signal: AbortSignal.timeout(20000)
  });
  const text = await response.text();
  if (!response.ok) {
    const failure = describeAffiliateApiFailure(response.status, text, response.statusText, { resource: call.resource, operator: mode === "operator" });
    const data: Record<string, unknown> = { status: failure.status, notEnabled: failure.notEnabled };
    if (failure.code !== undefined) data.code = failure.code;
    if (failure.details !== undefined) data.details = failure.details;
    if (failure.hint !== undefined) data.hint = failure.hint;
    const denied = response.status === 401 || (mode === "operator" && response.status === 403 && failure.code !== "approval_required");
    if (denied) {
      data.hint = mode === "operator"
        ? context?.oauth
          ? "This account needs an unrevoked affiliate operator grant and a connection authorized with mcp:operator. Reconnect the MCP client after the grant is added."
          : "Operator tools need an operator's signed-in session cookie (session_cookie or NLB_SESSION_COOKIE), or OAuth with mcp:operator."
        : context?.oauth
          ? "The NLB API rejected this OAuth identity. Reconnect the MCP client."
          : "Send a member API key (api_key or NLB_API_KEY).";
    }
    throw new ToolError(`Affiliate API error (${failure.message})`, data);
  }
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Affiliate API returned a non-JSON response for ${call.path}`);
  }
  const parsed = (call.schema ?? AffiliateEnvelopeSchema).safeParse(json);
  if (!parsed.success) throw new Error(`Affiliate API response schema mismatch for ${call.path}: ${parsed.error.message}`);
  return json;
}

const enc = encodeURIComponent;

// --- Argument schemas (path ids are snake_case tool args; body and query fields keep the API names) ---

const NoArgs = z.object({}).strict();
const idArg = z.string().min(1).max(200);
const idempotencyArg = z.string().min(1).max(128).optional();
const JoinArgs = AffiliateJoinInputSchema.extend({ idempotency_key: idempotencyArg }).strict();
const CreateLinkArgs = AffiliateLinkCreateInputSchema.extend({ idempotency_key: idempotencyArg }).strict();
const UpdateLinkArgs = AffiliateLinkUpdateFieldsSchema.extend({ link_id: idArg, idempotency_key: idempotencyArg })
  .strict()
  .refine(hasAffiliateLinkChange, { message: "Give at least one of label, discountBps, destinationPath, utmCampaign or status" });
const HoldArgs = AffiliateHoldInputSchema.extend({ conversion_id: idArg, idempotency_key: idempotencyArg }).strict();
const ReleaseArgs = z.object({ conversion_id: idArg, idempotency_key: idempotencyArg }).strict();
const BatchIdArgs = z.object({ batch_id: idArg }).strict();
const CancelBatchArgs = BatchIdArgs.extend({ idempotency_key: idempotencyArg }).strict();
const CreateBatchArgs = AffiliateCreateBatchInputSchema.extend({ idempotency_key: idempotencyArg }).strict();
const PeriodArgs = z.object({ period: AffiliatePayoutPeriodSchema }).strict();

// --- JSON Schemas advertised to agents ---

const idProp = (description: string) => ({ type: "string", minLength: 1, maxLength: 200, description });
const limitProp = { type: "integer", minimum: 1, maximum: 100 };
const idempotencyProp = {
  type: "string",
  maxLength: 128,
  description: "Optional Idempotency-Key. Reuse the same key when retrying the same write; a random UUID is used when omitted."
};
const discountProp = {
  type: "integer",
  minimum: 0,
  maximum: AFFILIATE_MAX_DISCOUNT_BPS,
  description: "Buyer discount in basis points (1000 = 10%). Must not exceed the caller's budgetBps; the commission is what the budget leaves: commissionBps = (budgetBps - discountBps) / (1 - discountBps/10000)."
};
const linkFieldProps: JsonSchemaProps = {
  label: { type: ["string", "null"], maxLength: 80, description: "Private name of the link" },
  discountBps: discountProp,
  destinationPath: { type: "string", maxLength: 200, description: "Landing path on nextlevelbuilder.io: /, /vi, /courses…, /live…, /blog… or /affiliates…, optional #fragment (default /)" },
  utmCampaign: { type: ["string", "null"], maxLength: 64, description: "Lowercase slug added as utm_campaign" }
};
const periodProp = { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$", description: "Closed calendar month (UTC), YYYY-MM" };
const instantProp = (description: string) => ({ type: "string", maxLength: 40, description: `${description}: ISO date (YYYY-MM-DD) or timestamp` });

function schema(mode: Mode, properties: JsonSchemaProps, required: string[] = []): McpToolDefinition["inputSchema"] {
  return { type: "object", properties: { ...properties, ...CREDENTIAL_PROPS[mode] }, ...(required.length ? { required } : {}) };
}

const MEMBER = "/api/v1/affiliates";
const ADMIN = "/api/v1/affiliate-admin";

/**
 * Builds the affiliate program tools. Members read their own program standing, links, conversions,
 * commissions and payouts and manage their own links; finance operators read, preview, hold or release
 * conversions and create or cancel payout batches. The web is the authority for every rule (ownership,
 * budget invariant, operator grant, audit).
 *
 * Deliberately not exposed: payout methods (bank, PayPal or identity data), payee detail reveals,
 * mark-paid, rule publishing, ledger adjustments and batch approval. Those stay with signed-in humans
 * on the website, and the two-person ones need a second operator's approval.
 */
export function createAffiliateTools(resolveEnv: ResolveToolEnv): McpToolDefinition[] {
  function define<T>(
    mode: Mode,
    name: string,
    description: string,
    inputSchema: McpToolDefinition["inputSchema"],
    argsSchema: ZodType<T, ZodTypeDef, unknown>,
    build: (args: T) => AffiliateCall
  ): McpToolDefinition {
    const note = mode === "operator" ? OPERATOR_NOTE : mode === "member" ? MEMBER_NOTE : "";
    return {
      name,
      description: [description, UNITS_NOTE, note].filter(Boolean).join(" "),
      inputSchema,
      handler: async (args, context) => {
        // Private calls are bound to a member or operator identity; an anonymous Worker caller never
        // borrows the server's configured key.
        if (mode !== "public" && isAnonymousWorker(context)) {
          throw new ToolError(`Unauthorized: Tool '${name}' acts for a signed-in ${mode} and requires a valid Worker authorization token.`, { status: 401 });
        }
        const { credentials, rest } = splitCredentials(mode, args);
        const parsed = parseArgs(argsSchema, rest, name);
        return affiliateRequest(resolveEnv, mode, credentials, context, build(parsed));
      }
    };
  }

  return [
    // --- Member: reads ---
    define("public", "affiliate_get_program", "Read the public affiliate program: levels with the qualifying customer count and incentive budget for ordinary users and paid members, eligible plans, attribution window, commission hold days, payout threshold and fees, the budget invariant and the current Affiliate Agreement termsVersion. No personal data.",
      schema("public", {}), NoArgs,
      () => ({ method: "GET", path: `${MEMBER}/program`, schema: AffiliateProgramResponseSchema })),
    define("member", "affiliate_get_me", "Read the caller's affiliate account: status, level, qualifying customers, next level, incentive basis (ordinary or member), budgetBps, ledger balances per bucket and a masked payout method (type and hint only). 404 not_enrolled when the caller has not joined.",
      schema("member", {}), NoArgs,
      () => ({ method: "GET", path: `${MEMBER}/me`, schema: AffiliateSummaryResponseSchema })),
    define("member", "affiliate_preview_incentive", "Preview the split of the caller's current budget for a buyer discount: the commission left, whether it fits, and, only when priceMinor is given and the discount fits, an example of what the buyer pays, the affiliate earns and NLB keeps. Indicative only; the order decides. Read-only.",
      schema("member", { discountBps: discountProp, priceMinor: { type: "integer", minimum: 0, description: "Pre-tax price in minor units for the example (optional)" } }, ["discountBps"]),
      AffiliatePreviewQuerySchema,
      (a) => ({ method: "GET", path: `${MEMBER}/preview`, query: { discountBps: a.discountBps, priceMinor: a.priceMinor }, schema: AffiliatePreviewResponseSchema })),
    define("member", "affiliate_list_links", "List the caller's referral links with URL, buyer discount, the commission new checkouts get under today's budget, status, version, clicks and conversions.",
      schema("member", {}), NoArgs,
      () => ({ method: "GET", path: `${MEMBER}/links`, schema: AffiliateLinksResponseSchema })),
    define("member", "affiliate_list_conversions", "List the caller's referred purchases newest first: plan, net amount, discount, commission, refunds, status (pending, available, held, reversed) and maturity date. Buyers are never identified.",
      schema("member", { limit: limitProp }), AffiliateListQuerySchema,
      (a) => ({ method: "GET", path: `${MEMBER}/conversions`, query: { limit: a.limit }, schema: AffiliateConversionsResponseSchema })),
    define("member", "affiliate_get_commissions", "Read the caller's commission balances per bucket (pending, held, available, payout_locked, paid) and the append-only ledger newest first.",
      schema("member", { limit: limitProp }), AffiliateListQuerySchema,
      (a) => ({ method: "GET", path: `${MEMBER}/commissions`, query: { limit: a.limit }, schema: AffiliateCommissionsResponseSchema })),
    define("member", "affiliate_list_payouts", "List the caller's payouts by period: gross, service fee, withholding, net, status and the transfer reference once paid. Never shows payout account details; setting up a payout method is done in a signed-in browser session on the website.",
      schema("member", {}), NoArgs,
      () => ({ method: "GET", path: `${MEMBER}/payouts`, schema: AffiliatePayoutsResponseSchema })),

    // --- Member: writes (owner-only self-service) ---
    define("member", "affiliate_join", "Join the affiliate program as the caller. termsVersion must be the Affiliate Agreement version the user read and explicitly accepted (affiliate_get_program returns the current one); never accept the agreement on the user's behalf. Write: owner-only, acts only on the caller's account.",
      schema("member", { termsVersion: { type: "string", minLength: 1, maxLength: 40, description: "Affiliate Agreement version the user accepted, e.g. 2026-10-31" }, idempotency_key: idempotencyProp }, ["termsVersion"]),
      JoinArgs,
      ({ idempotency_key, ...body }) => ({ method: "POST", path: `${MEMBER}/me`, body, idempotencyKey: idempotency_key, schema: AffiliateSummaryResponseSchema })),
    define("member", "affiliate_create_link", "Create a referral link for the caller. The buyer discount must fit the caller's budget (422 over_budget otherwise); the commission is what the budget leaves. Omit code for a random one. Up to 20 links. Write: owner-only, acts only on the caller's account.",
      schema("member", {
        code: { type: "string", minLength: 4, maxLength: 32, pattern: "^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$", description: "Public code in the /r/{code} URL (optional; cannot change later)" },
        ...linkFieldProps,
        idempotency_key: idempotencyProp
      }),
      CreateLinkArgs,
      ({ idempotency_key, ...body }) => ({ method: "POST", path: `${MEMBER}/links`, body, idempotencyKey: idempotency_key, schema: AffiliateLinkResponseSchema })),
    define("member", "affiliate_update_link", "Update one of the caller's links for future checkouts only (past purchases keep their terms). Pass expectedVersion (the link's version from affiliate_list_links) to refuse the edit with 409 conflict if it changed meanwhile. status archived is permanent. The code cannot change. Write: owner-only, acts only on the caller's own links.",
      schema("member", {
        link_id: idProp("Link id (from affiliate_list_links)"),
        ...linkFieldProps,
        status: { type: "string", enum: [...AFFILIATE_LINK_STATUSES], description: "paused stops new attribution; archived is permanent" },
        expectedVersion: { type: "integer", minimum: 1, description: "Version last read; optimistic concurrency guard" },
        idempotency_key: idempotencyProp
      }, ["link_id"]),
      UpdateLinkArgs,
      ({ link_id, idempotency_key, ...body }) => ({ method: "PATCH", path: `${MEMBER}/links/${enc(link_id)}`, body, idempotencyKey: idempotency_key, resource: true, schema: AffiliateLinkResponseSchema })),

    // --- Operator: reads and previews ---
    define("operator", "affiliate_admin_get_rules", "Read the active program rules version and document.",
      schema("operator", {}), NoArgs,
      () => ({ method: "GET", path: `${ADMIN}/rules`, schema: AffiliateAdminRulesResponseSchema })),
    define("operator", "affiliate_admin_preview_rules", "Validate a candidate rules document and return its level and budget table. Nothing is written; publishing rules needs a second operator's approval on the website.",
      schema("operator", {
        rules: {
          type: "object",
          description: "Rules document: { currency, levels: [{ key, minCustomers, ordinaryBudgetBps, memberBudgetBps }], eligiblePlans, attributionWindowDays, holdDays, payoutThresholdMinor, paypalServiceFeeBps, bankVnServiceFeeBps, withholding: { vnIndividualBps, vnBusinessBps, otherBps }, termsVersion }"
        }
      }, ["rules"]),
      AffiliateRulesPreviewInputSchema,
      (a) => ({ method: "POST", path: `${ADMIN}/rules/preview`, body: a, schema: AffiliateRulesPreviewResponseSchema })),
    define("operator", "affiliate_admin_list_affiliates", "List affiliates with their standing (level, qualifying customers, budget) and balances. Returns { affiliates }; account ids only, never names, emails or payee data.",
      schema("operator", { status: { type: "string", enum: [...AFFILIATE_STATUSES] }, limit: limitProp }), AffiliateAdminAffiliatesQuerySchema,
      (a) => ({ method: "GET", path: `${ADMIN}/affiliates`, query: { status: a.status, limit: a.limit }, schema: AffiliateAdminAffiliatesResponseSchema })),
    define("operator", "affiliate_admin_list_conversions", "List conversions across affiliates, optionally by status, for fraud review. Returns { conversions } with the buyer account id and Polar order id.",
      schema("operator", { status: { type: "string", enum: [...AFFILIATE_CONVERSION_STATUSES] }, limit: limitProp }), AffiliateAdminConversionsQuerySchema,
      (a) => ({ method: "GET", path: `${ADMIN}/conversions`, query: { status: a.status, limit: a.limit }, schema: AffiliateAdminConversionsResponseSchema })),
    define("operator", "affiliate_admin_preview_payouts", "Preview the payout of a closed month: per affiliate the available amount, fee, withholding, net and blockers (below threshold, payout method required, withholding rule missing, verification required, suspended), plus totals. Nothing is locked.",
      schema("operator", { period: periodProp }, ["period"]), PeriodArgs,
      (a) => ({ method: "GET", path: `${ADMIN}/payouts/preview`, query: { period: a.period } })),
    define("operator", "affiliate_admin_list_batches", "List payout batches newest first with status (draft, approved, paid, cancelled). Returns { batches }; use affiliate_admin_get_batch for totals and items.",
      schema("operator", { limit: limitProp }), AffiliateAdminBatchesQuerySchema,
      (a) => ({ method: "GET", path: `${ADMIN}/payouts/batches`, query: { limit: a.limit }, schema: AffiliateAdminBatchesResponseSchema })),
    define("operator", "affiliate_admin_get_batch", "Get one payout batch with its items (amounts and statuses only, never payee details).",
      schema("operator", { batch_id: idProp("Batch id") }, ["batch_id"]), BatchIdArgs,
      (a) => ({ method: "GET", path: `${ADMIN}/payouts/batches/${enc(a.batch_id)}`, resource: true, schema: AffiliateAdminBatchDetailResponseSchema })),
    define("operator", "affiliate_admin_reconciliation", "Ledger-to-provider reconciliation: per conversion the Polar order amounts next to the ledger accrual and reversals with issues, bucket totals and the program-wide checks.",
      schema("operator", { since: instantProp("Conversions paid at or after"), until: instantProp("Conversions paid before") }), AffiliateAdminReconciliationQuerySchema,
      (a) => ({ method: "GET", path: `${ADMIN}/reconciliation`, query: { since: a.since, until: a.until } })),
    define("operator", "affiliate_admin_list_approvals", "List two-person approvals for affiliate actions (rules publish, batch approval, ledger adjustment), default pending. Deciding them stays on the website. Keyset pagination: pass pagination.nextCursor as cursor.",
      schema("operator", { status: { type: "string", enum: [...AFFILIATE_APPROVAL_STATUSES] }, limit: limitProp, cursor: { type: "string", maxLength: 500 } }), AffiliateAdminApprovalsQuerySchema,
      (a) => ({ method: "GET", path: `${ADMIN}/approvals`, query: { status: a.status, limit: a.limit, cursor: a.cursor }, schema: AffiliateAdminApprovalsResponseSchema })),

    // --- Operator: writes that never move money out ---
    define("operator", "affiliate_admin_hold_conversion", "Hold a pending conversion for review (suspected fraud, dispute): its commission moves from pending to held and cannot mature or be paid until released. Reason required; only pending conversions can be held (409 invalid_transition otherwise).",
      schema("operator", { conversion_id: idProp("Conversion id"), reason: { type: "string", minLength: 3, maxLength: 300, description: "Why the conversion is held (3-300 characters)" }, idempotency_key: idempotencyProp }, ["conversion_id", "reason"]),
      HoldArgs,
      ({ conversion_id, idempotency_key, ...body }) => ({ method: "POST", path: `${ADMIN}/conversions/${enc(conversion_id)}/hold`, body, idempotencyKey: idempotency_key, resource: true, schema: AffiliateAdminConversionResponseSchema })),
    define("operator", "affiliate_admin_release_conversion", "Release a held conversion back to pending; it matures on its original schedule. Only held conversions can be released (409 invalid_transition otherwise).",
      schema("operator", { conversion_id: idProp("Conversion id"), idempotency_key: idempotencyProp }, ["conversion_id"]),
      ReleaseArgs,
      (a) => ({ method: "POST", path: `${ADMIN}/conversions/${enc(a.conversion_id)}/release`, idempotencyKey: a.idempotency_key, resource: true, schema: AffiliateAdminConversionResponseSchema })),
    define("operator", "affiliate_admin_create_batch", "Create the draft payout batch of a closed month: locks each eligible affiliate's available balance (payout_locked). No money is sent; approving the batch needs a second operator and paying is recorded by a human on the website.",
      schema("operator", { period: periodProp, idempotency_key: idempotencyProp }, ["period"]),
      CreateBatchArgs,
      ({ idempotency_key, ...body }) => ({ method: "POST", path: `${ADMIN}/payouts/batches`, body, idempotencyKey: idempotency_key, schema: AffiliateAdminBatchDetailResponseSchema })),
    define("operator", "affiliate_admin_cancel_batch", "Cancel a draft or approved payout batch that has no recorded payment: its pending items are cancelled and their locked amounts return to available. A cancelled batch cannot be reopened.",
      schema("operator", { batch_id: idProp("Batch id"), idempotency_key: idempotencyProp }, ["batch_id"]),
      CancelBatchArgs,
      (a) => ({ method: "POST", path: `${ADMIN}/payouts/batches/${enc(a.batch_id)}/cancel`, idempotencyKey: a.idempotency_key, resource: true, schema: AffiliateAdminBatchResponseSchema }))
  ];
}
