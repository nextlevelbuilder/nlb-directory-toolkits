import {
  toServerDocumentSafe,
  computeContentHashSync,
  listTemplates,
  getTemplate,
  ProductRevisionResponseSchema,
  ProductSubmitSuccessSchema,
  ProductSubmitPaymentRequiredSchema
} from "@nextlevelbuilder/contracts";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (
    args: Record<string, unknown>,
    context?: { workerAuth?: boolean; env?: { NLB_API_KEY?: string; NLB_API_URL?: string } }
  ) => Promise<unknown>;
}

const ALLOWED_HOSTS: Record<string, true> = {
  "nextlevelbuilder.io": true,
  "www.nextlevelbuilder.io": true,
  "staging.nextlevelbuilder.io": true,
  "localhost": true,
  "127.0.0.1": true
};

/**
 * Validates that an API URL belongs to an authorized NextLevelBuilder domain or local loopback.
 * Strictly rejects .local domain names to prevent SSRF and internal network scanning.
 */
export function validateAllowedApiUrl(apiUrlRaw?: string): string {
  const defaultUrl = "https://nextlevelbuilder.io";
  if (!apiUrlRaw || typeof apiUrlRaw !== "string" || !apiUrlRaw.trim()) {
    return defaultUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(apiUrlRaw.trim());
  } catch {
    throw new Error(`Invalid api_url format: '${apiUrlRaw}'`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLoopback =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]";

  if (!ALLOWED_HOSTS[hostname] && !isLoopback) {
    throw new Error(
      `Access to '${hostname}' is disallowed. Allowed endpoints: https://nextlevelbuilder.io, https://staging.nextlevelbuilder.io, or localhost.`
    );
  }

  if (!isLoopback && parsed.protocol.toLowerCase() !== "https:") {
    throw new Error("Remote directory API endpoints must use HTTPS.");
  }

  return parsed.origin;
}

const ALLOWED_MIME_TYPES: Record<string, true> = {
  "image/png": true,
  "image/jpeg": true,
  "image/jpg": true,
  "image/webp": true,
  "image/svg+xml": true,
  "image/gif": true,
  "video/mp4": true,
  "video/webm": true,
  "video/quicktime": true
};
export function resolveToolEnv(
  args: Record<string, unknown>,
  context?: { workerAuth?: boolean; env?: { NLB_API_KEY?: string; NLB_API_URL?: string } }
): { apiUrl: string; apiKey?: string } {
  const rawUrl =
    typeof args.api_url === "string" && args.api_url.trim()
      ? args.api_url.trim()
      : context?.env?.NLB_API_URL || (typeof process !== "undefined" ? process.env?.NLB_API_URL : undefined);

  const apiUrl = validateAllowedApiUrl(rawUrl);

  const apiKey =
    typeof args.api_key === "string" && args.api_key.trim()
      ? args.api_key.trim()
      : context?.env?.NLB_API_KEY || (typeof process !== "undefined" ? process.env?.NLB_API_KEY : undefined);

  return { apiUrl, apiKey };
}


export const TOOLS: McpToolDefinition[] = [
  // 1. validate_listing
  {
    name: "validate_listing",
    description: "Validate a product document against Next Level Builders Directory contracts and compute its canonical SHA-256 hash.",
    inputSchema: {
      type: "object",
      properties: {
        document: {
          type: "object",
          description: "The complete product document JSON object containing title/name, tagline, description, websiteUrl, and blocks."
        }
      },
      required: ["document"]
    },
    handler: async (args) => {
      if (!args.document || typeof args.document !== "object") {
        throw new Error("Missing required 'document' parameter.");
      }

      const docResult = toServerDocumentSafe(args.document);
      if (!docResult.success) {
        return {
          valid: false,
          errors: docResult.errors
        };
      }

      const serverDoc = docResult.document;
      const contentHash = computeContentHashSync(serverDoc);
      return {
        valid: true,
        contentHash,
        hashVersion: "v1",
        product: {
          title: serverDoc.title,
          categorySlugs: serverDoc.categorySlugs,
          blocksCount: serverDoc.blocks.length
        }
      };
    }
  },

  // 2. submit_product
  {
    name: "submit_product",
    description: "Submit a validated product document into the Next Level Builders Directory moderation review queue (with Polar payment handling).",
    inputSchema: {
      type: "object",
      properties: {
        document: {
          type: "object",
          description: "The complete product document JSON object"
        },
        org_id: {
          type: "string",
          description: "Organization UUID identifier (obtain from https://nextlevelbuilder.io/studio)"
        },
        api_key: {
          type: "string",
          description: "Next Level Builders API key (format: nlb_live_...)"
        },
        api_url: {
          type: "string",
          description: "Directory API endpoint (allowed: https://nextlevelbuilder.io or https://staging.nextlevelbuilder.io)"
        },
        notes: {
          type: "string",
          description: "Optional notes for the review team"
        },
        is_fast_track: {
          type: "boolean",
          description: "Request fast-track moderation"
        },
        pay_only: {
          type: "boolean",
          description: "Generate Polar payment checkout session without immediate review submission"
        }
      },
      required: ["document", "org_id"]
    },
    handler: async (args, context) => {
      if (!args.document || typeof args.document !== "object") {
        throw new Error("Missing required 'document' parameter.");
      }

      if (!args.org_id || typeof args.org_id !== "string" || !args.org_id.trim()) {
        throw new Error("Missing required 'org_id' parameter. Must be your organization UUID from https://nextlevelbuilder.io/studio.");
      }

      const docResult = toServerDocumentSafe(args.document);
      if (!docResult.success) {
        throw new Error(
          `Document schema invalid: ${docResult.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`
        );
      }

      const raw = args.document as Record<string, unknown>;
      const canonicalDoc = docResult.document;
      const contentHash = computeContentHashSync(canonicalDoc);
      const { apiUrl, apiKey } = resolveToolEnv(args, context);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json"
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
        headers["x-api-key"] = apiKey;
      }

      const rawSlug = typeof raw.slug === "string" ? raw.slug : canonicalDoc.title.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      const slug = rawSlug.replace(/^-|-$/g, "").slice(0, 64);
      const orgId = String(args.org_id).trim();
      const timeoutSignal = AbortSignal.timeout(15000);

      try {
        const createResp = await fetch(`${apiUrl}/api/v1/products`, {
          method: "POST",
          headers,
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            orgId,
            slug,
            title: canonicalDoc.title,
            tagline: canonicalDoc.tagline,
            websiteUrl: canonicalDoc.websiteUrl,
            logoUrl: canonicalDoc.logoUrl
          })
        });
        if (!createResp.ok) {
          const errorText = await createResp.text().catch(() => "");
          if (!errorText.includes("already exists")) {
            throw new Error(`Failed to create product metadata (HTTP ${createResp.status}): ${errorText || createResp.statusText}`);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("already exists")) {
          throw err;
        }
      }
      // Step 2: Upload Revision
      const revResp = await fetch(`${apiUrl}/api/v1/products/${encodeURIComponent(slug)}/revisions`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          document: canonicalDoc
        })
      });

      if (!revResp.ok) {
        const errorText = await revResp.text().catch(() => "");
        throw new Error(`Failed to upload revision (HTTP ${revResp.status}): ${errorText || revResp.statusText}`);
      }

      const revData = ProductRevisionResponseSchema.parse(await revResp.json());
      const revisionId =
        (revData.data as Record<string, unknown>)?.id ||
        (revData.data as Record<string, unknown>)?.revisionId ||
        (revData.revision as Record<string, unknown>)?.id ||
        (revData.revision as Record<string, unknown>)?.revisionId;

      if (!revisionId || typeof revisionId !== "string") {
        throw new Error("Revision creation succeeded on server, but no valid revision ID was returned. Aborting submission to prevent submitting an unintended revision.");
      }

      // Step 3: Submit to Moderation Queue
      const submitResp = await fetch(`${apiUrl}/api/v1/products/${encodeURIComponent(slug)}/submit`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          revisionId: typeof revisionId === "string" ? revisionId : undefined,
          submissionNotes: typeof args.notes === "string" ? args.notes : undefined,
          isFastTrack: Boolean(args.is_fast_track),
          payOnly: Boolean(args.pay_only)
        })
      });

      const submitText = await submitResp.text().catch(() => "{}");
      let submitJson: unknown;
      try {
        submitJson = JSON.parse(submitText);
      } catch {
        submitJson = {};
      }

      if (submitResp.status === 402) {
        const payData = ProductSubmitPaymentRequiredSchema.parse(submitJson);
        return {
          status: "payment_required",
          slug,
          message: "Payment required to activate directory listing slot.",
          checkoutUrl: payData.checkoutUrl,
          amount: payData.amount,
          isEarlyBird: payData.isEarlyBird,
          slotNumber: payData.slotNumber,
          previewUrl: `${apiUrl}/studio/products/${slug}/preview`
        };
      }

      if (!submitResp.ok) {
        throw new Error(`Failed to submit into review queue (HTTP ${submitResp.status}): ${submitText}`);
      }

      const subSuccess = ProductSubmitSuccessSchema.parse(submitJson);
      const subData = (subSuccess as Record<string, unknown>).data as Record<string, unknown> | undefined;

      return {
        status: "submitted",
        slug,
        submissionId: subData?.submissionId || "submitted",
        caseId: subData?.caseId,
        contentHash,
        previewUrl: `${apiUrl}/studio/products/${slug}/preview`
      };
    }
  },

  // 3. get_product
  {
    name: "get_product",
    description: "Fetch product details and blocks outline from the Next Level Builders Directory by slug (supports JSON or Markdown format).",
    inputSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Product slug identifier"
        },
        format: {
          type: "string",
          enum: ["json", "markdown"],
          description: "Output format ('json' for structured metadata, 'markdown' for LLM-optimized text). Default is 'json'."
        },
        api_url: {
          type: "string",
          description: "Directory API endpoint (optional)"
        }
      },
      required: ["slug"]
    },
    handler: async (args) => {
      if (!args.slug || typeof args.slug !== "string") {
        throw new Error("Missing required 'slug' parameter.");
      }
      const slug = args.slug.trim();
      const apiUrl = validateAllowedApiUrl(typeof args.api_url === "string" ? args.api_url : undefined);
      const format = args.format === "markdown" ? "markdown" : "json";

      if (format === "markdown") {
        const resp = await fetch(`${apiUrl}/api/v1/products/${encodeURIComponent(slug)}/markdown`, {
          headers: { Accept: "text/markdown, text/plain" },
          signal: AbortSignal.timeout(15000)
        });
        if (!resp.ok) {
          throw new Error(`Product '${slug}' markdown not found (HTTP ${resp.status})`);
        }
        const text = await resp.text();
        return { slug, markdown: text };
      }

      const resp = await fetch(`${apiUrl}/api/v1/products/${encodeURIComponent(slug)}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000)
      });

      if (!resp.ok) {
        throw new Error(`Product '${slug}' not found on directory (HTTP ${resp.status})`);
      }

      return resp.json();
    }
  },

  // 4. get_product_markdown
  {
    name: "get_product_markdown",
    description: "Export product details as markdown structured feed formatted for AI agents and LLM context windows.",
    inputSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Product slug identifier"
        },
        api_url: {
          type: "string",
          description: "Directory API endpoint (optional)"
        }
      },
      required: ["slug"]
    },
    handler: async (args) => {
      if (!args.slug || typeof args.slug !== "string") {
        throw new Error("Missing required 'slug' parameter.");
      }
      const slug = args.slug.trim();
      const apiUrl = validateAllowedApiUrl(typeof args.api_url === "string" ? args.api_url : undefined);

      const resp = await fetch(`${apiUrl}/api/v1/products/${encodeURIComponent(slug)}/markdown`, {
        headers: { Accept: "text/markdown, text/plain" },
        signal: AbortSignal.timeout(15000)
      });

      if (!resp.ok) {
        throw new Error(`Product '${slug}' markdown not found (HTTP ${resp.status})`);
      }

      const text = await resp.text();
      return { slug, markdown: text };
    }
  },

  // 5. list_products
  {
    name: "list_products",
    description: "List published directory products with pagination.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of items to return (1-50, default: 20)"
        },
        offset: {
          type: "number",
          description: "Pagination offset (default: 0)"
        },
        api_url: {
          type: "string",
          description: "Directory API endpoint (optional)"
        }
      }
    },
    handler: async (args) => {
      const apiUrl = validateAllowedApiUrl(typeof args.api_url === "string" ? args.api_url : undefined);
      const params = new URLSearchParams();
      if (typeof args.limit === "number") params.set("limit", String(Math.min(50, Math.max(1, args.limit))));
      if (typeof args.offset === "number") params.set("offset", String(Math.max(0, args.offset)));

      const resp = await fetch(`${apiUrl}/api/v1/products?${params.toString()}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000)
      });

      if (!resp.ok) {
        throw new Error(`List products failed (HTTP ${resp.status})`);
      }

      return resp.json();
    }
  },

  // 6. get_leaderboard
  {
    name: "get_leaderboard",
    description: "Get directory community rankings leaderboard by timeframe window (daily, weekly, or monthly).",
    inputSchema: {
      type: "object",
      properties: {
        window: {
          type: "string",
          enum: ["daily", "weekly", "monthly"],
          description: "Leaderboard timeframe window (default: daily)"
        },
        api_url: {
          type: "string",
          description: "Directory API endpoint (optional)"
        }
      }
    },
    handler: async (args) => {
      const apiUrl = validateAllowedApiUrl(typeof args.api_url === "string" ? args.api_url : undefined);
      const windowType = args.window === "weekly" ? "weekly" : args.window === "monthly" ? "monthly" : "daily";

      const resp = await fetch(`${apiUrl}/api/v1/rankings?window=${windowType}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000)
      });

      if (!resp.ok) {
        throw new Error(`Rankings request failed (HTTP ${resp.status})`);
      }

      return resp.json();
    }
  },

  // 7. get_stats
  {
    name: "get_stats",
    description: "Get aggregate Next Level Builders directory metrics (published products, click-outs, registered builders, total votes).",
    inputSchema: {
      type: "object",
      properties: {
        api_url: {
          type: "string",
          description: "Directory API endpoint (optional)"
        }
      }
    },
    handler: async (args) => {
      const apiUrl = validateAllowedApiUrl(typeof args.api_url === "string" ? args.api_url : undefined);

      const resp = await fetch(`${apiUrl}/api/v1/stats`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000)
      });

      if (!resp.ok) {
        throw new Error(`Stats request failed (HTTP ${resp.status})`);
      }

      return resp.json();
    }
  },

  // 8. check_health
  {
    name: "check_health",
    description: "Check database and service health probe on Next Level Builders directory.",
    inputSchema: {
      type: "object",
      properties: {
        api_url: {
          type: "string",
          description: "Directory API endpoint (optional)"
        }
      }
    },
    handler: async (args) => {
      const apiUrl = validateAllowedApiUrl(typeof args.api_url === "string" ? args.api_url : undefined);

      const resp = await fetch(`${apiUrl}/api/health`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000)
      });

      if (!resp.ok) {
        throw new Error(`Health probe returned HTTP ${resp.status}`);
      }

      const json = (await resp.json()) as Record<string, unknown>;
      return {
        status: json.status,
        database: json.database,
        db_name: json.db_name,
        products_count: json.products_count,
        timestamp: json.timestamp
      };
    }
  },

  // 9. cast_vote
  {
    name: "cast_vote",
    description: "Cast an organic community vote for a product. Note: Organic voting requires a verified user session cookie to prevent bot voting.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: {
          type: "string",
          description: "Product UUID to vote for"
        },
        turnstile_token: {
          type: "string",
          description: "Cloudflare Turnstile verification token (optional)"
        },
        session_cookie: {
          type: "string",
          description: "Better Auth user session cookie (required by server for voting)"
        },
        api_url: {
          type: "string",
          description: "Directory API endpoint (optional)"
        }
      },
      required: ["product_id"]
    },
    handler: async (args) => {
      if (!args.product_id || typeof args.product_id !== "string") {
        throw new Error("Missing required 'product_id' parameter.");
      }
      const apiUrl = validateAllowedApiUrl(typeof args.api_url === "string" ? args.api_url : undefined);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json"
      };

      const cookie = typeof args.session_cookie === "string" ? args.session_cookie : process.env.NLB_SESSION_COOKIE;
      if (cookie) {
        headers["Cookie"] = cookie;
      }

      const resp = await fetch(`${apiUrl}/api/v1/votes`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          productId: args.product_id,
          turnstileToken: typeof args.turnstile_token === "string" ? args.turnstile_token : undefined
        })
      });

      const text = await resp.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }

      if (!resp.ok) {
        if (resp.status === 401) {
          throw new Error("Unauthorized (HTTP 401): Organic voting requires a verified user session cookie. Supply 'session_cookie' or set NLB_SESSION_COOKIE.");
        }
        if (resp.status === 409 || text.includes("already voted")) {
          throw new Error("Conflict (HTTP 409): Already voted for this product today.");
        }
        if (resp.status === 429) {
          throw new Error("Rate Limited (HTTP 429): Voting rate limit exceeded. Please wait before voting again.");
        }
        throw new Error(`Failed to cast vote (HTTP ${resp.status}): ${text}`);
      }

      return data;
    }
  },

  // 10. upload_media
  {
    name: "upload_media",
    description: "Upload an image (up to 10MB) or video (up to 100MB) to Next Level Builders storage.",
    inputSchema: {
      type: "object",
      properties: {
        file_base64: {
          type: "string",
          description: "Base64 encoded file content"
        },
        filename: {
          type: "string",
          description: "Filename including extension (e.g., 'screenshot.png', 'demo.mp4')"
        },
        mime_type: {
          type: "string",
          description: "MIME type (e.g., 'image/png', 'video/mp4')"
        },
        folder: {
          type: "string",
          description: "Target subfolder (default: 'uploads')"
        },
        api_key: {
          type: "string",
          description: "Next Level Builders API key (optional)"
        },
        api_url: {
          type: "string",
          description: "Directory API endpoint (optional)"
        }
      },
      required: ["file_base64", "filename"]
    },
    handler: async (args, context) => {
      if (!args.file_base64 || typeof args.file_base64 !== "string") {
        throw new Error("Missing required 'file_base64' parameter.");
      }
      if (!args.filename || typeof args.filename !== "string") {
        throw new Error("Missing required 'filename' parameter.");
      }
      const filename = args.filename.trim();
      const folder = typeof args.folder === "string" ? args.folder.replace(/[^a-z0-9_-]/gi, "") : "uploads";
      const ext = filename.split(".").pop()?.toLowerCase();
      const extMimeMap: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        svg: "image/svg+xml",
        gif: "image/gif",
        mp4: "video/mp4",
        webm: "video/webm",
        mov: "video/quicktime"
      };
      const mimeType = typeof args.mime_type === "string" && args.mime_type.trim()
        ? args.mime_type.toLowerCase()
        : ext ? extMimeMap[ext] : "";

      if (!mimeType || !ALLOWED_MIME_TYPES[mimeType]) {
        throw new Error(`Disallowed or missing MIME type '${mimeType}'. Allowed: ${Object.keys(ALLOWED_MIME_TYPES).join(", ")}`);
      }

      const isVideo = mimeType.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(filename);
      const maxLimit = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
      if (args.file_base64.length * 0.75 > maxLimit * 1.05) {
        throw new Error(`Estimated file size exceeds maximum limit of ${isVideo ? "100MB" : "10MB"}`);
      }

      // Convert base64 to binary buffer
      const base64Data = args.file_base64.replace(/^data:[^;]+;base64,/, "");
      const binaryStr = atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      if (bytes.length > maxLimit) {
        throw new Error(`File size (${(bytes.length / (1024 * 1024)).toFixed(2)}MB) exceeds maximum limit of ${isVideo ? "100MB" : "10MB"}`);
      }

      const { apiUrl, apiKey } = resolveToolEnv(args, context);

      const formData = new FormData();
      const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
      formData.append("file", blob, filename);
      formData.append("folder", folder);

      const headers: Record<string, string> = {
        Accept: "application/json"
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
        headers["x-api-key"] = apiKey;
      }

      const resp = await fetch(`${apiUrl}/api/v1/media/upload`, {
        method: "POST",
        headers,
        body: formData,
        signal: AbortSignal.timeout(30000)
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error(`Media upload failed (HTTP ${resp.status}): ${errText || resp.statusText}`);
      }

      return resp.json();
    }
  },

  // 11. create_checkout
  {
    name: "create_checkout",
    description: "Create a Polar checkout session for directory publishing slots or memberships.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: {
          type: "string",
          description: "Polar product UUID (obtain from /studio or your platform configuration)"
        },
        customer_email: {
          type: "string",
          description: "Customer email address for entitlement delivery"
        },
        product_slug: {
          type: "string",
          description: "Product slug to bind publishing slot to"
        },
        api_url: {
          type: "string",
          description: "Directory API endpoint (optional)"
        }
      },
      required: ["product_id"]
    },
    handler: async (args) => {
      if (!args.product_id || typeof args.product_id !== "string") {
        throw new Error("Missing required 'product_id' parameter.");
      }

      const apiUrl = validateAllowedApiUrl(typeof args.api_url === "string" ? args.api_url : undefined);

      const resp = await fetch(`${apiUrl}/api/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          productId: args.product_id,
          customerEmail: typeof args.customer_email === "string" ? args.customer_email : undefined,
          productSlug: typeof args.product_slug === "string" ? args.product_slug : undefined
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Failed to create checkout session (HTTP ${resp.status}): ${text || resp.statusText}`);
      }

      return resp.json();
    }
  },

  // 12. list_templates
  {
    name: "list_templates",
    description: "Get available Next Level Builders layout templates with sample block blueprints.",
    inputSchema: {
      type: "object",
      properties: {
        template_name: {
          type: "string",
          description: "Optional template name or slug to get a single detailed template"
        }
      }
    },
    handler: async (args) => {
      if (typeof args.template_name === "string" && args.template_name) {
        const t = getTemplate(args.template_name);
        if (!t) {
          throw new Error(`Template '${args.template_name}' not found.`);
        }
        return {
          template: {
            id: t.id,
            name: t.name,
            slug: t.slug,
            description: t.description,
            recommendedCategory: t.recommendedCategory,
            blockTypes: t.blockTypes
          }
        };
      }

      const templates = listTemplates();
      return {
        templates: templates.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          description: t.description,
          recommendedCategory: t.recommendedCategory,
          blockTypes: t.blockTypes
        }))
      };
    }
  },

  // 13. list_api_keys
  {
    name: "list_api_keys",
    description: "List active developer API keys for the current account. Note: Requires session cookie.",
    inputSchema: {
      type: "object",
      properties: {
        session_cookie: {
          type: "string",
          description: "Better Auth session cookie"
        },
        api_url: {
          type: "string",
          description: "Directory API endpoint (optional)"
        }
      }
    },
    handler: async (args) => {
      const apiUrl = validateAllowedApiUrl(typeof args.api_url === "string" ? args.api_url : undefined);
      const headers: Record<string, string> = {
        Accept: "application/json"
      };
      const cookie = typeof args.session_cookie === "string" ? args.session_cookie : process.env.NLB_SESSION_COOKIE;
      if (cookie) {
        headers["Cookie"] = cookie;
      }

      const resp = await fetch(`${apiUrl}/api/v1/api-keys`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(15000)
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        if (resp.status === 401) {
          throw new Error("Unauthorized (HTTP 401): API key management requires a signed-in user session cookie. Supply 'session_cookie' or set NLB_SESSION_COOKIE.");
        }
        throw new Error(`Failed to list API keys (HTTP ${resp.status}): ${errText || resp.statusText}`);
      }

      return resp.json();
    }
  },

  // 14. create_api_key
  {
    name: "create_api_key",
    description: "Create a new developer API key. Note: Requires user session cookie. Raw secret key is returned only once.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name or label for the API key"
        },
        organization_id: {
          type: "string",
          description: "Optional organization UUID"
        },
        expires_days: {
          type: "number",
          description: "Optional expiration in days (1-365)"
        },
        session_cookie: {
          type: "string",
          description: "Better Auth session cookie"
        },
        api_url: {
          type: "string",
          description: "Directory API endpoint (optional)"
        }
      },
      required: ["name"]
    },
    handler: async (args) => {
      if (!args.name || typeof args.name !== "string") {
        throw new Error("Missing required 'name' parameter.");
      }
      const apiUrl = validateAllowedApiUrl(typeof args.api_url === "string" ? args.api_url : undefined);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json"
      };
      const cookie = typeof args.session_cookie === "string" ? args.session_cookie : process.env.NLB_SESSION_COOKIE;
      if (cookie) {
        headers["Cookie"] = cookie;
      }

      const resp = await fetch(`${apiUrl}/api/v1/api-keys`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: args.name,
          organizationId: typeof args.organization_id === "string" ? args.organization_id : undefined,
          expiresDays: typeof args.expires_days === "number" ? args.expires_days : undefined
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        if (resp.status === 401) {
          throw new Error("Unauthorized (HTTP 401): API key creation requires a signed-in user session cookie. Supply 'session_cookie' or set NLB_SESSION_COOKIE.");
        }
        throw new Error(`Failed to create API key (HTTP ${resp.status}): ${errText || resp.statusText}`);
      }

      return resp.json();
    }
  },

  // 15. revoke_api_key
  {
    name: "revoke_api_key",
    description: "Revoke an existing developer API key by ID. Note: Requires user session cookie.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "API key ID to revoke"
        },
        session_cookie: {
          type: "string",
          description: "Better Auth session cookie"
        },
        api_url: {
          type: "string",
          description: "Directory API endpoint (optional)"
        }
      },
      required: ["id"]
    },
    handler: async (args) => {
      if (!args.id || typeof args.id !== "string") {
        throw new Error("Missing required 'id' parameter.");
      }
      const apiUrl = validateAllowedApiUrl(typeof args.api_url === "string" ? args.api_url : undefined);
      const headers: Record<string, string> = {
        Accept: "application/json"
      };
      const cookie = typeof args.session_cookie === "string" ? args.session_cookie : process.env.NLB_SESSION_COOKIE;
      if (cookie) {
        headers["Cookie"] = cookie;
      }

      const resp = await fetch(`${apiUrl}/api/v1/api-keys/${encodeURIComponent(args.id)}`, {
        method: "DELETE",
        headers,
        signal: AbortSignal.timeout(15000)
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        if (resp.status === 401) {
          throw new Error("Unauthorized (HTTP 401): API key revocation requires a signed-in user session cookie. Supply 'session_cookie' or set NLB_SESSION_COOKIE.");
        }
        throw new Error(`Failed to revoke API key (HTTP ${resp.status}): ${errText || resp.statusText}`);
      }

      return resp.json();
    }
  }
];
