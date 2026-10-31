import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../src/cli.js";
import { AffiliateInputError, NlbAffiliateClient } from "../src/api/affiliate-client.js";

const BASE = "https://staging.nextlevelbuilder.io";
const KEY = "nlb_live_affiliatetest";
const NOW = "2026-10-31T00:00:00.000Z";

const program = {
  rulesVersion: 0, currency: "usd", levels: [{ key: "starter", minCustomers: 0, ordinaryBudgetBps: 1000, memberBudgetBps: 2000 }],
  eligiblePlans: ["premium", "vip"], attributionWindowDays: 30, holdDays: 45, payoutThresholdMinor: 2500,
  payoutFees: { paypalServiceFeeBps: 2000, bankVnServiceFeeBps: 0 }, termsVersion: "2026-10-31", invariant: "x"
};
const balances = { pendingMinor: 0, heldMinor: 0, availableMinor: 0, payout_lockedMinor: 0, paidMinor: 0 };
const summary = {
  affiliateId: "aff_1", status: "active", termsVersion: "2026-10-31", joinedAt: NOW, level: "starter", qualifyingCustomers: 0,
  nextLevel: null, incentiveBasis: "ordinary", budgetBps: 1000, balances, payoutMethod: null
};
const link = {
  id: "lnk_1", code: "duy-ships", url: `${BASE}/r/duy-ships`, label: null, discountBps: 500, commissionBps: 526,
  destinationPath: "/", utmCampaign: null, status: "active", version: 1, clicks: 0, conversions: 0, createdAt: NOW, updatedAt: NOW
};

function mockFetch(body: unknown, status = 200) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json(body, { status }));
}

function call(fetchFn: ReturnType<typeof mockFetch>, index = 0) {
  const [url, init] = fetchFn.mock.calls[index] as unknown as [string, RequestInit];
  return { url: new URL(url), init, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined };
}

async function run(args: string[], fetchFn: ReturnType<typeof mockFetch>) {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  await createProgram({ affiliates: { fetchFn: fetchFn as unknown as typeof fetch } })
    .parseAsync(["node", "nlb", "affiliates", ...args, "--api-key", KEY, "--url", BASE]);
  return { log, err, json: () => JSON.parse(String(log.mock.calls[0]?.[0])) };
}

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = 0;
});

