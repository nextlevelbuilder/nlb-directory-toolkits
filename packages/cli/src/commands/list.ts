import { resolveConfig } from "../config.js";
import { NlbApiClient } from "../api/client.js";
import pc from "picocolors";

export interface ListOptions {
  url?: string;
  apiKey?: string;
  category?: string;
  tag?: string;
  status?: "draft" | "pending_review" | "published" | "rejected";
  limit?: string;
  page?: string;
  json?: boolean;
}

export async function listCommand(options: ListOptions = {}): Promise<void> {
  const config = resolveConfig(options);
  const client = new NlbApiClient({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey
  });

  const limitNum = options.limit ? parseInt(options.limit, 10) : 20;
  const pageNum = options.page ? parseInt(options.page, 10) : 1;
  try {
    const resp = await client.listProducts({
      category: options.category,
      tag: options.tag,
      status: options.status,
      limit: isNaN(limitNum) ? 20 : limitNum,
      page: isNaN(pageNum) ? 1 : pageNum,
      sort: "trust_score"
    });

    if (options.json) {
      console.log(JSON.stringify(resp, null, 2));
      return;
    }

    if (resp.products.length === 0) {
      console.log(pc.yellow(`No products found on ${config.apiUrl}.`));
      return;
    }

    console.log(pc.cyan(`\n📦 Next Level Builders Directory Products (${resp.pagination.total} total):`));
    console.log(pc.gray("─".repeat(80)));
    console.log(
      `${pc.bold("TRUST")} │ ${pc.bold("SLUG".padEnd(22))} │ ${pc.bold("NAME".padEnd(24))} │ ${pc.bold("CATEGORY".padEnd(14))} │ ${pc.bold("STATUS")}`
    );
    console.log(pc.gray("─".repeat(80)));

    for (const prod of resp.products) {
      const scoreColor = prod.trustScore >= 80 ? pc.green : prod.trustScore >= 50 ? pc.yellow : pc.red;
      const statusColor = prod.status === "published" ? pc.green : prod.status === "pending_review" ? pc.yellow : pc.gray;

      const scoreStr = scoreColor(`${prod.trustScore.toString().padStart(3)}%`);
      const slugStr = prod.slug.slice(0, 22).padEnd(22);
      const nameStr = prod.name.slice(0, 24).padEnd(24);
      const catStr = prod.category.slice(0, 14).padEnd(14);
      const statusStr = statusColor(prod.status);

      console.log(`${scoreStr} │ ${slugStr} │ ${nameStr} │ ${catStr} │ ${statusStr}`);
    }
    console.log(pc.gray("─".repeat(80)));
    console.log(pc.dim(`Page ${resp.pagination.page} of ${resp.pagination.totalPages} (Showing ${resp.products.length} products)\n`));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: msg }, null, 2));
    } else {
      console.error(pc.red(`✖ Failed to list products: ${msg}`));
    }
    process.exitCode = 1;
  }
}
