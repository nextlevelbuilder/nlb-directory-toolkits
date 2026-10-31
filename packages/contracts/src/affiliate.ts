import { z } from "zod";

/**
 * Affiliate program API payloads (`/api/v1/affiliates/*` for members, `/api/v1/affiliate-admin/*` for
 * finance operators) shared by the CLI and MCP. Vocabularies mirror `lib/referrals/types.ts` and shapes
 * mirror the read models in `lib/referrals/affiliate-read-models.ts`.
 *
 * Units: every money field ends in `Minor` and is an integer in minor units of the program currency
 * (USD cents by default). Every rate ends in `Bps` and is integer basis points (10000 = 100%).
 *
 * Deliberately absent: payout-method input, payee details, mark-paid, rule publishing, balance
 * adjustments and batch approval. Those are signed-in, human-only actions on the website.
 */

export const AFFILIATE_STATUSES = ["active", "suspended"] as const;
export const AFFILIATE_LINK_STATUSES = ["active", "paused", "archived"] as const;
export const AFFILIATE_CONVERSION_STATUSES = ["pending", "available", "held", "reversed"] as const;
export const AFFILIATE_LEDGER_BUCKETS = ["pending", "held", "available", "payout_locked", "paid"] as const;
export const AFFILIATE_LEDGER_KINDS = [
  "accrual", "maturation", "hold", "release", "reversal", "adjustment", "payout_lock", "payout_unlock", "payout_paid",
] as const;
export const AFFILIATE_INCENTIVE_BASES = ["ordinary", "member"] as const;
export const AFFILIATE_PAYOUT_METHOD_TYPES = ["paypal", "bank_vn"] as const;
export const AFFILIATE_PAYOUT_BATCH_STATUSES = ["draft", "approved", "paid", "cancelled"] as const;
export const AFFILIATE_PAYOUT_ITEM_STATUSES = ["pending", "paid", "cancelled"] as const;
export const AFFILIATE_APPROVAL_STATUSES = ["pending", "approved", "rejected", "consumed", "expired"] as const;

/** 10000 basis points = 100%. */
export const AFFILIATE_BPS = 10_000;
/** Highest buyer discount a link may carry (the affiliate's budget usually caps it lower). */
export const AFFILIATE_MAX_DISCOUNT_BPS = 9_000;

const minor = z.number().int();
const nonNegativeMinor = z.number().int().nonnegative();
const bps = z.number().int().min(0).max(AFFILIATE_BPS);
const isoDate = z.string().datetime({ offset: true });
const count = z.number().int().nonnegative();

// ---------------------------------------------------------------------------
// Inputs (member)
// ---------------------------------------------------------------------------

/** Link code: 4-32 lowercase letters, digits and single hyphens, not starting or ending with a hyphen. */
export const AffiliateLinkCodeSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{2,30})[a-z0-9]$/, "code must be 4-32 lowercase letters, digits or hyphens")
  .refine((code) => !code.includes("--"), "code cannot contain consecutive hyphens");
/** Same-origin landing path such as `/`, `/vi`, `/courses`, `/live/...`, `/blog/...` or `/affiliates#faq`. */
export const AffiliateDestinationPathSchema = z
  .string()
  .max(200)
  .regex(/^\/(?!\/)[^?\\]*$/, "destinationPath must be a site path without a query");
export const AffiliateUtmCampaignSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, "utmCampaign must be a short lowercase slug");
export const AffiliateDiscountBpsSchema = z.number().int().min(0).max(AFFILIATE_MAX_DISCOUNT_BPS);

/** POST /api/v1/affiliates/me: the Affiliate Agreement version the user accepted (see the program's termsVersion). */
export const AffiliateJoinInputSchema = z.object({ termsVersion: z.string().trim().min(1).max(40) }).strict();

