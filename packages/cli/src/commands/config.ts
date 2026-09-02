import { resolveConfig, writeUserConfig, readConfigFile } from "../config.js";
import { homedir } from "node:os";
import { join } from "node:path";
import pc from "picocolors";

export async function configCommand(action: "get" | "set" | "list" = "list", key?: string, value?: string): Promise<void> {
  const configPath = join(homedir(), ".nlb", "config.json");
  const current = readConfigFile(configPath);

  if (action === "list") {
    const resolved = resolveConfig();
    console.log(pc.cyan(`\n⚙️  Next Level Builders Configuration:`));
    console.log(`  • Config File:    ${pc.dim(configPath)}`);
    console.log(`  • Base API URL:   ${pc.bold(resolved.apiUrl)} ${pc.dim(`(source: ${resolved.sources.apiUrlSource})`)}`);
    console.log(`  • API Key:        ${resolved.apiKey ? pc.green(resolved.apiKey.slice(0, 6) + "..." + resolved.apiKey.slice(-4)) : pc.yellow("Not set")} ${pc.dim(`(source: ${resolved.sources.apiKeySource})`)}\n`);
    return;
  }

  if (action === "set") {
    if (!key || !value) {
      console.error(pc.red("✖ Usage: nlb config set <api-key|url> <value>"));
      process.exitCode = 1;
      return;
    }

    if (key === "api-key" || key === "apiKey") {
      writeUserConfig("apiKey", value);
      console.log(pc.green(`✔ Stored API Key in ${configPath}`));
    } else if (key === "url" || key === "apiUrl") {
      writeUserConfig("apiUrl", value);
      console.log(pc.green(`✔ Stored API URL (${value}) in ${configPath}`));
    } else {
      console.error(pc.red(`✖ Unknown config key: '${key}'. Allowed: 'api-key', 'url'`));
      process.exitCode = 1;
    }
    return;
  }

  if (action === "get") {
    if (!key) {
      console.error(pc.red("✖ Usage: nlb config get <api-key|url>"));
      process.exitCode = 1;
      return;
    }
    if (key === "api-key" || key === "apiKey") {
      console.log(current.apiKey || "");
    } else if (key === "url" || key === "apiUrl") {
      console.log(current.apiUrl || "");
    }
  }
}
