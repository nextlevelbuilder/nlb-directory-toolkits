import { resolveConfig } from "../config.js";
import { NlbApiClient } from "../api/client.js";
import pc from "picocolors";

export interface VoteOptions {
  token?: string;
  cookie?: string;
  url?: string;
  json?: boolean;
}

export async function voteCommand(
  productId: string,
  options: VoteOptions = {}
): Promise<void> {
  const config = resolveConfig(options);
  const client = new NlbApiClient({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey
  });

  try {
    const resp = await client.castVote(
      {
        productId,
        turnstileToken: options.token
      },
      options.cookie || process.env.NLB_SESSION_COOKIE
    );

    if (options.json) {
      console.log(JSON.stringify({ success: true, data: resp.data }, null, 2));
      return;
    }

    console.log(pc.green(`\n✔ Vote successfully cast for product ${pc.bold(productId)}!`));
    console.log(pc.dim("Thank you for supporting verified indie builders.\n"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: msg }, null, 2));
    } else {
      if (msg.includes("401") || msg.includes("Unauthorized")) {
        console.error(pc.red(`\n✖ Unauthorized: Organic voting requires a verified user session cookie.`));
        console.error(pc.dim("  To cast a vote from the CLI, pass --cookie <session_cookie> or set NLB_SESSION_COOKIE."));
        console.error(pc.dim("  Sign in to https://nextlevelbuilder.io to obtain your session.\n"));
      } else if (msg.includes("409") || msg.includes("already voted")) {
        console.error(pc.yellow(`\n⚠️ You have already voted for this product today (one vote per UTC day allowed).\n`));
      } else if (msg.includes("429") || msg.includes("Rate limit")) {
        console.error(pc.yellow(`\n⚠️ Rate limit exceeded (maximum 15 votes/min). Please try again shortly.\n`));
      } else {
        console.error(pc.red(`\n✖ Failed to cast vote: ${msg}\n`));
      }
    }
    process.exitCode = 1;
  }
}
