import {
  type ProductCreateInput,
  type ProductCreateResponse,
  ProductCreateResponseSchema,
  type ProductRevisionInput,
  type ProductRevisionResponse,
  ProductRevisionResponseSchema,
  type ProductSubmitInput,
  type ProductSubmitResponse,
  ProductSubmitResponseSchema,
  type ProductListQuery,
  type ProductListResponse,
  ProductListResponseSchema,
  type ProductDetailResponse,
  ProductDetailResponseSchema,
  type ProductStatusResponse,
  ProductStatusResponseSchema,
  type LeaderboardQuery,
  type LeaderboardResponse,
  LeaderboardResponseSchema,
  type SearchQuery,
  type SearchResponse,
  SearchResponseSchema
} from "@nextlevelbuilder/contracts";

export interface ApiClientOptions {
  baseUrl: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export class NlbApiClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.fetch = options.fetchFn || globalThis.fetch;
    this.timeoutMs = options.timeoutMs || 15000;
  }

  private async request<T>(
    path: string,
    options: RequestInit & { parseSchema?: { parse: (data: unknown) => T } }
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers as Record<string, string>)
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    let response: Response;
    try {
      response = await this.fetch(url, {
        ...options,
        headers,
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (err) {
      throw new Error(`Network error communicating with ${url}: ${err instanceof Error ? err.message : String(err)}`);
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
        typeof data === "object" && data !== null && "message" in data
          ? String((data as { message: unknown }).message)
          : `HTTP ${response.status} ${response.statusText}`;
      throw new Error(`API Error (${response.status} from ${path}): ${errorMsg}`);
    }

    if (options.parseSchema) {
      try {
        return options.parseSchema.parse(data);
      } catch (err) {
        throw new Error(`API Response schema mismatch on ${path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return data as T;
  }

  // 1. Create or register product metadata
  async createProduct(input: ProductCreateInput): Promise<ProductCreateResponse> {
    return this.request<ProductCreateResponse>("/api/v1/products", {
      method: "POST",
      body: JSON.stringify(input),
      parseSchema: ProductCreateResponseSchema
    });
  }

  // 2. Upload revision with content hash
  async createRevision(slug: string, input: ProductRevisionInput): Promise<ProductRevisionResponse> {
    return this.request<ProductRevisionResponse>(`/api/v1/products/${encodeURIComponent(slug)}/revisions`, {
      method: "POST",
      body: JSON.stringify(input),
      parseSchema: ProductRevisionResponseSchema
    });
  }

  // 3. Submit revision into review queue
  async submitProduct(slug: string, input: ProductSubmitInput = {}): Promise<ProductSubmitResponse> {
    return this.request<ProductSubmitResponse>(`/api/v1/products/${encodeURIComponent(slug)}/submit`, {
      method: "POST",
      body: JSON.stringify(input),
      parseSchema: ProductSubmitResponseSchema
    });
  }

  // 4. List directory products
  async listProducts(query: ProductListQuery = { page: 1, limit: 20, sort: "trust_score" }): Promise<ProductListResponse> {
    const params = new URLSearchParams();
    if (query.category) params.set("category", query.category);
    if (query.tag) params.set("tag", query.tag);
    if (query.status) params.set("status", query.status);
    if (query.page) params.set("page", String(query.page));
    if (query.limit) params.set("limit", String(query.limit));
    if (query.sort) params.set("sort", query.sort);

    const queryString = params.toString() ? `?${params.toString()}` : "";
    return this.request<ProductListResponse>(`/api/v1/products${queryString}`, {
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

  // 6. Check moderation status
  async getProductStatus(slug: string): Promise<ProductStatusResponse> {
    return this.request<ProductStatusResponse>(`/api/v1/products/${encodeURIComponent(slug)}/status`, {
      method: "GET",
      parseSchema: ProductStatusResponseSchema
    });
  }

  // 7. Get leaderboard
  async getLeaderboard(query: LeaderboardQuery = { timeframe: "all_time", limit: 10 }): Promise<LeaderboardResponse> {
    const params = new URLSearchParams();
    if (query.timeframe) params.set("timeframe", query.timeframe);
    if (query.limit) params.set("limit", String(query.limit));

    const queryString = params.toString() ? `?${params.toString()}` : "";
    return this.request<LeaderboardResponse>(`/api/v1/leaderboard${queryString}`, {
      method: "GET",
      parseSchema: LeaderboardResponseSchema
    });
  }

  // 8. Search directory
  async searchProducts(query: SearchQuery): Promise<SearchResponse> {
    const params = new URLSearchParams();
    params.set("q", query.q);
    if (query.category) params.set("category", query.category);
    if (query.tag) params.set("tag", query.tag);
    if (query.limit) params.set("limit", String(query.limit));

    return this.request<SearchResponse>(`/api/v1/search?${params.toString()}`, {
      method: "GET",
      parseSchema: SearchResponseSchema
    });
  }
}
