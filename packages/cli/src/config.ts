import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { z } from "zod";

export const NlbConfigSchema = z.object({
  apiKey: z.string().min(1).optional(),
  apiUrl: z.string().url().optional()
});
export type NlbConfig = z.infer<typeof NlbConfigSchema>;

export const DEFAULT_API_URL = "https://nextlevelbuilder.io";
export const STAGING_API_URL = "https://staging.nextlevelbuilder.io";

function getHomeConfigPath(): string {
  try {
    return join(homedir(), ".nlb", "config.json");
  } catch {
    return "/tmp/.nlb-config.json";
  }
}

function getLocalConfigPath(): string {
  try {
    return join(process.cwd(), ".nlbrc.json");
  } catch {
    return ".nlbrc.json";
  }
}

/**
 * Safely reads and validates a JSON configuration file.
 */
export function readConfigFile(filePath: string): NlbConfig {
  try {
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      const validated = NlbConfigSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }
    }
  } catch {
    // Graceful fallback for sandboxed environments
  }
  return {};
}

/**
 * Reads merged configuration from local and user home config files.
 */
export function readMergedConfig(): NlbConfig {
  const homeConfig = readConfigFile(getHomeConfigPath());
  const localConfig = readConfigFile(getLocalConfigPath());
  return {
    ...homeConfig,
    ...localConfig
  };
}

/**
 * Saves a key-value pair to user home configuration with restricted permissions (0o600).
 */
export function writeUserConfig(key: "apiKey" | "apiUrl", value: string): void {
  try {
    const configPath = getHomeConfigPath();
    const dir = join(homedir(), ".nlb");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    const current = readConfigFile(configPath);
    current[key] = value;
    writeFileSync(configPath, JSON.stringify(current, null, 2), { encoding: "utf-8", mode: 0o600 });
  } catch (err) {
    throw new Error(`Failed to write config file: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Resolves API Key and Base URL across resolution chain:
 * 1. CLI flag
 * 2. Environment variable (NLB_API_KEY / NLB_API_URL)
 * 3. Local project configuration (.nlbrc.json)
 * 4. User home configuration (~/.nlb/config.json)
 * 5. Default fallback
 */
export function resolveConfig(flags: { apiKey?: string; apiUrl?: string; url?: string } = {}): {
  apiKey?: string;
  apiUrl: string;
  sources: { apiKeySource: string; apiUrlSource: string };
} {
  const merged = readMergedConfig();

  // API URL resolution
  let apiUrl = DEFAULT_API_URL;
  let apiUrlSource = "default";

  if (flags.url || flags.apiUrl) {
    apiUrl = (flags.url || flags.apiUrl)!;
    apiUrlSource = "cli_flag";
  } else if (process.env.NLB_API_URL) {
    apiUrl = process.env.NLB_API_URL;
    apiUrlSource = "env_var (NLB_API_URL)";
  } else if (merged.apiUrl) {
    apiUrl = merged.apiUrl;
    apiUrlSource = "config_file";
  }

  // Normalize API URL trailing slash
  apiUrl = apiUrl.replace(/\/+$/, "");

  // API Key resolution
  let apiKey: string | undefined;
  let apiKeySource = "none";

  if (flags.apiKey) {
    apiKey = flags.apiKey;
    apiKeySource = "cli_flag";
  } else if (process.env.NLB_API_KEY) {
    apiKey = process.env.NLB_API_KEY;
    apiKeySource = "env_var (NLB_API_KEY)";
  } else if (merged.apiKey) {
    apiKey = merged.apiKey;
    apiKeySource = "config_file";
  }

  return {
    apiKey,
    apiUrl,
    sources: {
      apiKeySource,
      apiUrlSource
    }
  };
}
