import { Command } from "commander";
import { validateCommand } from "./commands/validate.js";
import { previewCommand } from "./commands/preview.js";
import { submitCommand } from "./commands/submit.js";
import { listCommand } from "./commands/list.js";
import { getCommand } from "./commands/get.js";
import { keysCommand } from "./commands/keys.js";
import { templateCommand } from "./commands/template.js";
import { configCommand } from "./commands/config.js";
import { doctorCommand } from "./commands/doctor.js";
import { rankingsCommand } from "./commands/rankings.js";
import { statsCommand } from "./commands/stats.js";
import { trafficCommand, type TrafficOptions } from "./commands/traffic.js";
import { voteCommand } from "./commands/vote.js";
import { uploadCommand } from "./commands/upload.js";
import { checkoutCommand } from "./commands/checkout.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("nlb")
    .description("Next Level Builders Directory CLI — validate, preview, submit, inspect, and interact with directory products")
    .version("0.2.1");

  program
    .command("validate")
    .description("Validate product listing JSON against contracts and compute canonical SHA-256 hash")
    .argument("<file>", "Path to product document JSON file")
    .option("--json", "Output result in machine-readable JSON format")
    .action(async (file: string, opts: { json?: boolean }) => {
      await validateCommand(file, opts);
    });

  program
    .command("preview")
    .description("Render formatted ASCII and Unicode block preview in terminal")
    .argument("<file>", "Path to product document JSON file")
    .option("--json", "Output raw preview document object in JSON format")
    .action(async (file: string, opts: { json?: boolean }) => {
      await previewCommand(file, opts);
    });

  program
    .command("submit")
    .description("Submit product revision to Next Level Builders Directory review queue")
    .argument("<file>", "Path to product document JSON file")
    .option("-o, --org <orgId>", "Organization UUID owner (find at /studio)")
    .option("-k, --api-key <key>", "NextLevelBuilder API Key (or set NLB_API_KEY env)")
    .option("-u, --url <url>", "Directory API base URL (default: https://nextlevelbuilder.io)")
    .option("-n, --notes <notes>", "Optional submission notes for reviewers")
    .option("--fast-track", "Request fast-track moderation review")
    .option("--pay-only", "Generate Polar checkout session link without immediate submission")
    .option("--dry-run", "Validate and simulate submission without sending network mutation")
    .option("--json", "Output result in machine-readable JSON format")
    .action(async (file: string, opts: { org?: string; apiKey?: string; url?: string; notes?: string; fastTrack?: boolean; payOnly?: boolean; dryRun?: boolean; json?: boolean }) => {
      await submitCommand(file, opts);
    });

  program
    .command("list")
    .description("List products registered on Next Level Builders Directory")
    .option("-u, --url <url>", "Directory API base URL")
    .option("-l, --limit <limit>", "Max products to return (1-50, default: 20)")
    .option("--offset <offset>", "Pagination offset (default: 0)")
    .option("-p, --page <page>", "Page number (calculated into offset)")
    .option("--json", "Output products list in machine-readable JSON format")
    .action(async (opts: { url?: string; limit?: string; offset?: string; page?: string; json?: boolean }) => {
      await listCommand(opts);
    });

  program
    .command("get")
    .description("Fetch product details and block outline by slug")
    .argument("<slug>", "Product slug identifier")
    .option("-u, --url <url>", "Directory API base URL")
    .option("-m, --markdown", "Output raw LLM-optimized Markdown representation directly to stdout")
    .option("--json", "Output full product object in JSON format")
    .action(async (slug: string, opts: { url?: string; markdown?: boolean; json?: boolean }) => {
      await getCommand(slug, opts);
    });

  program
    .command("traffic")
    .description("Query organization-authorized NLB product page traffic (default 30 days, maximum 90 days)")
    .argument("<slug>", "Product slug identifier")
    .option("-k, --api-key <key>", "NextLevelBuilder API key (or NLB_API_KEY)")
    .option("-u, --url <url>", "Directory API base URL")
    .option("--from <iso>", "Range start as UTC ISO timestamp")
    .option("--to <iso>", "Range end as UTC ISO timestamp")
    .option("--json", "Output full traffic response as JSON")
    .action(async (slug: string, opts: TrafficOptions) => {
      await trafficCommand(slug, opts);
    });

  program
    .command("rankings")
    .description("Get organic community rankings and leaderboard snapshots")
    .argument("[window]", "Ranking timeframe window: daily, weekly, or monthly (default: daily)")
    .option("-u, --url <url>", "Directory API base URL")
    .option("--json", "Output leaderboard snapshot in JSON format")
    .action(async (windowArg: string | undefined, opts: { url?: string; json?: boolean }) => {
      await rankingsCommand(windowArg, opts);
    });

  program
    .command("stats")
    .description("View live global directory metrics and platform statistics")
    .option("-u, --url <url>", "Directory API base URL")
    .option("--json", "Output metrics in JSON format")
    .action(async (opts: { url?: string; json?: boolean }) => {
      await statsCommand(opts);
    });

  program
    .command("vote")
    .description("Cast an organic community vote for a product")
    .argument("<productId>", "Target product UUID")
    .option("-t, --token <token>", "Cloudflare Turnstile token (optional)")
    .option("-c, --cookie <cookie>", "Better Auth session cookie (or set NLB_SESSION_COOKIE env)")
    .option("-u, --url <url>", "Directory API base URL")
    .option("--json", "Output vote result in JSON format")
    .action(async (productId: string, opts: { token?: string; cookie?: string; url?: string; json?: boolean }) => {
      await voteCommand(productId, opts);
    });

  program
    .command("upload")
    .description("Upload media file (image/video) to Next Level Builders storage")
    .argument("<file>", "Local image or video file path")
    .option("-f, --folder <folder>", "Storage subfolder (default: 'uploads')")
    .option("-k, --api-key <key>", "API Key or Bearer token (optional)")
    .option("-u, --url <url>", "Directory API base URL")
    .option("--json", "Output result in JSON format")
    .action(async (file: string, opts: { folder?: string; apiKey?: string; url?: string; json?: boolean }) => {
      await uploadCommand(file, opts);
    });

  program
    .command("checkout")
    .description("Create a Polar checkout session for publishing slots or memberships")
    .argument("<productId>", "Polar product UUID (obtain from /studio or deployment configuration)")
    .option("-e, --email <email>", "Customer email for receipt and access")
    .option("-s, --slug <slug>", "Product slug to bind the publishing slot entitlement to")
    .option("-u, --url <url>", "Directory API base URL")
    .option("--json", "Output checkout URL in JSON format")
    .action(async (productId: string, opts: { email?: string; slug?: string; url?: string; json?: boolean }) => {
      await checkoutCommand(productId, opts);
    });

  program
    .command("keys")
    .description("Manage developer API keys (list, create, revoke)")
    .argument("[action]", "Action: 'list', 'create', or 'revoke'", "list")
    .argument("[arg]", "Key name (for create) or key ID (for revoke)")
    .option("-o, --org <orgId>", "Organization UUID (for create)")
    .option("-d, --days <days>", "Key expiration in days (for create)")
    .option("-c, --cookie <cookie>", "Better Auth session cookie (or set NLB_SESSION_COOKIE)")
    .option("-u, --url <url>", "Directory API base URL")
    .option("--json", "Output in JSON format")
    .action(async (action = "list", arg?: string, opts: Record<string, unknown> = {}) => {
      await keysCommand(action, arg, opts);
    });

  program
    .command("template")
    .description("List layout templates or generate a starter product JSON file")
    .argument("[name]", "Template slug or name (e.g., 'dev-tool', 'ai-agent', 'saas-launch')")
    .option("-o, --out <file>", "Save generated template to destination file")
    .option("--json", "Output template JSON to stdout")
    .action(async (name: string | undefined, opts: { out?: string; json?: boolean }) => {
      await templateCommand(name, opts);
    });

  program
    .command("config")
    .description("View or set CLI configuration (API key and endpoint)")
    .argument("[action]", "Action: 'get', 'set', or 'list'", "list")
    .argument("[key]", "Configuration key ('api-key' or 'url')")
    .argument("[value]", "Configuration value to set")
    .action(async (action: "get" | "set" | "list", key?: string, value?: string) => {
      await configCommand(action, key, value);
    });

  program
    .command("doctor")
    .description("Diagnose system environment, configuration, and endpoint connectivity")
    .option("-u, --url <url>", "Directory API base URL")
    .option("--json", "Output diagnostic data in JSON format")
    .action(async (opts: { url?: string; json?: boolean }) => {
      await doctorCommand(opts);
    });

  return program;
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}
