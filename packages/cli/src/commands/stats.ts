import { resolveConfig } from "../config.js";
import { NlbApiClient } from "../api/client.js";
import pc from "picocolors";

export interface StatsOptions {
  url?: string;
  json?: boolean;
}

export async function statsCommand(options: StatsOptions = {}): Promise<void> {
  const config = resolveConfig(options);
  const client = new NlbApiClient({
    baseUrl: config.apiUrl
  });

  try {
    const resp = await client.getStats();

    if (options.json) {
      console.log(JSON.stringify(resp, null, 2));
      return;
    }

    const stats = resp.stats;
    if (!stats) {
      console.log(pc.yellow(`\n⚠️ Directory stats are temporarily unavailable on ${config.apiUrl}.\n`));
      return;
    }

    console.log(pc.cyan(`\n📊 Next Level Builders Directory Live Metrics:\n`));
    console.log(`  • Published Products:   ${pc.green(pc.bold(stats.publishedCount.toLocaleString()))}`);
    console.log(`  • Outbound Click-outs:  ${pc.blue(pc.bold(stats.outboundClicks.toLocaleString()))}`);
    console.log(`  • Registered Builders:  ${pc.magenta(pc.bold(stats.registeredBuilders.toLocaleString()))}`);
    console.log(`  • Total Community Votes:${pc.yellow(pc.bold(stats.totalVotes.toLocaleString()))}`);
    if (resp.updatedAt) {
      console.log(pc.dim(`\n  Updated at: ${resp.updatedAt}`));
    }
    console.log("");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: msg }, null, 2));
    } else {
      console.error(pc.red(`✖ Failed to load directory stats: ${msg}`));
    }
    process.exitCode = 1;
  }
}
