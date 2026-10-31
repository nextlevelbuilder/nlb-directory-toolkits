import { randomUUID } from "node:crypto";
import type { ZodType, ZodTypeDef } from "zod";
import {
  AffiliateCommissionsResponseSchema,
  AffiliateConversionsResponseSchema,
  AffiliateJoinInputSchema,
  AffiliateLinkCreateInputSchema,
  AffiliateLinkResponseSchema,
  AffiliateLinkUpdateInputSchema,
  AffiliateLinksResponseSchema,
  AffiliateListQuerySchema,
  AffiliatePayoutsResponseSchema,
  AffiliatePreviewQuerySchema,
  AffiliatePreviewResponseSchema,
  AffiliateProgramResponseSchema,
  AffiliateSummaryResponseSchema,
  describeAffiliateApiFailure,
  type AffiliateApiFailure
} from "@nextlevelbuilder/contracts";
import { isAllowedCredentialOrigin } from "../config.js";

/** Raised for any non-2xx affiliate response; carries the structured failure. */
export class AffiliateApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly hint?: string;
  readonly notEnabled: boolean;

  constructor(failure: AffiliateApiFailure) {
    super(`API Error (${failure.message})`);
    this.name = "AffiliateApiError";
    this.status = failure.status;
    this.code = failure.code;
    this.details = failure.details;
    this.hint = failure.hint;
    this.notEnabled = failure.notEnabled;
  }
}

/** Raised when input fails the local contract checks before any network call. */
export class AffiliateInputError extends Error {
  readonly issues: Array<{ path: string; message: string }>;

  constructor(label: string, issues: Array<{ path: string; message: string }>) {
    super(`Invalid ${label}: ${issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("; ")}`);
    this.name = "AffiliateInputError";
    this.issues = issues;
  }
}

function parseInput<T>(schema: ZodType<T, ZodTypeDef, unknown>, input: unknown, label: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AffiliateInputError(label, result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));
  }
  return result.data;
}

export interface AffiliateClientOptions {
  baseUrl: string;
  apiKey?: string;
  /** Better Auth session cookie, used only when no API key is configured. */
  sessionCookie?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

interface AffiliateRequest<T> {
  method: "GET" | "POST" | "PATCH";
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /** The path names one item, so a 404 may also mean it does not exist. */
  resource?: boolean;
  /** Public route: no credential is sent. */
  anonymous?: boolean;
  schema: ZodType<T, ZodTypeDef, unknown>;
}

const MEMBER = "/api/v1/affiliates";

/**
 * Typed client for the member affiliate routes (`/api/v1/affiliates/*`). Every call acts on the caller's
 * own affiliate account. Money is integer minor units and rates are basis points. Payout methods are
 * session-only on the website and operator money actions are not part of the CLI, so neither is here.
 */
export class NlbAffiliateClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly sessionCookie?: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: AffiliateClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey?.trim() || undefined;
    this.sessionCookie = options.sessionCookie?.trim() || undefined;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  private async send<T>(req: AffiliateRequest<T>): Promise<T> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query ?? {})) {
      if (value !== undefined) params.set(key, String(value));
    }
    const search = params.size ? `?${params.toString()}` : "";
    const url = `${this.baseUrl}${req.path}${search}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (!req.anonymous) {
      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
        headers["x-api-key"] = this.apiKey;
      } else if (this.sessionCookie) {
        if (!isAllowedCredentialOrigin(this.baseUrl)) {
          throw new Error(`Refusing to send the session cookie to ${this.baseUrl}: it is not a Next Level Builder origin.`);
        }
        headers.Cookie = this.sessionCookie;
      } else {
        throw new Error("Sign-in required: pass --api-key, set NLB_API_KEY, run 'nlb config set api-key', or pass a session cookie (--cookie, NLB_SESSION_COOKIE).");
      }
    }
    if (req.body !== undefined) headers["Content-Type"] = "application/json";
    if (req.method !== "GET") headers["Idempotency-Key"] = randomUUID();

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
      throw new AffiliateApiError(describeAffiliateApiFailure(response.status, text, response.statusText, { resource: req.resource }));
    }
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`API returned non-JSON response for ${req.path}`);
    }
    const parsed = req.schema.safeParse(data);
    if (!parsed.success) throw new Error(`API Response schema mismatch for ${req.path}: ${parsed.error.message}`);
    return parsed.data;
  }

  getProgram() {
    return this.send({ method: "GET", path: `${MEMBER}/program`, anonymous: true, schema: AffiliateProgramResponseSchema });
  }

  getMe() {
    return this.send({ method: "GET", path: `${MEMBER}/me`, schema: AffiliateSummaryResponseSchema });
  }

  /** Joins with the Affiliate Agreement version the user accepted. */
  join(input: unknown) {
    const body = parseInput(AffiliateJoinInputSchema, input, "join request");
    return this.send({ method: "POST", path: `${MEMBER}/me`, body, schema: AffiliateSummaryResponseSchema });
  }

  preview(query: unknown) {
    const q = parseInput(AffiliatePreviewQuerySchema, query, "preview query");
    return this.send({ method: "GET", path: `${MEMBER}/preview`, query: q, schema: AffiliatePreviewResponseSchema });
  }

  listLinks() {
    return this.send({ method: "GET", path: `${MEMBER}/links`, schema: AffiliateLinksResponseSchema });
  }

  createLink(input: unknown) {
    const body = parseInput(AffiliateLinkCreateInputSchema, input, "link");
    return this.send({ method: "POST", path: `${MEMBER}/links`, body, schema: AffiliateLinkResponseSchema });
  }

  updateLink(id: string, input: unknown) {
    if (!id.trim()) throw new AffiliateInputError("link id", [{ path: "id", message: "Required" }]);
    const body = parseInput(AffiliateLinkUpdateInputSchema, input, "link update");
    return this.send({ method: "PATCH", path: `${MEMBER}/links/${encodeURIComponent(id)}`, body, resource: true, schema: AffiliateLinkResponseSchema });
  }

  listConversions(query: unknown = {}) {
    const q = parseInput(AffiliateListQuerySchema, query, "conversions query");
    return this.send({ method: "GET", path: `${MEMBER}/conversions`, query: q, schema: AffiliateConversionsResponseSchema });
  }

  getCommissions(query: unknown = {}) {
    const q = parseInput(AffiliateListQuerySchema, query, "commissions query");
    return this.send({ method: "GET", path: `${MEMBER}/commissions`, query: q, schema: AffiliateCommissionsResponseSchema });
  }

  listPayouts() {
    return this.send({ method: "GET", path: `${MEMBER}/payouts`, schema: AffiliatePayoutsResponseSchema });
  }
}