/** POST /api/v1/affiliates/links. Omitting `code` lets the server pick a random one. */
export const AffiliateLinkCreateInputSchema = z
  .object({
    code: AffiliateLinkCodeSchema.optional(),
    label: z.string().max(80).optional(),
    discountBps: AffiliateDiscountBpsSchema.optional(),
    destinationPath: AffiliateDestinationPathSchema.optional(),
    utmCampaign: AffiliateUtmCampaignSchema.optional(),
  })
  .strict();

/**
 * PATCH /api/v1/affiliates/links/{id}. Changes apply to future checkouts only. `expectedVersion` is the
 * link `version` last read; a stale value answers 409 `conflict`. `null` or "" clears label/utmCampaign.
 * Archiving is permanent.
 */
export const AffiliateLinkUpdateFieldsSchema = z
  .object({
    label: z.string().max(80).nullable().optional(),
    discountBps: AffiliateDiscountBpsSchema.optional(),
    destinationPath: AffiliateDestinationPathSchema.optional(),
    utmCampaign: z.union([AffiliateUtmCampaignSchema, z.literal("")]).nullable().optional(),
    status: z.enum(AFFILIATE_LINK_STATUSES).optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();

/** True when an update names at least one field to change (`expectedVersion` alone changes nothing). */
export function hasAffiliateLinkChange(input: Record<string, unknown>): boolean {
  return ["label", "discountBps", "destinationPath", "utmCampaign", "status"].some((key) => input[key] !== undefined);
}

export const AffiliateLinkUpdateInputSchema = AffiliateLinkUpdateFieldsSchema.refine(hasAffiliateLinkChange, {
  message: "Give at least one of label, discountBps, destinationPath, utmCampaign or status",
});

/** GET /api/v1/affiliates/preview: the commission a buyer discount leaves within the caller's budget. */
export const AffiliatePreviewQuerySchema = z
  .object({
    discountBps: AffiliateDiscountBpsSchema,
    priceMinor: nonNegativeMinor.max(100_000_000).optional(),
  })
  .strict();

/** `limit` of member conversion and commission lists. */
export const AffiliateListQuerySchema = z.object({ limit: z.number().int().min(1).max(100).optional() }).strict();

// ---------------------------------------------------------------------------
// Inputs (operator)
// ---------------------------------------------------------------------------

/** A closed calendar month (UTC), e.g. 2026-10. */
export const AffiliatePayoutPeriodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "period must be YYYY-MM");

const instantOrDate = z
  .string()
  .max(40)
  .refine((value) => /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(Date.parse(value)), "must be an ISO date (YYYY-MM-DD) or timestamp");

export const AffiliateAdminAffiliatesQuerySchema = z
  .object({ status: z.enum(AFFILIATE_STATUSES).optional(), limit: z.number().int().min(1).max(100).optional() })
  .strict();
export const AffiliateAdminConversionsQuerySchema = z
  .object({ status: z.enum(AFFILIATE_CONVERSION_STATUSES).optional(), limit: z.number().int().min(1).max(100).optional() })
  .strict();
export const AffiliateAdminBatchesQuerySchema = z.object({ limit: z.number().int().min(1).max(100).optional() }).strict();
export const AffiliateAdminReconciliationQuerySchema = z.object({ since: instantOrDate.optional(), until: instantOrDate.optional() }).strict();
export const AffiliateAdminApprovalsQuerySchema = z
  .object({
    status: z.enum(AFFILIATE_APPROVAL_STATUSES).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().max(500).optional(),
  })
  .strict();
/** POST /api/v1/affiliate-admin/conversions/{id}/hold. */
export const AffiliateHoldInputSchema = z.object({ reason: z.string().trim().min(3).max(300) }).strict();
/** POST /api/v1/affiliate-admin/payouts/batches: locks the available balances of a closed period. */
export const AffiliateCreateBatchInputSchema = z.object({ period: AffiliatePayoutPeriodSchema }).strict();

// ---------------------------------------------------------------------------
// Program rules (operator preview input, public program view)
// ---------------------------------------------------------------------------

export const AffiliateProgramLevelSchema = z.object({
  key: z.string().min(1).max(32),
  minCustomers: count,
  ordinaryBudgetBps: bps,
  memberBudgetBps: bps,
});

/** A rules document as operators preview it. The server validates the full semantics. */
export const AffiliateProgramRulesSchema = z.object({
  currency: z.string().regex(/^[a-z]{3}$/),
  levels: z.array(AffiliateProgramLevelSchema).min(1).max(10),
  eligiblePlans: z.array(z.enum(["premium", "vip"])).min(1),
  attributionWindowDays: z.number().int().positive(),
  holdDays: z.number().int().nonnegative(),
  payoutThresholdMinor: nonNegativeMinor,
  paypalServiceFeeBps: bps,
  bankVnServiceFeeBps: bps,
  withholding: z.object({ vnIndividualBps: bps.nullable(), vnBusinessBps: bps.nullable(), otherBps: bps.nullable() }),
  termsVersion: z.string().min(1).max(40),
});

/** POST /api/v1/affiliate-admin/rules/preview: validation and budget table only, nothing is published. */
export const AffiliateRulesPreviewInputSchema = z.object({ rules: AffiliateProgramRulesSchema }).strict();

// ---------------------------------------------------------------------------
// Responses (member)
// ---------------------------------------------------------------------------

export const AffiliateProgramSchema = z.object({
  rulesVersion: z.number().int().nonnegative(),
  currency: z.string(),
  levels: z.array(AffiliateProgramLevelSchema),
  eligiblePlans: z.array(z.string()),
  attributionWindowDays: z.number().int(),
  holdDays: z.number().int(),
  payoutThresholdMinor: minor,
  payoutFees: z.object({ paypalServiceFeeBps: bps, bankVnServiceFeeBps: bps }),
  termsVersion: z.string(),
  invariant: z.string(),
});

/** Ledger balances per bucket, e.g. `availableMinor`. */
export const AffiliateBalancesSchema = z.object({
  pendingMinor: minor,
  heldMinor: minor,
  availableMinor: minor,
  payout_lockedMinor: minor,
  paidMinor: minor,
});

/** Masked payout method: type and a display hint only, never account numbers or identity data. */
export const AffiliatePayoutMethodViewSchema = z.object({
  id: z.string(),
  type: z.enum(AFFILIATE_PAYOUT_METHOD_TYPES),
  displayHint: z.string().nullable(),
  payeeType: z.string(),
  residency: z.string(),
  createdAt: isoDate,
});

export const AffiliateSummarySchema = z.object({
  affiliateId: z.string(),
  status: z.enum(AFFILIATE_STATUSES),
  termsVersion: z.string(),
  joinedAt: isoDate,
  level: z.string(),
  qualifyingCustomers: count,
  nextLevel: z.object({ key: z.string(), customersNeeded: count }).nullable(),
  incentiveBasis: z.enum(AFFILIATE_INCENTIVE_BASES),
  budgetBps: bps,
  balances: AffiliateBalancesSchema,
  payoutMethod: AffiliatePayoutMethodViewSchema.nullable(),
});

export const AffiliateLinkSchema = z.object({
  id: z.string(),
  code: z.string(),
  url: z.string().url(),
  label: z.string().nullable(),
  discountBps: bps,
  /** Commission new checkouts get under today's budget. */
  commissionBps: bps,
  destinationPath: z.string(),
  utmCampaign: z.string().nullable(),
  status: z.enum(AFFILIATE_LINK_STATUSES),
  version: z.number().int().positive(),
  clicks: count,
  conversions: count,
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const AffiliateIncentiveExampleSchema = z.object({
  priceMinor: nonNegativeMinor,
  discountMinor: nonNegativeMinor,
  buyerPaysMinor: nonNegativeMinor,
  commissionMinor: nonNegativeMinor,
  merchantKeepsMinor: minor,
});

export const AffiliatePreviewSchema = z.object({
  budgetBps: bps,
  discountBps: bps,
  commissionBps: bps,
  withinBudget: z.boolean(),
  example: AffiliateIncentiveExampleSchema.optional(),
});

/** A referred purchase. Never names the buyer. */
export const AffiliateConversionSchema = z.object({
  id: z.string(),
  plan: z.string().nullable(),
  currency: z.string(),
  netMinor: minor,
  discountMinor: minor,
  commissionBps: bps,
  commissionMinor: minor,
  refundedNetMinor: minor,
  status: z.enum(AFFILIATE_CONVERSION_STATUSES),
  paidAt: isoDate,
  maturesAt: isoDate,
});

export const AffiliateLedgerEntrySchema = z.object({
  id: z.string(),
  kind: z.enum(AFFILIATE_LEDGER_KINDS),
  from: z.enum(AFFILIATE_LEDGER_BUCKETS).nullable(),
  to: z.enum(AFFILIATE_LEDGER_BUCKETS).nullable(),
  amountMinor: minor,
  currency: z.string(),
  conversionId: z.string().nullable(),
  payoutItemId: z.string().nullable(),
  reason: z.string().nullable(),
  createdAt: isoDate,
});

/** One payout to the caller: amounts, fees and status, never the payee's transfer details. */
export const AffiliatePayoutItemSchema = z.object({
  id: z.string(),
  batchId: z.string(),
  period: z.string().optional(),
  batchStatus: z.string().optional(),
  affiliateId: z.string(),
  methodType: z.string(),
  grossMinor: minor,
  serviceFeeMinor: minor,
  withholdingMinor: minor,
  netMinor: minor,
  status: z.enum(AFFILIATE_PAYOUT_ITEM_STATUSES),
  payoutCurrency: z.string().nullable(),
  fxRate: z.union([z.string(), z.number()]).nullable(),
  payoutAmountMinor: minor.nullable(),
  providerFeeMinor: minor.nullable(),
  externalReference: z.string().nullable(),
  paidAt: isoDate.nullable(),
});

// ---------------------------------------------------------------------------
// Responses (operator)
// ---------------------------------------------------------------------------

/** Operator view of an affiliate account: account ids, standing and balances, never names, emails or payee data. */
export const AffiliateOperatorAccountSchema = z.object({
  affiliateId: z.string(),
  userId: z.string(),
  status: z.enum(AFFILIATE_STATUSES),
  suspendedReason: z.string().nullable(),
  termsVersion: z.string(),
  joinedAt: isoDate,
  level: z.string(),
  qualifyingCustomers: count,
  incentiveBasis: z.enum(AFFILIATE_INCENTIVE_BASES),
  budgetBps: bps,
  balances: AffiliateBalancesSchema,
});

/** Operator view of one conversion, including the buyer account id and Polar order for fraud review. */
export const AffiliateOperatorConversionSchema = z.object({
  id: z.string(),
  affiliateId: z.string(),
  buyerUserId: z.string(),
  polarOrderId: z.string(),
  plan: z.string().nullable(),
  currency: z.string(),
  netMinor: minor,
  discountMinor: minor,
  commissionBps: bps,
  commissionMinor: minor,
  refundedNetMinor: minor,
  status: z.enum(AFFILIATE_CONVERSION_STATUSES),
  holdReason: z.string().nullable(),
  paidAt: isoDate,
  maturesAt: isoDate,
});

export const AffiliatePayoutBatchSchema = z.object({
  id: z.string(),
  period: z.string(),
  currency: z.string(),
  status: z.enum(AFFILIATE_PAYOUT_BATCH_STATUSES),
  rulesVersion: z.number().int().nonnegative(),
  thresholdMinor: minor,
  createdBy: z.string(),
  approvedBy: z.string().nullable(),
  approvedAt: isoDate.nullable(),
  cancelledAt: isoDate.nullable(),
  createdAt: isoDate,
});

/** A batch with totals and items. Items carry the method type only; payee details stay sealed. */
export const AffiliatePayoutBatchDetailSchema = AffiliatePayoutBatchSchema.extend({
  totals: z.object({ items: count, grossMinor: minor, netMinor: minor }),
  items: z.array(AffiliatePayoutItemSchema),
});

/** Active rules version (0 = defaults) with the raw rules and their public program view. */
export const AffiliateAdminRulesSchema = z.object({
  version: z.number().int().nonnegative(),
  rules: AffiliateProgramRulesSchema,
  program: AffiliateProgramSchema,
});

/** Rules preview: the normalized rules and the version a publish would create. Nothing is written. */
export const AffiliateRulesPreviewSchema = z.object({
  valid: z.boolean(),
  currentVersion: z.number().int().nonnegative(),
  nextVersion: z.number().int().positive(),
  rules: AffiliateProgramRulesSchema,
  levels: z.array(z.record(z.unknown())),
});

const envelope = <T extends z.ZodTypeAny>(data: T) => z.object({ data });

export const AffiliateProgramResponseSchema = envelope(AffiliateProgramSchema);
export const AffiliateSummaryResponseSchema = envelope(AffiliateSummarySchema);
export const AffiliatePreviewResponseSchema = envelope(AffiliatePreviewSchema);
export const AffiliateLinkResponseSchema = envelope(AffiliateLinkSchema);
export const AffiliateLinksResponseSchema = envelope(z.object({ links: z.array(AffiliateLinkSchema) }));
export const AffiliateConversionsResponseSchema = envelope(z.object({ conversions: z.array(AffiliateConversionSchema) }));
export const AffiliateCommissionsResponseSchema = envelope(z.object({ balances: AffiliateBalancesSchema, ledger: z.array(AffiliateLedgerEntrySchema) }));
export const AffiliatePayoutsResponseSchema = envelope(z.object({ payouts: z.array(AffiliatePayoutItemSchema) }));
export const AffiliateAdminRulesResponseSchema = envelope(AffiliateAdminRulesSchema);
export const AffiliateRulesPreviewResponseSchema = envelope(AffiliateRulesPreviewSchema);
/** Operator lists wrap their array: `{ affiliates }`, `{ conversions }`, `{ batches }`. */
export const AffiliateAdminAffiliatesResponseSchema = envelope(z.object({ affiliates: z.array(AffiliateOperatorAccountSchema) }));
export const AffiliateAdminConversionsResponseSchema = envelope(z.object({ conversions: z.array(AffiliateOperatorConversionSchema) }));
export const AffiliateAdminConversionResponseSchema = envelope(AffiliateOperatorConversionSchema);
export const AffiliateAdminBatchesResponseSchema = envelope(z.object({ batches: z.array(AffiliatePayoutBatchSchema) }));
export const AffiliateAdminBatchResponseSchema = envelope(AffiliatePayoutBatchSchema);
export const AffiliateAdminBatchDetailResponseSchema = envelope(AffiliatePayoutBatchDetailSchema);
/** Approvals list: a bare array of approval records plus cursor pagination (shared operator approval shape). */
export const AffiliateAdminApprovalsResponseSchema = z
  .object({ data: z.array(z.record(z.unknown())), pagination: z.record(z.unknown()).optional() })
  .passthrough();
/** Any affiliate success body: `{ data }`, optionally with pagination. Used for open-ended reports (payout preview, reconciliation). */
export const AffiliateEnvelopeSchema = z.object({ data: z.unknown() }).passthrough();

export type AffiliateJoinInput = z.infer<typeof AffiliateJoinInputSchema>;
export type AffiliateLinkCreateInput = z.infer<typeof AffiliateLinkCreateInputSchema>;
export type AffiliateLinkUpdateInput = z.infer<typeof AffiliateLinkUpdateInputSchema>;
export type AffiliatePreviewQuery = z.infer<typeof AffiliatePreviewQuerySchema>;
export type AffiliateListQuery = z.infer<typeof AffiliateListQuerySchema>;
export type AffiliateProgramRules = z.infer<typeof AffiliateProgramRulesSchema>;
export type AffiliateProgram = z.infer<typeof AffiliateProgramSchema>;
export type AffiliateSummary = z.infer<typeof AffiliateSummarySchema>;
export type AffiliateLink = z.infer<typeof AffiliateLinkSchema>;
export type AffiliatePreview = z.infer<typeof AffiliatePreviewSchema>;
export type AffiliateConversion = z.infer<typeof AffiliateConversionSchema>;
export type AffiliateLedgerEntry = z.infer<typeof AffiliateLedgerEntrySchema>;
export type AffiliatePayoutItem = z.infer<typeof AffiliatePayoutItemSchema>;
export type AffiliateEnvelope = z.infer<typeof AffiliateEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Failures shared by the CLI and MCP surfaces
// ---------------------------------------------------------------------------

export const AffiliateErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

/** Shown when a member route answers 404 `not_found` because AFFILIATES_ENABLED is off. */
export const AFFILIATES_NOT_ENABLED_MESSAGE = "The affiliate program is not enabled on this environment (AFFILIATES_ENABLED is off)";

export interface AffiliateApiFailure {
  status: number;
  /** Machine code from the error envelope (`not_enrolled`, `over_budget`, `conflict`, `not_operator`, ...). */
  code?: string;
  details?: unknown;
  /** True when the failure most likely means the program is switched off on this environment. */
  notEnabled: boolean;
  /** What to do next, when the code has an obvious remedy. */
  hint?: string;
  message: string;
}

const HINTS: Record<string, string> = {
  not_enrolled: "Join the program first: read the program's termsVersion, have the user accept the Affiliate Agreement, then join with that version.",
  terms_not_accepted: "Pass the termsVersion the user accepted; it must equal the program's current termsVersion.",
  over_budget: "Lower discountBps: the buyer discount cannot exceed the caller's budgetBps (see the preview).",
  conflict: "The link changed meanwhile: read it again and retry with its current version as expectedVersion.",
  session_required: "This action needs a signed-in browser session on nextlevelbuilder.io; API keys and MCP agents are refused.",
  approval_required: "This action needs a second operator's approval and stays on the website.",
};

/**
 * Converts a non-2xx affiliate response into a structured failure.
 * `resource: true` marks a lookup of one item (link, conversion, batch id), where a 404 can also
 * mean the item does not exist; member collection routes answer 404 `not_found` only while the
 * program is switched off. Operator routes ignore the flag, so pass `operator: true` for them.
 */
export function describeAffiliateApiFailure(
  status: number,
  bodyText: string,
  statusText = "",
  options: { resource?: boolean; operator?: boolean } = {}
): AffiliateApiFailure {
  let raw: unknown;
  try {
    raw = bodyText ? JSON.parse(bodyText) : undefined;
  } catch {
    raw = undefined;
  }
  const parsed = AffiliateErrorSchema.safeParse(raw);
  const code = parsed.success ? parsed.data.error.code : undefined;
  const details = parsed.success ? parsed.data.error.details : undefined;
  const serverMessage = parsed.success ? parsed.data.error.message : (bodyText.trim().slice(0, 500) || statusText || "Request failed");
  const hidden = !options.operator && status === 404 && (code === undefined || code === "not_found");

  let message: string;
  if (hidden && !options.resource) message = `${AFFILIATES_NOT_ENABLED_MESSAGE}.`;
  else if (hidden) message = `Not found, or ${AFFILIATES_NOT_ENABLED_MESSAGE}.`;
  else if (status === 401) message = options.operator ? "Operator sign-in required." : "Sign in required: send an NLB API key, an OAuth identity or a session cookie.";
  else message = serverMessage;

  const hint = code ? HINTS[code] : undefined;
  return {
    status,
    code,
    details,
    notEnabled: hidden && !options.resource,
    ...(hint ? { hint } : {}),
    message: `HTTP ${status}${code ? ` ${code}` : ""}: ${message}`,
  };
}
