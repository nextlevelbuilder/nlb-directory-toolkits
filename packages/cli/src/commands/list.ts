import { resolveConfig } from "../config.js";
import { NlbApiClient } from "../api/client.js";
import pc from "picocolors";

export interface ListOptions {
  url?: string;
  apiKey?: string;
  limit?: string;
  offset?: string;
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
  let offsetNum = options.offset ? parseInt(options.offset, 10) : 0;
  if (options.page && !options.offset) {
    const pageNum = parseInt(options.page, 10);
    if (!isNaN(pageNum) && pageNum > 1) {
      offsetNum = (pageNum - 1) * (isNaN(limitNum) ? 20 : limitNum);
    }
  }

  try {
    const resp = await client.listProducts({
      limit: isNaN(limitNum) ? 20 : Math.min(50, Math.max(1, limitNum)),
      offset: isNaN(offsetNum) ? 0 : Math.max(0, offsetNum)
    });

    if (options.json) {
      console.log(JSON.stringify(resp, null, 2));
      return;
    }

    const items = resp.data || (resp as Record<string, unknown>).products || [];
    if (!Array.isArray(items) || items.length === 0) {
      console.log(pc.yellow(`No products found on ${config.apiUrl}.`));
      return;
    }

    const count = resp.pagination?.count ?? items.length;
    console.log(pc.cyan(`\n📦 Next Level Builders Directory Products (${count} in current view):`));
    console.log(pc.gray("─".repeat(80)));
    console.log(
      `${pc.bold("TRUST")} │ ${pc.bold("SLUG".padEnd(24))} │ ${pc.bold("TITLE".padEnd(32))} │ ${pc.bold("STATUS")}`
    );
    console.log(pc.gray("─".repeat(80)));

    for (const item of items) {
      const prod = item as Record<string, unknown>;
      const trustScore = typeof prod.trustScore === "number" ? prod.trustScore : 0;
      const scoreColor = trustScore >= 80 ? pc.green : trustScore >= 50 ? pc.yellow : pc.red;
      const status = String(prod.status || "published");
      const statusColor = status === "published" ? pc.green : status === "pending_review" ? pc.yellow : pc.gray;

      const scoreStr = scoreColor(`${trustScore.toString().padStart(3)}%`);
      const slugStr = String(prod.slug || "").slice(0, 24).padEnd(24);
      const titleStr = String(prod.title || prod.name || "").slice(0, 32).padEnd(32);
      const statusStr = statusColor(status);

      console.log(`${scoreStr} │ ${slugStr} │ ${titleStr} │ ${statusStr}`);
    }
    console.log(pc.gray("─".repeat(80)));
    console.log(pc.dim(`Offset: ${resp.pagination?.offset ?? offsetNum}, Limit: ${resp.pagination?.limit ?? limitNum} (Showing ${items.length} products)\n`));
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
