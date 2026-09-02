import { resolveConfig } from "../config.js";
import { NlbApiClient } from "../api/client.js";
import pc from "picocolors";

export interface StatusOptions {
  url?: string;
  apiKey?: string;
  json?: boolean;
}

export async function statusCommand(slug: string, options: StatusOptions = {}): Promise<void> {
  const config = resolveConfig(options);
  const client = new NlbApiClient({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey
  });

  try {
    const statusResp = await client.getProductStatus(slug);

    if (options.json) {
      console.log(JSON.stringify(statusResp, null, 2));
      return;
    }

    const statusBadge =
      statusResp.status === "published"
        ? pc.bgGreen(pc.black(" PUBLISHED "))
        : statusResp.status === "pending_review"
          ? pc.bgYellow(pc.black(" PENDING REVIEW "))
          : statusResp.status === "rejected"
            ? pc.bgRed(pc.white(" REJECTED "))
            : pc.bgWhite(pc.black(" DRAFT "));

    console.log(pc.cyan(`\n📊 Moderation Status: ${pc.bold(slug)}`));
    console.log(`  • Status:       ${statusBadge}`);
    console.log(`  • Trust Score:  ${pc.green(`${statusResp.trustScore}%`)}`);
    if (statusResp.activeRevisionId) {
      console.log(`  • Revision ID:  ${statusResp.activeRevisionId}`);
    }
    if (statusResp.contentHash) {
      console.log(`  • Content Hash: ${pc.dim(statusResp.contentHash)}`);
    }
    console.log(`  • Last Updated: ${statusResp.lastUpdated}\n`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: msg }, null, 2));
    } else {
      console.error(pc.red(`✖ Failed to check status for '${slug}': ${msg}`));
    }
    process.exitCode = 1;
  }
}
