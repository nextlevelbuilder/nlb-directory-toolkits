import { resolveConfig } from "../config.js";
import { NlbApiClient } from "../api/client.js";
import pc from "picocolors";

export interface DoctorOptions {
  url?: string;
  json?: boolean;
}

export async function doctorCommand(options: DoctorOptions = {}): Promise<void> {
  const config = resolveConfig(options);
  const client = new NlbApiClient({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey,
    timeoutMs: 5000
  });

  const nodeVersion = process.version;
  const platform = process.platform;

  let apiReachable = false;
  let databaseHealthy = false;
  let responseTimeMs = 0;
  let healthData: Record<string, unknown> | null = null;

  try {
    const start = Date.now();
    const health = await client.checkHealth();
    responseTimeMs = Date.now() - start;

    apiReachable = true;
    healthData = health as unknown as Record<string, unknown>;
    if (health.status === "ok" && health.database === "connected") {
      databaseHealthy = true;
    }
  } catch (err: unknown) {
    apiReachable = false;
    databaseHealthy = false;
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
      databaseHealthy,
      responseTimeMs: apiReachable ? responseTimeMs : undefined,
      databaseStatus: healthData?.database ? String(healthData.database) : undefined,
      serviceStatus: healthData?.status ? String(healthData.status) : undefined
    }
  };

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    if (!apiReachable || !databaseHealthy) {
      process.exitCode = 1;
    }
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
    if (databaseHealthy) {
      console.log(`  • API Server:     ${pc.green(`✔ Connected (${responseTimeMs}ms)`)}`);
      console.log(`  • Database Probe: ${pc.green(`✔ Connected (${String(healthData?.db_name || "nlb")})`)}`);
    } else {
      console.log(`  • API Server:     ${pc.green(`✔ Reachable (${responseTimeMs}ms)`)}`);
      console.log(`  • Database Probe: ${pc.red(`✖ Degraded (${String(healthData?.database || "disconnected")})`)}`);
      process.exitCode = 1;
    }
  } else {
    console.log(`  • Endpoint Health: ${pc.red(`✖ Unable to reach health endpoint at ${config.apiUrl}`)}`);
    process.exitCode = 1;
  }
  console.log("");
}
