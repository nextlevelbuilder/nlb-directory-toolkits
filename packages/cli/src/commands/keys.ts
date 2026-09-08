import { resolveConfig } from "../config.js";
import { NlbApiClient } from "../api/client.js";
import pc from "picocolors";

export interface KeysOptions {
  org?: string;
  days?: string;
  cookie?: string;
  url?: string;
  json?: boolean;
}

export async function keysCommand(
  action = "list",
  targetArg?: string,
  options: KeysOptions = {}
): Promise<void> {
  const config = resolveConfig(options);
  const client = new NlbApiClient({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey
  });

  const sessionCookie = options.cookie || process.env.NLB_SESSION_COOKIE;

  try {
    switch (action.toLowerCase()) {
      case "list": {
        const resp = await client.listApiKeys(sessionCookie);
        if (options.json) {
          console.log(JSON.stringify(resp, null, 2));
          return;
        }

        const keys = resp.data || [];
        console.log(pc.cyan(`\n🔑 Developer API Keys (${keys.length} active):\n`));
        if (keys.length === 0) {
          console.log(pc.yellow("  No API keys found for this account.\n"));
          return;
        }

        console.log(pc.gray("─".repeat(75)));
        console.log(
          `${pc.bold("ID".padEnd(26))} │ ${pc.bold("NAME".padEnd(20))} │ ${pc.bold("PREFIX".padEnd(12))} │ ${pc.bold("ENABLED")}`
        );
        console.log(pc.gray("─".repeat(75)));

        for (const k of keys) {
          const idStr = String(k.id || "").slice(0, 26).padEnd(26);
          const nameStr = String(k.name || "").slice(0, 20).padEnd(20);
          const prefixStr = String(k.prefix || k.start || "nlb_live_...").slice(0, 12).padEnd(12);
          const statusStr = k.enabled ? pc.green("✔ Active") : pc.red("✖ Disabled");

          console.log(`${idStr} │ ${nameStr} │ ${prefixStr} │ ${statusStr}`);
        }
        console.log(pc.gray("─".repeat(75)));
        console.log("");
        break;
      }

      case "create": {
        const keyName = targetArg || "CLI Key";
        const expiresDays = options.days ? parseInt(options.days, 10) : undefined;
        const resp = await client.createApiKey(
          {
            name: keyName,
            organizationId: options.org,
            expiresDays: !isNaN(expiresDays as number) ? expiresDays : undefined
          },
          sessionCookie
        );

        if (options.json) {
          console.log(JSON.stringify(resp, null, 2));
          return;
        }

        console.log(pc.green(`\n✔ API Key '${keyName}' created successfully!`));
        console.log(pc.yellow(`\n⚠️ Make sure to copy your API key now. It will NOT be shown again:`));
        console.log(`\n  ${pc.bold(pc.cyan(resp.data.key))}\n`);
        break;
      }

      case "revoke":
      case "delete": {
        if (!targetArg) {
          console.error(pc.red("✖ Missing required key ID to revoke. Usage: nlb keys revoke <keyId>"));
          process.exitCode = 1;
          return;
        }

        const resp = await client.revokeApiKey(targetArg, sessionCookie);
        if (options.json) {
          console.log(JSON.stringify(resp, null, 2));
          return;
        }

        console.log(pc.green(`\n✔ API key '${targetArg}' revoked successfully.\n`));
        break;
      }

      default:
        console.error(pc.red(`✖ Unknown action '${action}'. Available: list, create, revoke`));
        process.exitCode = 1;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: msg }, null, 2));
    } else {
      if (msg.includes("401") || msg.includes("Unauthorized")) {
        console.error(pc.red(`\n✖ Unauthorized: API key management requires a signed-in user session cookie.`));
        console.error(pc.dim("  Pass --cookie <session_cookie> or set NLB_SESSION_COOKIE."));
        console.error(pc.dim("  Sign in to https://nextlevelbuilder.io to obtain your session.\n"));
      } else {
        console.error(pc.red(`\n✖ API Key operation failed: ${msg}\n`));
      }
    }
    process.exitCode = 1;
  }
}
