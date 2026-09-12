import {
  ProductCreateInputSchema,
  type ProductCreateInput,
  type ProductCreateResponse,
  ProductCreateResponseSchema,
  type ProductRevisionInput,
  type ProductRevisionResponse,
  ProductRevisionResponseSchema,
  type ProductSubmitInput,
  type ProductSubmitResponse,
  ProductSubmitResponseSchema,
  ProductSubmitSuccessSchema,
  ProductSubmitPaymentRequiredSchema,
  type ProductListQuery,
  type ProductListResponse,
  ProductListResponseSchema,
  type ProductDetailResponse,
  ProductDetailResponseSchema,
  type RankingsQuery,
  type RankingsResponse,
  RankingsResponseSchema,
  type StatsResponse,
  StatsResponseSchema,
  ProductTrafficQuerySchema,
  ProductTrafficResponseSchema,
  type ProductTrafficQuery,
  type ProductTrafficResponse,
  type HealthResponse,
  HealthResponseSchema,
  type VoteInput,
  type VoteResponse,
  VoteResponseSchema,
  type ApiKeyListResponse,
  ApiKeyListResponseSchema,
  type ApiKeyCreateInput,
  type ApiKeyCreateResponse,
  ApiKeyCreateResponseSchema,
  type ApiKeyRevokeResponse,
  ApiKeyRevokeResponseSchema,
  type MediaUploadResponse,
  MediaUploadResponseSchema,
  type CheckoutInput,
  type CheckoutResponse,
  CheckoutResponseSchema,
  toServerDocument
} from "@nextlevelbuilder/contracts";

