import { afterEach, describe, expect, it, vi } from "vitest";
import { TOOLS, type McpToolDefinition } from "../src/tools/index.js";
import {
  AFFILIATE_MEMBER_READ_TOOLS,
  AFFILIATE_MEMBER_WRITE_TOOLS,
  AFFILIATE_OPERATOR_READ_TOOLS,
  AFFILIATE_OPERATOR_WRITE_TOOLS,
  ToolError,
  isMutatingTool,
  isPrivateReadTool,
  requiredToolScope,
  type ToolContext
} from "../src/tool-context.js";
import { McpServer } from "../src/server.js";

const API = "https://staging.nextlevelbuilder.io";
const ENV = { NLB_API_KEY: "nlb_live_member", NLB_API_URL: API };
const NOW = "2026-10-31T00:00:00.000Z";

const program = {
  rulesVersion: 0,
  currency: "usd",
  levels: [{ key: "starter", minCustomers: 0, ordinaryBudgetBps: 1000, memberBudgetBps: 2000 }],
  eligiblePlans: ["premium", "vip"],
  attributionWindowDays: 30,
  holdDays: 45,
  payoutThresholdMinor: 2500,
  payoutFees: { paypalServiceFeeBps: 2000, bankVnServiceFeeBps: 0 },
  termsVersion: "2026-10-31",
  invariant: "discountBps*10000 + (10000-discountBps)*commissionBps <= budgetBps*10000"
};
const balances = { pendingMinor: 0, heldMinor: 0, availableMinor: 1200, payout_lockedMinor: 0, paidMinor: 0 };
const summary = {
  affiliateId: "aff_1", status: "active", termsVersion: "2026-10-31", joinedAt: NOW, level: "starter", qualifyingCustomers: 0,
  nextLevel: { key: "builder", customersNeeded: 5 }, incentiveBasis: "member", budgetBps: 2000, balances, payoutMethod: null
};
const link = {
  id: "lnk_1", code: "duy-ships", url: `${API}/r/duy-ships`, label: null, discountBps: 1000, commissionBps: 1111,
  destinationPath: "/", utmCampaign: null, status: "active", version: 2, clicks: 3, conversions: 1, createdAt: NOW, updatedAt: NOW
};

function tool(name: string): McpToolDefinition {
  const found = TOOLS.find((t) => t.name === name);
  if (!found) throw new Error(`missing tool ${name}`);
  return found;
}

function mockFetch(body: unknown = { data: {} }, status = 200) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json(body, { status }));
}

function call(fetchFn: ReturnType<typeof mockFetch>, index = 0) {
  const [url, init] = fetchFn.mock.calls[index] as unknown as [string, RequestInit];
  return { url: new URL(url), init, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined };
}

function worker(fetchFn: ReturnType<typeof mockFetch>): ToolContext {
  return { workerAuth: true, env: ENV, fetch: fetchFn as unknown as typeof fetch };
}

