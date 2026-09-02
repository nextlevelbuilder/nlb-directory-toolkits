import { Command } from "commander";
import { validateCommand } from "./commands/validate.js";
import { previewCommand } from "./commands/preview.js";
import { submitCommand } from "./commands/submit.js";
import { listCommand } from "./commands/list.js";
import { getCommand } from "./commands/get.js";
import { statusCommand } from "./commands/status.js";
import { templateCommand } from "./commands/template.js";
import { configCommand } from "./commands/config.js";
import { doctorCommand } from "./commands/doctor.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("nlb")
    .description("Next Level Builders Directory CLI — validate, preview, submit, and inspect directory products")
    .version("0.1.0");

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
    .option("-k, --api-key <key>", "NextLevelBuilder API Key (or set NLB_API_KEY env)")
    .option("-u, --url <url>", "Directory API base URL (default: https://nextlevelbuilder.io)")
    .option("-n, --notes <notes>", "Optional submission notes for reviewers")
    .option("--dry-run", "Validate and simulate submission without sending network mutation")
    .option("--json", "Output result in machine-readable JSON format")
    .action(async (file: string, opts: { apiKey?: string; url?: string; notes?: string; dryRun?: boolean; json?: boolean }) => {
      await submitCommand(file, opts);
    });

  program
    .command("list")
    .description("List products registered on Next Level Builders Directory")
    .option("-u, --url <url>", "Directory API base URL")
    .option("-c, --category <category>", "Filter products by category")
    .option("-t, --tag <tag>", "Filter products by tag")
    .option("-s, --status <status>", "Filter by status: published, pending_review, draft, rejected")
    .option("-l, --limit <limit>", "Max products to return (default: 20)")
    .option("-p, --page <page>", "Page number (default: 1)")
    .option("--json", "Output products list in machine-readable JSON format")
    .action(async (opts: { url?: string; category?: string; tag?: string; status?: "draft" | "pending_review" | "published" | "rejected"; limit?: string; page?: string; json?: boolean }) => {
      await listCommand(opts);
    });

  program
    .command("get")
    .description("Fetch product details and block outline by slug")
    .argument("<slug>", "Product slug identifier")
    .option("-u, --url <url>", "Directory API base URL")
    .option("--json", "Output full product object in JSON format")
    .action(async (slug: string, opts: { url?: string; json?: boolean }) => {
      await getCommand(slug, opts);
    });

  program
    .command("status")
    .description("Check moderation status and trust score of a product revision")
    .argument("<slug>", "Product slug identifier")
    .option("-u, --url <url>", "Directory API base URL")
    .option("--json", "Output status in JSON format")
    .action(async (slug: string, opts: { url?: string; json?: boolean }) => {
      await statusCommand(slug, opts);
    });

  program
    .command("template")
    .description("List layout templates or generate a starter product JSON file")
    .argument("[name]", "Template slug or name (e.g., 'developer-cli', 'ai-agent-tool', 'saas-launch')")
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
    .option("--json", "Output diagnostic data in JSON format")
    .action(async (opts: { json?: boolean }) => {
      await doctorCommand(opts);
    });

  return program;
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}