describe("nlb affiliates", () => {
  it.each([
    [["program"], { data: program }, "GET", "/api/v1/affiliates/program", {}],
    [["me"], { data: summary }, "GET", "/api/v1/affiliates/me", {}],
    [["preview", "--discount-bps", "1000", "--price-minor", "4900"], { data: { budgetBps: 2000, discountBps: 1000, commissionBps: 1111, withinBudget: true } }, "GET", "/api/v1/affiliates/preview", { discountBps: "1000", priceMinor: "4900" }],
    [["links", "list"], { data: { links: [link] } }, "GET", "/api/v1/affiliates/links", {}],
    [["conversions", "--limit", "10"], { data: { conversions: [] } }, "GET", "/api/v1/affiliates/conversions", { limit: "10" }],
    [["commissions"], { data: { balances, ledger: [] } }, "GET", "/api/v1/affiliates/commissions", {}],
    [["payouts"], { data: { payouts: [] } }, "GET", "/api/v1/affiliates/payouts", {}]
  ])("%j calls its member route", async (args, body, method, path, query) => {
    const fetchFn = mockFetch(body);
    const { json } = await run([...args, "--json"], fetchFn);
    expect(json()).toEqual(body);
    const sent = call(fetchFn);
    expect(sent.init.method).toBe(method);
    expect(sent.url.pathname).toBe(path);
    expect(Object.fromEntries(sent.url.searchParams)).toEqual(query);
    if (path.endsWith("/program")) expect(sent.headers.Authorization).toBeUndefined();
    else expect(sent.headers).toMatchObject({ Authorization: `Bearer ${KEY}` });
  });

  it("joins only with an explicit terms version", async () => {
    const fetchFn = mockFetch({ data: summary }, 201);
    await run(["join", "--terms-version", "2026-10-31", "--json"], fetchFn);
    expect(call(fetchFn)).toMatchObject({ body: { termsVersion: "2026-10-31" } });
    expect(call(fetchFn).init.method).toBe("POST");
    expect(call(fetchFn).headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("creates and updates links from flags", async () => {
    const fetchFn = mockFetch({ data: link });
    await run(["links", "create", "--code", "duy-ships", "--discount-bps", "500", "--destination", "/courses", "--json"], fetchFn);
    expect(call(fetchFn)).toMatchObject({ url: new URL(`${BASE}/api/v1/affiliates/links`), body: { code: "duy-ships", discountBps: 500, destinationPath: "/courses" } });

    await run(["links", "update", "lnk_1", "--status", "paused", "--expected-version", "1", "--label", "", "--json"], fetchFn);
    const update = call(fetchFn, 1);
    expect(update.init.method).toBe("PATCH");
    expect(update.url.pathname).toBe("/api/v1/affiliates/links/lnk_1");
    expect(update.body).toEqual({ status: "paused", expectedVersion: 1, label: "" });
  });

  it("refuses invalid input locally with exit code 1", async () => {
    const fetchFn = mockFetch({ data: link });
    const { json } = await run(["links", "update", "lnk_1", "--expected-version", "2", "--json"], fetchFn);
    expect(json()).toMatchObject({ success: false });
    expect(json().error).toContain("at least one");
    expect(fetchFn).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("explains a disabled program and over-budget discounts", async () => {
    const off = await run(["links", "list", "--json"], mockFetch({ error: { code: "not_found", message: "Not found" } }, 404));
    expect(off.json()).toMatchObject({ success: false, status: 404, notEnabled: true });
    off.log.mockRestore();
    off.err.mockRestore();

    const over = await run(["links", "create", "--discount-bps", "3000"], mockFetch({ error: { code: "over_budget", message: "Too much" } }, 422));
    expect(over.err.mock.calls.flat().join("\n")).toContain("Lower discountBps");
    expect(process.exitCode).toBe(1);
  });

  it("accepts the singular 'affiliate' command and 'status' for 'me'", async () => {
    const fetchFn = mockFetch({ data: summary });
    vi.spyOn(console, "log").mockImplementation(() => {});
    await createProgram({ affiliates: { fetchFn: fetchFn as unknown as typeof fetch } })
      .parseAsync(["node", "nlb", "affiliate", "status", "--api-key", KEY, "--url", BASE, "--json"]);
    expect(call(fetchFn).url.pathname).toBe("/api/v1/affiliates/me");
    expect(process.exitCode ?? 0).toBe(0);
  });

  it("offers no payout-method or operator commands", () => {
    const affiliates = createProgram().commands.find((c) => c.name() === "affiliates");
    const names = (affiliates?.commands ?? []).flatMap((c) => [c.name(), ...c.commands.map((s) => `${c.name()} ${s.name()}`)]);
    expect(names.sort()).toEqual(["commissions", "conversions", "join", "links", "links create", "links list", "links update", "me", "payouts", "preview", "program"]);
  });
});

describe("NlbAffiliateClient", () => {
  it("needs a credential for private routes and validates responses", async () => {
    const fetchFn = mockFetch({ data: summary });
    await expect(new NlbAffiliateClient({ baseUrl: BASE, fetchFn: fetchFn as unknown as typeof fetch }).getMe()).rejects.toThrow(/Sign-in required/);
    expect(fetchFn).not.toHaveBeenCalled();
    const bad = new NlbAffiliateClient({ baseUrl: BASE, apiKey: KEY, fetchFn: mockFetch({ data: { budgetBps: "lots" } }) as unknown as typeof fetch });
    await expect(bad.getMe()).rejects.toThrow(/schema mismatch/);
  });

  it("never sends a session cookie to a foreign origin", async () => {
    const client = new NlbAffiliateClient({ baseUrl: "https://evil.example", sessionCookie: "c=1", fetchFn: mockFetch({ data: summary }) as unknown as typeof fetch });
    await expect(client.getMe()).rejects.toThrow(/Refusing to send the session cookie/);
  });

  it("rejects an invalid link before any request", () => {
    const client = new NlbAffiliateClient({ baseUrl: BASE, apiKey: KEY, fetchFn: mockFetch({}) as unknown as typeof fetch });
    expect(() => client.createLink({ code: "x" })).toThrow(AffiliateInputError);
  });
});
