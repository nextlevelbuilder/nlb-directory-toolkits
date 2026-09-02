import {
  ProductDocumentSchema,
  AuthorProductDocumentSchema,
  sanitizeAuthorDocument,
  computeContentHash,
  listTemplates,
  getTemplate,
  ProductCreateResponseSchema,
  ProductRevisionResponseSchema,
  ProductSubmitResponseSchema
} from "@nextlevelbuilder/contracts";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>, context?: { workerAuth?: boolean }) => Promise<unknown>;
}

const ALLOWED_HOSTS = new Set([
  "nextlevelbuilder.io",
  "www.nextlevelbuilder.io",
  "staging.nextlevelbuilder.io",
  "localhost",
  "127.0.0.1"
]);

/**
 * Validates that an API URL belongs to an authorized NextLevelBuilder domain or local loopback.
 * Prevents SSRF and credential exfiltration.
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
  const isLoopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");

  if (!ALLOWED_HOSTS.has(hostname) && !isLoopback) {
    throw new Error(
      `Access to '${hostname}' is disallowed. Allowed endpoints: https://nextlevelbuilder.io, https://staging.nextlevelbuilder.io, or localhost.`
    );
  }

  if (!isLoopback && parsed.protocol.toLowerCase() !== "https:") {
    throw new Error("Remote directory API endpoints must use HTTPS.");
  }

  return parsed.origin;
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
          description: "The complete ProductDocument JSON object containing name, slug, tagline, description, category, tags, websiteUrl, and blocks."
        }
      },
      required: ["document"]
    },
    handler: async (args) => {
      if (!args.document || typeof args.document !== "object") {
        throw new Error("Missing required 'document' parameter.");
      }

      const parseResult = AuthorProductDocumentSchema.safeParse(args.document);

      if (!parseResult.success) {
        return {
          valid: false,
          errors: parseResult.error.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
            code: e.code
          }))
        };
      }

      const sanitized = sanitizeAuthorDocument(parseResult.data);
      const contentHash = await computeContentHash(sanitized);
      return {
        valid: true,
        contentHash,
        hashVersion: "v1",
        product: {
          name: sanitized.name,
          slug: sanitized.slug,
          category: sanitized.category,
          blocksCount: sanitized.blocks.length
        }
      };
    }
  },

  // 2. submit_product
  {
    name: "submit_product",
    description: "Submit a validated product document into the Next Level Builders Directory moderation review queue.",
    inputSchema: {
      type: "object",
      properties: {
        document: {
          type: "object",
          description: "The complete ProductDocument JSON object"
        },
        api_key: {
          type: "string",
          description: "Next Level Builders API key (or uses caller-configured credential)"
        },
        api_url: {
          type: "string",
          description: "Directory API endpoint (allowed: https://nextlevelbuilder.io or https://staging.nextlevelbuilder.io)"
        },
        notes: {
          type: "string",
          description: "Optional notes for the review team"
        }
      },
      required: ["document"]
    },
    handler: async (args, context) => {
      // Authenticate mutation access first:
      if (context && context.workerAuth === false && (!args.api_key || typeof args.api_key !== "string")) {
        throw new Error("Unauthorized: Worker authentication token or explicit api_key parameter is required to submit products.");
      }

      if (!args.document || typeof args.document !== "object") {
        throw new Error("Missing required 'document' parameter.");
      }

      // Strictly parse with AuthorProductDocumentSchema to reject client-assigned trust signals
      const parseResult = AuthorProductDocumentSchema.safeParse(args.document);
      if (!parseResult.success) {
        throw new Error(
          `Document schema invalid: ${parseResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")}`
        );
      }

      // Sanitize document to guarantee unprivileged initial trust state
      const doc = sanitizeAuthorDocument(parseResult.data);
      const contentHash = await computeContentHash(doc);
      const apiUrl = validateAllowedApiUrl(typeof args.api_url === "string" ? args.api_url : undefined);

      const apiKey = typeof args.api_key === "string" && args.api_key.trim() ? args.api_key.trim() : process.env.NLB_API_KEY;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json"
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const timeoutSignal = AbortSignal.timeout(15000);

      // Step 1: Create Product Metadata
      const createResp = await fetch(`${apiUrl}/api/v1/products`, {
        method: "POST",
        headers,
        signal: timeoutSignal,
        body: JSON.stringify({
          name: doc.name,
          slug: doc.slug,
          tagline: doc.tagline,
          description: doc.description,
          category: doc.category,
          tags: doc.tags,
          websiteUrl: doc.websiteUrl,
          repoUrl: doc.repoUrl,
          logoUrl: doc.logoUrl
        })
      });

      if (!createResp.ok) {
        const errorText = await createResp.text().catch(() => "");
        throw new Error(`Failed to create product metadata (HTTP ${createResp.status}): ${errorText || createResp.statusText}`);
      }

      const createData = ProductCreateResponseSchema.parse(await createResp.json());
      if (!createData.success) {
        throw new Error(`Directory rejected product creation: ${createData.message}`);
      }

      // Step 2: Create Revision
      const revResp = await fetch(`${apiUrl}/api/v1/products/${encodeURIComponent(doc.slug)}/revisions`, {
        method: "POST",
        headers,
        signal: timeoutSignal,
        body: JSON.stringify({
          contentHash,
          hashVersion: "v1",
          document: doc
        })
      });

      if (!revResp.ok) {
        const errorText = await revResp.text().catch(() => "");
        throw new Error(`Failed to upload revision (HTTP ${revResp.status}): ${errorText || revResp.statusText}`);
      }

      const revData = ProductRevisionResponseSchema.parse(await revResp.json());
      if (!revData.success || !revData.revision.revisionId) {
        throw new Error(`Directory rejected revision upload: ${revData.message || "Missing revisionId"}`);
      }

      const revisionId = revData.revision.revisionId;

      // Step 3: Submit Revision
      const submitResp = await fetch(`${apiUrl}/api/v1/products/${encodeURIComponent(doc.slug)}/submit`, {
        method: "POST",
        headers,
        signal: timeoutSignal,
        body: JSON.stringify({
          revisionId,
          notes: typeof args.notes === "string" ? args.notes : undefined
        })
      });

      if (!submitResp.ok) {
        const errorText = await submitResp.text().catch(() => "");
        throw new Error(`Failed to submit into review queue (HTTP ${submitResp.status}): ${errorText || submitResp.statusText}`);
      }

      const submitData = ProductSubmitResponseSchema.parse(await submitResp.json());
      if (!submitData.success) {
        throw new Error(`Directory rejected submission: ${submitData.message}`);
      }

      return {
        success: true,
        slug: doc.slug,
        submissionId: submitData.submissionId,
        status: submitData.status,
        contentHash,
        product: createData.product
      };
    }
  },

  // 3. get_product
  {
    name: "get_product",
    description: "Fetch full product details and blocks outline from the Next Level Builders Directory by slug.",
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

  // 4. search_products
  {
    name: "search_products",
    description: "Search Next Level Builders Directory by keyword query, category, or tag.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keyword"
        },
        category: {
          type: "string",
          description: "Optional category filter"
        },
        tag: {
          type: "string",
          description: "Optional tag filter"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10, max: 50)"
        },
        api_url: {
          type: "string",
          description: "Directory API endpoint (optional)"
        }
      },
      required: ["query"]
    },
    handler: async (args) => {
      if (!args.query || typeof args.query !== "string") {
        throw new Error("Missing required 'query' parameter.");
      }
      const q = args.query.trim();
      const apiUrl = validateAllowedApiUrl(typeof args.api_url === "string" ? args.api_url : undefined);
      const params = new URLSearchParams();
      params.set("q", q);
      if (typeof args.category === "string") params.set("category", args.category);
      if (typeof args.tag === "string") params.set("tag", args.tag);
      if (typeof args.limit === "number") params.set("limit", String(Math.min(50, Math.max(1, args.limit))));

      const resp = await fetch(`${apiUrl}/api/v1/search?${params.toString()}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000)
      });

      if (!resp.ok) {
        throw new Error(`Search request failed (HTTP ${resp.status})`);
      }

      return resp.json();
    }
  },

  // 5. get_leaderboard
  {
    name: "get_leaderboard",
    description: "Get directory leaderboard ranked by community trust scores and upvotes.",
    inputSchema: {
      type: "object",
      properties: {
        timeframe: {
          type: "string",
          enum: ["daily", "weekly", "monthly", "all_time"],
          description: "Leaderboard timeframe (default: all_time)"
        },
        limit: {
          type: "number",
          description: "Maximum items (default: 10, max: 50)"
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
      if (typeof args.timeframe === "string") params.set("timeframe", args.timeframe);
      if (typeof args.limit === "number") params.set("limit", String(Math.min(50, Math.max(1, args.limit))));

      const resp = await fetch(`${apiUrl}/api/v1/leaderboard?${params.toString()}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000)
      });

      if (!resp.ok) {
        throw new Error(`Leaderboard request failed (HTTP ${resp.status})`);
      }

      return resp.json();
    }
  },

  // 6. list_templates
  {
    name: "list_templates",
    description: "Get available Next Level Builders layout templates (SaaS Launch, AI Agent / Tool, Developer CLI, Curated Community, Minimalist Showcase) with sample blocks.",
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
            name: t.name,
            slug: t.slug,
            description: t.description,
            recommendedCategory: t.recommendedCategory,
            blockTypes: t.blockTypes,
            sampleBlocks: t.sampleBlocks
          }
        };
      }

      const templates = listTemplates();
      return {
        templates: templates.map((t) => ({
          name: t.name,
          slug: t.slug,
          description: t.description,
          recommendedCategory: t.recommendedCategory,
          blockTypes: t.blockTypes
        }))
      };
    }
  }
];
