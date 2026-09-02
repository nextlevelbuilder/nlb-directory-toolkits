import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveConfig } from "../src/config.js";

describe("CLI: Config Resolution", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NLB_API_KEY;
    delete process.env.NLB_API_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should return default API URL when no configs or flags provided", () => {
    const config = resolveConfig();
    expect(config.apiUrl).toBe("https://nextlevelbuilder.io");
    expect(config.sources.apiUrlSource).toBe("default");
    expect(config.apiKey).toBeUndefined();
  });

  it("should prioritize CLI flags over env variables", () => {
    process.env.NLB_API_KEY = "env-key";
    process.env.NLB_API_URL = "https://env.example.com";

    const config = resolveConfig({
      apiKey: "flag-key",
      url: "https://flag.example.com"
    });

    expect(config.apiKey).toBe("flag-key");
    expect(config.apiUrl).toBe("https://flag.example.com");
    expect(config.sources.apiKeySource).toBe("cli_flag");
    expect(config.sources.apiUrlSource).toBe("cli_flag");
  });

  it("should use environment variables when flags are omitted", () => {
    process.env.NLB_API_KEY = "nlb_live_test123";
    process.env.NLB_API_URL = "https://staging.nextlevelbuilder.io/";

    const config = resolveConfig();
    expect(config.apiKey).toBe("nlb_live_test123");
    expect(config.apiUrl).toBe("https://staging.nextlevelbuilder.io");
    expect(config.sources.apiKeySource).toBe("env_var (NLB_API_KEY)");
  });
});
