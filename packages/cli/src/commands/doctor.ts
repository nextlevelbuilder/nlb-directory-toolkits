import { resolveConfig } from "../config.js";
import pc from "picocolors";

export async function doctorCommand(options: { json?: boolean } = {}): Promise<void> {
  const config = resolveConfig();
  const nodeVersion = process.version;
  const platform = process.platform;

  let apiReachable = false;
  let responseTimeMs = 0;

  try {
    const start = Date.now();
    const resp = await fetch(`${config.apiUrl}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(4000)
    }).catch(() => null);

    responseTimeMs = Date.now() - start;
    apiReachable = resp !== null && resp.status < 500;
  } catch {
    apiReachable = false;
  }

  const results = {
    system: {
      nodeVersion,
      platform,
      arch: process.arch
    },
    config: {
      apiUrl: config.apiUrl,
      apiUrlSource: config.sources.apiUrlSource,
      apiKeyConfigured: Boolean(config.apiKey),
      apiKeySource: config.sources.apiKeySource
    },
    network: {
      apiReachable,
      responseTimeMs: apiReachable ? responseTimeMs : undefined
    }
  };

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log(pc.cyan(`\n🩺 Next Level Builders CLI Diagnostic Report:\n`));
  console.log(pc.bold("Environment:"));
  console.log(`  • Node.js:        ${pc.green(nodeVersion)}`);
  console.log(`  • Platform:       ${platform} (${process.arch})`);

  console.log(pc.bold("\nConfiguration:"));
  console.log(`  • API Endpoint:   ${pc.blue(config.apiUrl)} ${pc.dim(`(${config.sources.apiUrlSource})`)}`);
  console.log(
    `  • API Key:        ${config.apiKey ? pc.green("Configured") : pc.yellow("Not Set (Required for submissions)")} ${pc.dim(`(${config.sources.apiKeySource})`)}`
  );

  console.log(pc.bold("\nConnectivity:"));
  if (apiReachable) {
    console.log(`  • Endpoint Health: ${pc.green(`✔ Connected (${responseTimeMs}ms)`)}`);
  } else {
    console.log(`  • Endpoint Health: ${pc.yellow(`⚠️ Unable to reach health endpoint at ${config.apiUrl}`)}`);
  }
  console.log("");
}
