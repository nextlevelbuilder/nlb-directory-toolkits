import { describe, expect, it } from "vitest";
import {
  AFFILIATES_NOT_ENABLED_MESSAGE,
  AffiliateAdminAffiliatesResponseSchema,
  AffiliateAdminBatchDetailResponseSchema,
  AffiliateAdminBatchesResponseSchema,
  AffiliateAdminReconciliationQuerySchema,
  AffiliateHoldInputSchema,
  AffiliatePreviewResponseSchema,
  AffiliateJoinInputSchema,
  AffiliateLinkCreateInputSchema,
  AffiliateLinkUpdateInputSchema,
  AffiliatePayoutPeriodSchema,
  AffiliatePreviewQuerySchema,
  AffiliateSummaryResponseSchema,
  describeAffiliateApiFailure
} from "../src/index.js";

const errorBody = (code: string, message = "Server says no.") => JSON.stringify({ error: { code, message } });

describe("affiliate request schemas", () => {
  it("requires a terms version to join and nothing else", () => {
    expect(AffiliateJoinInputSchema.safeParse({ termsVersion: "2026-10-31" }).success).toBe(true);
    expect(AffiliateJoinInputSchema.safeParse({}).success).toBe(false);
    expect(AffiliateJoinInputSchema.safeParse({ termsVersion: " " }).success).toBe(false);
    expect(AffiliateJoinInputSchema.safeParse({ termsVersion: "2026-10-31", status: "active" }).success).toBe(false);
  });

  it("accepts valid link codes, discounts and landing paths and refuses the rest", () => {
    expect(AffiliateLinkCreateInputSchema.safeParse({}).success).toBe(true);
    expect(AffiliateLinkCreateInputSchema.safeParse({ code: "duy-ships", discountBps: 1500, destinationPath: "/vi/courses#pricing", utmCampaign: "launch_1" }).success).toBe(true);
    for (const bad of [
      { code: "ab" },
      { code: "-abc" },
      { code: "a--bc" },
      { code: "ABCD" },
      { discountBps: 9001 },
      { discountBps: -1 },
      { discountBps: 10.5 },
      { destinationPath: "//evil.example" },
      { destinationPath: "https://evil.example" },
      { destinationPath: "/courses?x=1" },
      { utmCampaign: "Has Space" },
      { commissionBps: 1000 },
      { affiliateId: "someone-else" }
    ]) {
      expect(AffiliateLinkCreateInputSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("needs at least one real change in a link update", () => {
    expect(AffiliateLinkUpdateInputSchema.safeParse({}).success).toBe(false);
    expect(AffiliateLinkUpdateInputSchema.safeParse({ expectedVersion: 3 }).success).toBe(false);
    expect(AffiliateLinkUpdateInputSchema.safeParse({ status: "paused", expectedVersion: 3 }).success).toBe(true);
    expect(AffiliateLinkUpdateInputSchema.safeParse({ label: null }).success).toBe(true);
    expect(AffiliateLinkUpdateInputSchema.safeParse({ code: "new-code" }).success).toBe(false);
    expect(AffiliateLinkUpdateInputSchema.safeParse({ status: "deleted" }).success).toBe(false);
  });

  it("validates preview, period and reconciliation inputs", () => {
    expect(AffiliatePreviewQuerySchema.safeParse({ discountBps: 1000, priceMinor: 4900 }).success).toBe(true);
    expect(AffiliatePreviewQuerySchema.safeParse({ priceMinor: 4900 }).success).toBe(false);
    expect(AffiliatePayoutPeriodSchema.safeParse("2026-10").success).toBe(true);
    for (const bad of ["2026-13", "2026-1", "26-10", "2026-10-01"]) expect(AffiliatePayoutPeriodSchema.safeParse(bad).success).toBe(false);
    expect(AffiliateAdminReconciliationQuerySchema.safeParse({ since: "2026-09-01", until: "2026-10-01T00:00:00Z" }).success).toBe(true);
    expect(AffiliateAdminReconciliationQuerySchema.safeParse({ since: "last week" }).success).toBe(false);
  });
});

describe("affiliate response schemas", () => {
  it("accepts the member summary read model", () => {
    const summary = {
      affiliateId: "aff_1", status: "active", termsVersion: "2026-10-31", joinedAt: "2026-10-31T00:00:00.000Z", level: "starter",
      qualifyingCustomers: 0, nextLevel: null, incentiveBasis: "ordinary", budgetBps: 1000,
      balances: { pendingMinor: 0, heldMinor: 0, availableMinor: 0, payout_lockedMinor: 0, paidMinor: 0 },
      payoutMethod: { id: "pm_1", type: "paypal", displayHint: "d***@example.com", payeeType: "individual", residency: "other", createdAt: "2026-10-31T00:00:00.000Z" }
    };
    expect(AffiliateSummaryResponseSchema.safeParse({ data: summary }).success).toBe(true);
    expect(AffiliateSummaryResponseSchema.safeParse({ data: { ...summary, budgetBps: 1.5 } }).success).toBe(false);
  });
});

describe("affiliate operator and preview response shapes", () => {
  const NOW = "2026-10-31T00:00:00.000Z";
  const batch = {
    id: "b1", period: "2026-09", currency: "usd", status: "draft", rulesVersion: 1, thresholdMinor: 2500,
    createdBy: "op_1", approvedBy: null, approvedAt: null, cancelledAt: null, createdAt: NOW
  };

  it("expects operator lists wrapped in a named array", () => {
    expect(AffiliateAdminBatchesResponseSchema.safeParse({ data: { batches: [batch] } }).success).toBe(true);
    expect(AffiliateAdminBatchesResponseSchema.safeParse({ data: [batch] }).success).toBe(false);
    expect(AffiliateAdminAffiliatesResponseSchema.safeParse({ data: { affiliates: [] } }).success).toBe(true);
    expect(AffiliateAdminAffiliatesResponseSchema.safeParse({ data: [] }).success).toBe(false);
  });

  it("requires totals and items on a batch detail", () => {
    expect(AffiliateAdminBatchDetailResponseSchema.safeParse({ data: { ...batch, totals: { items: 0, grossMinor: 0, netMinor: 0 }, items: [] } }).success).toBe(true);
    expect(AffiliateAdminBatchDetailResponseSchema.safeParse({ data: batch }).success).toBe(false);
  });

  it("accepts a preview without the worked example and a hold reason of 3-300 characters", () => {
    expect(AffiliatePreviewResponseSchema.safeParse({ data: { budgetBps: 1000, discountBps: 2000, commissionBps: 0, withinBudget: false } }).success).toBe(true);
    expect(AffiliateHoldInputSchema.safeParse({ reason: "ok" }).success).toBe(false);
    expect(AffiliateHoldInputSchema.safeParse({ reason: "fraud review" }).success).toBe(true);
    expect(AffiliateHoldInputSchema.safeParse({ reason: "x".repeat(301) }).success).toBe(false);
  });
});

describe("describeAffiliateApiFailure", () => {
  it("reads a member collection 404 as the program being switched off", () => {
    const failure = describeAffiliateApiFailure(404, errorBody("not_found", "Not found"));
    expect(failure).toMatchObject({ status: 404, code: "not_found", notEnabled: true });
    expect(failure.message).toContain(AFFILIATES_NOT_ENABLED_MESSAGE);
  });

  it("keeps item and operator 404s as not found", () => {
    expect(describeAffiliateApiFailure(404, errorBody("not_found"), "", { resource: true })).toMatchObject({ notEnabled: false });
    const operator = describeAffiliateApiFailure(404, errorBody("not_found", "Batch not found"), "", { operator: true });
    expect(operator).toMatchObject({ notEnabled: false });
    expect(operator.message).toBe("HTTP 404 not_found: Batch not found");
  });

  it("adds a remedy for known codes and survives non-JSON bodies", () => {
    expect(describeAffiliateApiFailure(404, errorBody("not_enrolled")).hint).toContain("termsVersion");
    expect(describeAffiliateApiFailure(409, errorBody("conflict")).hint).toContain("expectedVersion");
    expect(describeAffiliateApiFailure(403, errorBody("session_required")).hint).toContain("browser session");
    expect(describeAffiliateApiFailure(502, "<html>bad gateway</html>", "Bad Gateway")).toMatchObject({ status: 502, notEnabled: false, message: "HTTP 502: <html>bad gateway</html>" });
  });
});
