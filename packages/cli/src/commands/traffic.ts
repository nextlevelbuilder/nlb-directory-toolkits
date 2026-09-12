import { resolveConfig } from "../config.js";
import { NlbApiClient } from "../api/client.js";
import { sanitizeTerminalText } from "../preview/ascii.js";
import pc from "picocolors";

export interface TrafficOptions {
  apiKey?: string;
  url?: string;
  from?: string;
  to?: string;
  json?: boolean;
}

export async function trafficCommand(slug: string, options: TrafficOptions = {}): Promise<void> {
  const config = resolveConfig(options);
  const client = new NlbApiClient({ baseUrl: config.apiUrl, apiKey: config.apiKey });
  try {
    const response = await client.getProductTraffic(slug, { from: options.from, to: options.to });
    if (options.json) {
      console.log(JSON.stringify(response, null, 2));
      return;
    }
    const data = response.data;
    console.log(pc.cyan(`\nTraffic for ${sanitizeTerminalText(slug)} (NLB product page)`));
    console.log(`${data.from} → ${data.to}`);
    console.log(`Page views: ${data.pageViews} | Daily visitor sessions: ${data.visitors} | Outbound clicks: ${data.outboundClicks} | Active visitors: ${data.activeVisitors}`);
    console.log("Visitor sessions reset each UTC day; a returning session on the next day counts again.");
    console.log("\nDate         Page views  Visitors  Outbound clicks");
    for (const day of data.series) {
      console.log(`${day.date}   ${day.pageViews}  ${day.visitors}  ${day.outboundClicks}`);
    }
    for (const [label, rows] of [["Referrers", data.referrers], ["Countries", data.countries], ["Devices", data.devices]] as const) {
      console.log(`\n${label}:`);
      for (const row of rows) console.log(`  ${sanitizeTerminalText(row.name)}: ${row.count}`);
    }
    console.log(pc.dim(`\nSource: ${data.source}; updated: ${data.updatedAt}\n`));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.json) console.log(JSON.stringify({ success: false, error: message }, null, 2));
    else console.error(pc.red(`Failed to load product traffic: ${sanitizeTerminalText(message)}`));
    process.exitCode = 1;
  }
}