async function failure(promise: Promise<unknown>): Promise<ToolError> {
  const err = await promise.then(() => undefined, (e: unknown) => e);
  expect(err).toBeInstanceOf(ToolError);
  return err as ToolError;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("affiliate MCP tool registry", () => {
  const member = [...AFFILIATE_MEMBER_READ_TOOLS, ...AFFILIATE_MEMBER_WRITE_TOOLS];
  const operator = [...AFFILIATE_OPERATOR_READ_TOOLS, ...AFFILIATE_OPERATOR_WRITE_TOOLS];

  it("registers exactly the member, public and operator tools", () => {
    const registered = TOOLS.map((t) => t.name).filter((name) => name.startsWith("affiliate_"));
    expect([...registered].sort()).toEqual(["affiliate_get_program", ...member, ...operator].sort());
  });

  it("never exposes payout-method, payee-detail, mark-paid, publish, adjust or approve tools", () => {
    const forbidden = /payout_method|details|reveal|mark_paid|paid$|publish|adjust|approve|decide|suspend|reinstate/;
    for (const t of TOOLS.filter((t) => t.name.startsWith("affiliate_"))) {
      expect(t.name).not.toMatch(forbidden);
      const props = Object.keys(t.inputSchema.properties);
      expect(props.filter((p) => /bank|account|iban|paypal|cccd|passport|tax|identity|approvalId/i.test(p))).toEqual([]);
    }
  });

  it("maps scopes: public program read, member reads mcp:read, member writes mcp:write, operator mcp:operator", () => {
    expect(requiredToolScope("affiliate_get_program")).toBe("mcp:read");
    expect([isPrivateReadTool("affiliate_get_program"), isMutatingTool("affiliate_get_program")]).toEqual([false, false]);
    for (const name of AFFILIATE_MEMBER_READ_TOOLS) {
      expect(requiredToolScope(name)).toBe("mcp:read");
      expect([isPrivateReadTool(name), isMutatingTool(name)]).toEqual([true, false]);
    }
    for (const name of AFFILIATE_MEMBER_WRITE_TOOLS) {
      expect(requiredToolScope(name)).toBe("mcp:write");
      expect(isMutatingTool(name)).toBe(true);
    }
    for (const name of AFFILIATE_OPERATOR_READ_TOOLS) {
      expect(requiredToolScope(name)).toBe("mcp:operator");
      expect([isPrivateReadTool(name), isMutatingTool(name)]).toEqual([true, false]);
    }
    for (const name of AFFILIATE_OPERATOR_WRITE_TOOLS) {
      expect(requiredToolScope(name)).toBe("mcp:operator");
      expect(isMutatingTool(name)).toBe(true);
    }
  });

  it("advertises reads and previews as read-only and permanent changes as destructive", async () => {
    const listed = await new McpServer().handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    const tools = Object.fromEntries((listed?.result as { tools: Array<{ name: string; annotations: Record<string, unknown> }> }).tools.map((t) => [t.name, t]));
    for (const name of ["affiliate_get_program", ...AFFILIATE_MEMBER_READ_TOOLS, ...AFFILIATE_OPERATOR_READ_TOOLS]) {
      expect(tools[name].annotations).toMatchObject({ readOnlyHint: true });
    }
    for (const name of ["affiliate_join", "affiliate_create_link", "affiliate_admin_hold_conversion", "affiliate_admin_release_conversion", "affiliate_admin_create_batch"]) {
      expect(tools[name].annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    }
    for (const name of ["affiliate_update_link", "affiliate_admin_cancel_batch"]) {
      expect(tools[name].annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    }
  });

  it("states units and owner-only writes in the descriptions", () => {
    for (const t of TOOLS.filter((t) => t.name.startsWith("affiliate_"))) {
      expect(t.description).toContain("minor units");
      expect(t.description).toContain("basis points");
    }
    for (const name of AFFILIATE_MEMBER_WRITE_TOOLS) expect(tool(name).description).toContain("owner-only");
    expect(tool("affiliate_join").description).toContain("never accept the agreement on the user's behalf");
  });
});

describe("affiliate scope gating per caller", () => {
  const server = new McpServer();
  const rpc = (name: string, args: Record<string, unknown>, context: ToolContext) =>
    server.handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, context);
  const oauth = (scopes: string[], fetchFn = mockFetch()): ToolContext => ({
    oauth: { subject: "user_1", scopes }, env: { NLB_API_URL: API }, fetch: fetchFn as unknown as typeof fetch
  });
  const resultText = (response: Awaited<ReturnType<typeof rpc>>) =>
    JSON.parse((response?.result as { content: Array<{ text: string }> }).content[0].text) as Record<string, unknown>;

  it("refuses OAuth callers without the tool's scope", async () => {
    expect((await rpc("affiliate_create_link", {}, oauth(["mcp:read"])))?.error?.message).toBe("Insufficient OAuth scope");
    expect((await rpc("affiliate_admin_list_batches", {}, oauth(["mcp:read", "mcp:write"])))?.error?.message).toBe("Insufficient OAuth scope");
    const fetchFn = mockFetch({ data: { batches: [] } });
    const allowed = await rpc("affiliate_admin_list_batches", {}, oauth(["mcp:read", "mcp:operator"], fetchFn));
    expect(allowed?.error).toBeUndefined();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(call(fetchFn).headers.Cookie).toBeUndefined();
  });

  it("refuses OAuth callers that try to pass credentials", async () => {
    const fetchFn = mockFetch();
    expect(resultText(await rpc("affiliate_get_me", { api_key: "nlb_live_x" }, oauth(["mcp:read"], fetchFn))).error).toMatch(/cannot override/);
    expect(resultText(await rpc("affiliate_admin_get_rules", { session_cookie: "c" }, oauth(["mcp:read", "mcp:operator"], fetchFn))).error).toMatch(/cannot override/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("lets anonymous HTTP callers read only the public program", async () => {
    const fetchFn = mockFetch({ data: program });
    const anonymous: ToolContext = { workerAuth: false, env: ENV, fetch: fetchFn as unknown as typeof fetch };
    expect((await rpc("affiliate_get_program", {}, anonymous))?.error).toBeUndefined();
    for (const name of ["affiliate_get_me", "affiliate_join", "affiliate_admin_get_rules", "affiliate_admin_create_batch"]) {
      expect((await rpc(name, {}, anonymous))?.error?.code).toBe(-32001);
    }
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("returns structured error data for API failures", async () => {
    const fetchFn = mockFetch({ error: { code: "over_budget", message: "Too much" } }, 422);
    const response = await rpc("affiliate_create_link", { discountBps: 3000 }, { workerAuth: true, env: ENV, fetch: fetchFn as unknown as typeof fetch });
    expect((response?.result as { isError: boolean }).isError).toBe(true);
    expect(resultText(response)).toMatchObject({ status: 422, code: "over_budget" });
  });
});

describe("affiliate member tools", () => {
  it("reads the public program without sending any credential", async () => {
    const fetchFn = mockFetch({ data: program });
    const result = await tool("affiliate_get_program").handler({}, { workerAuth: false, env: ENV, fetch: fetchFn as unknown as typeof fetch });
    expect(result).toEqual({ data: program });
    const sent = call(fetchFn);
    expect(sent.url.toString()).toBe(`${API}/api/v1/affiliates/program`);
    expect(sent.headers.Authorization).toBeUndefined();
    expect(sent.headers["x-api-key"]).toBeUndefined();
  });

  it("refuses anonymous Worker callers before any member request", async () => {
    const fetchFn = mockFetch();
    const err = await failure(tool("affiliate_get_me").handler({}, { workerAuth: false, env: ENV, fetch: fetchFn as unknown as typeof fetch }));
    expect(err.data.status).toBe(401);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    ["affiliate_get_me", {}, { data: summary }, "GET", "/api/v1/affiliates/me", {}],
    ["affiliate_preview_incentive", { discountBps: 1000, priceMinor: 4900 }, { data: { budgetBps: 2000, discountBps: 1000, commissionBps: 1111, withinBudget: true } }, "GET", "/api/v1/affiliates/preview", { discountBps: "1000", priceMinor: "4900" }],
    ["affiliate_list_links", {}, { data: { links: [link] } }, "GET", "/api/v1/affiliates/links", {}],
    ["affiliate_list_conversions", { limit: 10 }, { data: { conversions: [] } }, "GET", "/api/v1/affiliates/conversions", { limit: "10" }],
    ["affiliate_get_commissions", { limit: 5 }, { data: { balances, ledger: [] } }, "GET", "/api/v1/affiliates/commissions", { limit: "5" }],
    ["affiliate_list_payouts", {}, { data: { payouts: [] } }, "GET", "/api/v1/affiliates/payouts", {}]
  ])("%s calls the member route with the API key", async (name, args, body, method, path, query) => {
    const fetchFn = mockFetch(body);
    expect(await tool(name).handler(args, worker(fetchFn))).toEqual(body);
    const sent = call(fetchFn);
    expect(sent.init.method).toBe(method);
    expect(sent.url.pathname).toBe(path);
    expect(Object.fromEntries(sent.url.searchParams)).toEqual(query);
    expect(sent.headers).toMatchObject({ Authorization: "Bearer nlb_live_member", "x-api-key": "nlb_live_member" });
    expect(sent.headers.Cookie).toBeUndefined();
  });

  it("joins with the accepted terms version and an idempotency key", async () => {
    const fetchFn = mockFetch({ data: summary }, 201);
    await tool("affiliate_join").handler({ termsVersion: "2026-10-31", idempotency_key: "join-1" }, worker(fetchFn));
    const sent = call(fetchFn);
    expect(sent.init.method).toBe("POST");
    expect(sent.url.pathname).toBe("/api/v1/affiliates/me");
    expect(sent.body).toEqual({ termsVersion: "2026-10-31" });
    expect(sent.headers["Idempotency-Key"]).toBe("join-1");

    const missing = await failure(tool("affiliate_join").handler({}, worker(fetchFn)));
    expect(missing.data.details).toEqual([{ path: "termsVersion", message: "Required" }]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("creates and updates links with API field names in the body and the id in the path", async () => {
    const fetchFn = mockFetch({ data: link });
    await tool("affiliate_create_link").handler({ code: "duy-ships", discountBps: 1000, destinationPath: "/courses", utmCampaign: "launch" }, worker(fetchFn));
    expect(call(fetchFn)).toMatchObject({ url: new URL(`${API}/api/v1/affiliates/links`), body: { code: "duy-ships", discountBps: 1000, destinationPath: "/courses", utmCampaign: "launch" } });
    expect(call(fetchFn).headers["Idempotency-Key"]).toMatch(/[0-9a-f-]{36}/);

    await tool("affiliate_update_link").handler({ link_id: "lnk/1", discountBps: 500, expectedVersion: 2 }, worker(fetchFn));
    const update = call(fetchFn, 1);
    expect(update.init.method).toBe("PATCH");
    expect(update.url.pathname).toBe("/api/v1/affiliates/links/lnk%2F1");
    expect(update.body).toEqual({ discountBps: 500, expectedVersion: 2 });

    await tool("affiliate_update_link").handler({ link_id: "lnk_1", label: null }, worker(fetchFn));
    expect(call(fetchFn, 2).body).toEqual({ label: null });
  });

  it("validates arguments locally before any request", async () => {
    const fetchFn = mockFetch();
    const cases: Array<[string, Record<string, unknown>]> = [
      ["affiliate_preview_incentive", { discountBps: 9500 }],
      ["affiliate_preview_incentive", { discountBps: 12.5 }],
      ["affiliate_preview_incentive", {}],
      ["affiliate_create_link", { code: "ab" }],
      ["affiliate_create_link", { code: "Bad--Code" }],
      ["affiliate_create_link", { destinationPath: "https://evil.example" }],
      ["affiliate_create_link", { commissionBps: 5000 }],
      ["affiliate_update_link", { link_id: "lnk_1" }],
      ["affiliate_update_link", { link_id: "lnk_1", expectedVersion: 2 }],
      ["affiliate_update_link", { link_id: "lnk_1", status: "deleted" }],
      ["affiliate_list_conversions", { limit: 0 }],
      ["affiliate_get_me", { session_cookie: "c" }],
      ["affiliate_list_payouts", { payoutMethod: { iban: "x" } }]
    ];
    for (const [name, args] of cases) {
      const err = await failure(tool(name).handler(args, worker(fetchFn)));
      expect(err.message).toContain(`Invalid arguments for ${name}`);
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("explains a disabled program, enrolment and budget errors", async () => {
    const off = await failure(tool("affiliate_list_links").handler({}, worker(mockFetch({ error: { code: "not_found", message: "Not found" } }, 404))));
    expect(off.data).toMatchObject({ status: 404, notEnabled: true });
    expect(off.message).toContain("AFFILIATES_ENABLED is off");

    const notEnrolled = await failure(tool("affiliate_get_me").handler({}, worker(mockFetch({ error: { code: "not_enrolled", message: "Join first" } }, 404))));
    expect(notEnrolled.data).toMatchObject({ status: 404, code: "not_enrolled", notEnabled: false });
    expect(String(notEnrolled.data.hint)).toContain("termsVersion");

    const over = await failure(tool("affiliate_create_link").handler({ discountBps: 3000 }, worker(mockFetch({ error: { code: "over_budget", message: "Too much" } }, 422))));
    expect(over.data).toMatchObject({ status: 422, code: "over_budget" });

    const missingLink = await failure(tool("affiliate_update_link").handler({ link_id: "x", label: "a" }, worker(mockFetch({ error: { code: "not_found", message: "Link not found" } }, 404))));
    expect(missingLink.data.notEnabled).toBe(false);

    const unauthorized = await failure(tool("affiliate_get_me").handler({}, worker(mockFetch({ error: { code: "unauthenticated", message: "no" } }, 401))));
    expect(String(unauthorized.data.hint)).toContain("API key");
  });

  it("rejects a response that does not match the contract", async () => {
    const err = await tool("affiliate_get_me").handler({}, worker(mockFetch({ data: { affiliateId: 1 } }))).then(() => undefined, (e: Error) => e);
    expect(String(err)).toContain("schema mismatch");
  });
});

describe("affiliate operator tools", () => {
  it("refuses anonymous Worker callers before any request", async () => {
    const fetchFn = mockFetch();
    const err = await failure(tool("affiliate_admin_list_batches").handler({}, { workerAuth: false, env: ENV, fetch: fetchFn as unknown as typeof fetch }));
    expect(err.data.status).toBe(401);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("sends the operator session cookie and never the configured API key", async () => {
    const fetchFn = mockFetch({ data: { conversions: [] } });
    await tool("affiliate_admin_list_conversions").handler({ status: "held", limit: 20, session_cookie: "better-auth.session_token=abc" }, worker(fetchFn));
    const sent = call(fetchFn);
    expect(sent.url.pathname).toBe("/api/v1/affiliate-admin/conversions");
    expect(Object.fromEntries(sent.url.searchParams)).toEqual({ status: "held", limit: "20" });
    expect(sent.headers.Cookie).toBe("better-auth.session_token=abc");
    expect(sent.headers.Authorization).toBeUndefined();
    expect(sent.headers["x-api-key"]).toBeUndefined();

    const refused = await failure(tool("affiliate_admin_get_rules").handler({ api_key: "nlb_live_member" }, worker(fetchFn)));
    expect(refused.message).toContain("Invalid arguments");
  });

  const rules = {
    currency: "usd",
    levels: [{ key: "starter", minCustomers: 0, ordinaryBudgetBps: 1000, memberBudgetBps: 2000 }],
    eligiblePlans: ["premium"],
    attributionWindowDays: 30,
    holdDays: 45,
    payoutThresholdMinor: 2500,
    paypalServiceFeeBps: 2000,
    bankVnServiceFeeBps: 0,
    withholding: { vnIndividualBps: null, vnBusinessBps: null, otherBps: 0 },
    termsVersion: "2026-10-31"
  };

  const NOW = "2026-10-31T00:00:00.000Z";
  const batch = {
    id: "b1", period: "2026-09", currency: "usd", status: "draft", rulesVersion: 1, thresholdMinor: 2500,
    createdBy: "op_1", approvedBy: null, approvedAt: null, cancelledAt: null, createdAt: NOW
  };
  const batchDetail = { ...batch, totals: { items: 0, grossMinor: 0, netMinor: 0 }, items: [] };
  const conversion = {
    id: "c1", affiliateId: "aff_1", buyerUserId: "u_2", polarOrderId: "ord_1", plan: "premium", currency: "usd", netMinor: 4900,
    discountMinor: 0, commissionBps: 1000, commissionMinor: 490, refundedNetMinor: 0, status: "held", holdReason: "dispute", paidAt: NOW, maturesAt: NOW
  };
  const account = {
    affiliateId: "aff_1", userId: "u_1", status: "active", suspendedReason: null, termsVersion: "2026-10-31", joinedAt: NOW,
    level: "starter", qualifyingCustomers: 0, incentiveBasis: "ordinary", budgetBps: 1000, balances
  };
  const programView = {
    rulesVersion: 1, currency: "usd", levels: rules.levels, eligiblePlans: ["premium"], attributionWindowDays: 30, holdDays: 45,
    payoutThresholdMinor: 2500, payoutFees: { paypalServiceFeeBps: 2000, bankVnServiceFeeBps: 0 }, termsVersion: "2026-10-31", invariant: "x"
  };

  it.each([
    ["affiliate_admin_get_rules", {}, "GET", "/api/v1/affiliate-admin/rules", {}, undefined, { version: 1, rules, program: programView }],
    ["affiliate_admin_preview_rules", { rules }, "POST", "/api/v1/affiliate-admin/rules/preview", {}, { rules }, { valid: true, currentVersion: 1, nextVersion: 2, rules, levels: [{ key: "starter" }] }],
    ["affiliate_admin_list_affiliates", { status: "active", limit: 50 }, "GET", "/api/v1/affiliate-admin/affiliates", { status: "active", limit: "50" }, undefined, { affiliates: [account] }],
    ["affiliate_admin_list_conversions", { status: "held" }, "GET", "/api/v1/affiliate-admin/conversions", { status: "held" }, undefined, { conversions: [conversion] }],
    ["affiliate_admin_preview_payouts", { period: "2026-09" }, "GET", "/api/v1/affiliate-admin/payouts/preview", { period: "2026-09" }, undefined, { period: "2026-09", affiliates: [] }],
    ["affiliate_admin_list_batches", {}, "GET", "/api/v1/affiliate-admin/payouts/batches", {}, undefined, { batches: [batch] }],
    ["affiliate_admin_get_batch", { batch_id: "b1" }, "GET", "/api/v1/affiliate-admin/payouts/batches/b1", {}, undefined, batchDetail],
    ["affiliate_admin_create_batch", { period: "2026-09" }, "POST", "/api/v1/affiliate-admin/payouts/batches", {}, { period: "2026-09" }, batchDetail],
    ["affiliate_admin_cancel_batch", { batch_id: "b1" }, "POST", "/api/v1/affiliate-admin/payouts/batches/b1/cancel", {}, undefined, { ...batch, status: "cancelled", cancelledAt: NOW }],
    ["affiliate_admin_hold_conversion", { conversion_id: "c1", reason: "dispute" }, "POST", "/api/v1/affiliate-admin/conversions/c1/hold", {}, { reason: "dispute" }, conversion],
    ["affiliate_admin_release_conversion", { conversion_id: "c1" }, "POST", "/api/v1/affiliate-admin/conversions/c1/release", {}, undefined, { ...conversion, status: "pending", holdReason: null }],
    ["affiliate_admin_reconciliation", { since: "2026-09-01", until: "2026-10-01T00:00:00Z" }, "GET", "/api/v1/affiliate-admin/reconciliation", { since: "2026-09-01", until: "2026-10-01T00:00:00Z" }, undefined, { checks: {} }]
  ])("%s maps to its operator route and validates the response", async (name, args, method, path, query, body, data) => {
    const fetchFn = mockFetch({ data });
    await expect(tool(name).handler(args, worker(fetchFn))).resolves.toEqual({ data });
    const sent = call(fetchFn);
    expect(sent.init.method).toBe(method);
    expect(sent.url.pathname).toBe(path);
    expect(Object.fromEntries(sent.url.searchParams)).toEqual(query);
    expect(sent.body).toEqual(body);
  });

  it("lists approvals as a paginated array", async () => {
    const page = { data: [{ id: "ap_1", status: "pending" }], pagination: { nextCursor: null, limit: 50 } };
    const fetchFn = mockFetch(page);
    await expect(tool("affiliate_admin_list_approvals").handler({ status: "pending", cursor: "abc" }, worker(fetchFn))).resolves.toEqual(page);
    expect(Object.fromEntries(call(fetchFn).url.searchParams)).toEqual({ status: "pending", cursor: "abc" });
  });

  it("rejects operator responses that are not in the wrapped contract shape", async () => {
    for (const [name, data] of [
      ["affiliate_admin_list_affiliates", [account]],
      ["affiliate_admin_list_conversions", [conversion]],
      ["affiliate_admin_list_batches", [batch]],
      ["affiliate_admin_get_batch", batch]
    ] as const) {
      const err = await tool(name).handler(name === "affiliate_admin_get_batch" ? { batch_id: "b1" } : {}, worker(mockFetch({ data }))).then(() => undefined, (e: Error) => e);
      expect(err?.message, name).toContain("schema mismatch");
    }
  });

  it("validates operator arguments locally", async () => {
    const fetchFn = mockFetch();
    const cases: Array<[string, Record<string, unknown>]> = [
      ["affiliate_admin_preview_payouts", { period: "2026-13" }],
      ["affiliate_admin_create_batch", {}],
      ["affiliate_admin_hold_conversion", { conversion_id: "c1" }],
      ["affiliate_admin_hold_conversion", { conversion_id: "c1", reason: "   " }],
      ["affiliate_admin_preview_rules", { rules: { currency: "usd" } }],
      ["affiliate_admin_reconciliation", { since: "yesterday" }],
      ["affiliate_admin_cancel_batch", { batch_id: "b1", approvalId: "ap_1" }]
    ];
    for (const [name, args] of cases) {
      const err = await failure(tool(name).handler(args, worker(fetchFn)));
      expect(err.message).toContain(`Invalid arguments for ${name}`);
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("surfaces operator denials with a hint and keeps 404 as not found", async () => {
    const denied = await failure(tool("affiliate_admin_list_batches").handler({}, worker(mockFetch({ error: { code: "not_operator", message: "Operator access required" } }, 403))));
    expect(denied.message).toContain("HTTP 403 not_operator");
    expect(String(denied.data.hint)).toContain("session cookie");

    const missing = await failure(tool("affiliate_admin_get_batch").handler({ batch_id: "nope" }, worker(mockFetch({ error: { code: "not_found", message: "Batch not found" } }, 404))));
    expect(missing.data).toMatchObject({ status: 404, notEnabled: false });
    expect(missing.message).toContain("Batch not found");
  });
});