export interface ApiClientOptions {
  baseUrl: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Validates that an API key conforms to the canonical Next Level Builders format: nlb_live_<alphanumeric>
 */
export function validateApiKey(key?: string): boolean {
  if (!key) return false;
  return /^nlb_live_[a-zA-Z0-9_]+$/.test(key.trim());
}

export class NlbApiClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey?.trim();
    this.fetch = options.fetchFn || globalThis.fetch;
    this.timeoutMs = options.timeoutMs || 15000;
  }

  private getAuthHeaders(sessionCookie?: string, needsApiKey = false): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.apiKey && needsApiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
      headers["x-api-key"] = this.apiKey;
    }
    if (sessionCookie) {
      headers["Cookie"] = sessionCookie;
    }
    return headers;
  }

  private async request<T>(
    path: string,
    options: RequestInit & { parseSchema?: { parse: (data: unknown) => T } },
    needsApiKey = false
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...this.getAuthHeaders(undefined, needsApiKey),
      ...(options.headers as Record<string, string> || {})
    };

    if (options.body && typeof options.body === "string" && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;
    try {
      response = await this.fetch(url, {
        ...options,
        headers,
        signal: options.signal || timeoutSignal
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Network request to ${url} failed: ${msg}`);
    }

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      const errorMsg =
        data && typeof data === "object" && "error" in data && typeof (data as any).error === "string"
          ? (data as any).error
          : data && typeof data === "object" && "message" in data && typeof (data as any).message === "string"
          ? (data as any).message
          : text || response.statusText;
      throw new Error(`API Error (HTTP ${response.status}): ${errorMsg}`);
    }

    if (options.parseSchema) {
      try {
        return options.parseSchema.parse(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`API Response schema mismatch for ${path}: ${msg}`);
      }
    }

    return data as T;
  }

  /**
   * Request raw plaintext or markdown without attempting JSON parsing.
   */
  async requestText(path: string, options: RequestInit = {}): Promise<string> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);

    const headers: Record<string, string> = {
      Accept: "text/markdown, text/plain, */*",
      ...this.getAuthHeaders(),
      ...(options.headers as Record<string, string> || {})
    };

    let response: Response;
    try {
      response = await this.fetch(url, {
        ...options,
        headers,
        signal: options.signal || timeoutSignal
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Network request to ${url} failed: ${msg}`);
    }

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`API Error (HTTP ${response.status}): ${text || response.statusText}`);
    }
    return text;
  }

  // 1. Create product draft
  async createProduct(input: ProductCreateInput | unknown): Promise<ProductCreateResponse> {
    const validated = ProductCreateInputSchema.parse(input);
    return this.request<ProductCreateResponse>("/api/v1/products", {
      method: "POST",
      body: JSON.stringify({
        orgId: validated.orgId,
        slug: validated.slug,
        title: validated.title,
        tagline: validated.tagline,
        websiteUrl: validated.websiteUrl,
        logoUrl: validated.logoUrl
      }),
      parseSchema: ProductCreateResponseSchema
    }, true);
  }

  // 2. Upload revision
  async createRevision(slug: string, input: ProductRevisionInput): Promise<ProductRevisionResponse> {
    const canonicalDoc = toServerDocument(input.document);
    return this.request<ProductRevisionResponse>(`/api/v1/products/${encodeURIComponent(slug)}/revisions`, {
      method: "POST",
      body: JSON.stringify({
        document: canonicalDoc
      }),
      parseSchema: ProductRevisionResponseSchema
    }, true);
  }
  // 3. Submit revision for review (handles HTTP 200 and HTTP 402)
  async submitProduct(slug: string, input: ProductSubmitInput = {}): Promise<ProductSubmitResponse> {
    const url = `${this.baseUrl}/api/v1/products/${encodeURIComponent(slug)}/submit`;
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...this.getAuthHeaders(undefined, true)
    };

    let response: Response;
    try {
      response = await this.fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          revisionId: input.revisionId,
          submissionNotes: input.submissionNotes,
          isFastTrack: input.isFastTrack,
          payOnly: input.payOnly
        }),
        signal: timeoutSignal
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Network request to submit product '${slug}' failed: ${msg}`);
    }

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }

    // Handle HTTP 402 Payment Required specifically
    if (response.status === 402) {
      return ProductSubmitPaymentRequiredSchema.parse(data);
    }

    if (!response.ok) {
      const errObj = data && typeof data === "object" ? (data as Record<string, unknown>) : undefined;
      const errorMsg =
        errObj && typeof errObj.error === "string"
          ? errObj.error
          : text || response.statusText;
      throw new Error(`API Error (HTTP ${response.status}): ${errorMsg}`);
    }

    return ProductSubmitSuccessSchema.parse(data);
  }

  // 4. List directory products
  async listProducts(query: ProductListQuery = { limit: 20, offset: 0 }): Promise<ProductListResponse> {
    const params = new URLSearchParams();
    if (typeof query.limit === "number") params.set("limit", String(Math.min(50, Math.max(1, query.limit))));
    if (typeof query.offset === "number") params.set("offset", String(Math.max(0, query.offset)));

    return this.request<ProductListResponse>(`/api/v1/products?${params.toString()}`, {
      method: "GET",
      parseSchema: ProductListResponseSchema
    });
  }

  // 5. Get product details by slug
  async getProduct(slug: string): Promise<ProductDetailResponse> {
    return this.request<ProductDetailResponse>(`/api/v1/products/${encodeURIComponent(slug)}`, {
      method: "GET",
      parseSchema: ProductDetailResponseSchema
    });
  }

  // 6. Get product markdown for LLM consumption
  async getProductMarkdown(slug: string): Promise<string> {
    return this.requestText(`/api/v1/products/${encodeURIComponent(slug)}/markdown`);
  }

  // 7. Get community rankings
  async getRankings(query: RankingsQuery = { window: "daily" }): Promise<RankingsResponse> {
    const windowType = query.window || "daily";
    return this.request<RankingsResponse>(`/api/v1/rankings?window=${windowType}`, {
      method: "GET",
      parseSchema: RankingsResponseSchema
    });
  }


  // 8. Get directory stats
  async getStats(): Promise<StatsResponse> {
    return this.request<StatsResponse>("/api/v1/stats", {
      method: "GET",
      parseSchema: StatsResponseSchema
    });
  }

  async getProductTraffic(slug: string, query: ProductTrafficQuery = {}): Promise<ProductTrafficResponse> {
    const validated = ProductTrafficQuerySchema.parse(query);
    const params = new URLSearchParams();
    if (validated.from) params.set("from", validated.from);
    if (validated.to) params.set("to", validated.to);
    const search = params.size ? `?${params.toString()}` : "";
    return this.request<ProductTrafficResponse>(`/api/v1/products/${encodeURIComponent(slug)}/traffic${search}`, {
      method: "GET",
      parseSchema: ProductTrafficResponseSchema
    }, true);
  }

  // 9. Service & Database Health probe
  async checkHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/api/health", {
      method: "GET",
      parseSchema: HealthResponseSchema
    });
  }

  // 10. Cast community vote (Session Cookie required)
  async castVote(input: VoteInput, sessionCookie?: string): Promise<VoteResponse> {
    const headers: Record<string, string> = {};
    if (sessionCookie) headers["Cookie"] = sessionCookie;

    return this.request<VoteResponse>("/api/v1/votes", {
      method: "POST",
      headers,
      body: JSON.stringify({
        productId: input.productId,
        turnstileToken: input.turnstileToken
      }),
      parseSchema: VoteResponseSchema
    });
  }

  // 11. API Keys Management (Session Cookie required)
  async listApiKeys(sessionCookie?: string): Promise<ApiKeyListResponse> {
    const headers: Record<string, string> = {};
    if (sessionCookie) headers["Cookie"] = sessionCookie;

    return this.request<ApiKeyListResponse>("/api/v1/api-keys", {
      method: "GET",
      headers,
      parseSchema: ApiKeyListResponseSchema
    });
  }

  async createApiKey(input: ApiKeyCreateInput, sessionCookie?: string): Promise<ApiKeyCreateResponse> {
    const headers: Record<string, string> = {};
    if (sessionCookie) headers["Cookie"] = sessionCookie;

    return this.request<ApiKeyCreateResponse>("/api/v1/api-keys", {
      method: "POST",
      headers,
      body: JSON.stringify(input),
      parseSchema: ApiKeyCreateResponseSchema
    });
  }

  async revokeApiKey(id: string, sessionCookie?: string): Promise<ApiKeyRevokeResponse> {
    const headers: Record<string, string> = {};
    if (sessionCookie) headers["Cookie"] = sessionCookie;

    return this.request<ApiKeyRevokeResponse>(`/api/v1/api-keys/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers,
      parseSchema: ApiKeyRevokeResponseSchema
    });
  }

  // 12. Media Upload (multipart form data)
  async uploadMedia(
    fileBuffer: Uint8Array | Buffer,
    filename: string,
    mimeType = "application/octet-stream",
    folder = "uploads"
  ): Promise<MediaUploadResponse> {
    const url = `${this.baseUrl}/api/v1/media/upload`;
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);

    const formData = new FormData();
    const blob = new Blob([fileBuffer as unknown as BlobPart], { type: mimeType });
    formData.append("file", blob, filename);
    formData.append("folder", folder);

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...this.getAuthHeaders(undefined, false)
    };

    let response: Response;
    try {
      response = await this.fetch(url, {
        method: "POST",
        headers,
        body: formData,
        signal: timeoutSignal
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Network request to upload media failed: ${msg}`);
    }

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      const errObj = data && typeof data === "object" ? (data as Record<string, unknown>) : undefined;
      const errorMsg =
        errObj && typeof errObj.error === "string"
          ? errObj.error
          : text || response.statusText;
      throw new Error(`Media upload failed (HTTP ${response.status}): ${errorMsg}`);
    }

    return MediaUploadResponseSchema.parse(data);
  }

  // 13. Create Polar checkout session
  async createCheckout(input: CheckoutInput): Promise<CheckoutResponse> {
    return this.request<CheckoutResponse>("/api/checkout", {
      method: "POST",
      body: JSON.stringify(input),
      parseSchema: CheckoutResponseSchema
    });
  }
}
