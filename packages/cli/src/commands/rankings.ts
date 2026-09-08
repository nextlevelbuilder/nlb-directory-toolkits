import { resolveConfig } from "../config.js";
import { NlbApiClient } from "../api/client.js";
import pc from "picocolors";

export interface RankingsOptions {
  url?: string;
  apiKey?: string;
  json?: boolean;
}

export async function rankingsCommand(
  windowArg?: string,
  options: RankingsOptions = {}
): Promise<void> {
  const config = resolveConfig(options);
  const client = new NlbApiClient({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey
  });

  const rawWindow = (windowArg || "daily").toLowerCase().trim();
  const windowType: "daily" | "weekly" | "monthly" =
    rawWindow === "weekly" ? "weekly" : rawWindow === "monthly" ? "monthly" : "daily";
  try {
    const resp = await client.getRankings({ window: windowType });

    if (options.json) {
      console.log(JSON.stringify(resp, null, 2));
      return;
    }

    const snapshot = resp.data;
    const ranks = snapshot?.ranks || [];

    console.log(pc.cyan(`\n🏆 Next Level Builders Community Leaderboard (${windowType.toUpperCase()}):`));
    if (snapshot?.windowDate) {
      console.log(pc.dim(`Window Date: ${snapshot.windowDate}`));
    }
    console.log(pc.gray("─".repeat(70)));
    console.log(
      `${pc.bold("RANK")} │ ${pc.bold("VOTES".padEnd(8))} │ ${pc.bold("SCORE".padEnd(8))} │ ${pc.bold("PRODUCT ID")}`
    );
    console.log(pc.gray("─".repeat(70)));

    if (ranks.length === 0) {
      console.log(pc.yellow("  No rankings recorded for this timeframe yet.\n"));
      return;
    }

    for (const item of ranks) {
      const rankBadge = item.rank === 1 ? pc.yellow(" 🥇 1") : item.rank === 2 ? pc.white(" 🥈 2") : item.rank === 3 ? pc.red(" 🥉 3") : ` #${String(item.rank).padStart(2)}`;
      const voteStr = pc.bold(String(item.voteCount).padEnd(8));
      const scoreStr = pc.green(String(item.score).padEnd(8));
      const prodStr = pc.blue(item.productId);

      console.log(`${rankBadge.padEnd(5)} │ ${voteStr} │ ${scoreStr} │ ${prodStr}`);
    }
    console.log(pc.gray("─".repeat(70)));
    console.log("");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: msg }, null, 2));
    } else {
      console.error(pc.red(`✖ Failed to load rankings: ${msg}`));
    }
    process.exitCode = 1;
  }
}
