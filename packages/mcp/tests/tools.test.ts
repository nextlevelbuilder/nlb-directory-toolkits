import { describe, it, expect } from "vitest";
import { McpServer } from "../src/server.js";
import { validateAllowedApiUrl } from "../src/tools/index.js";
import { createDocumentFromTemplate } from "@nextlevelbuilder/contracts";

describe("MCP: Tools Execution & Security", () => {
  const server = new McpServer();

  it("should execute validate_listing tool with valid document", async () => {
    const doc = createDocumentFromTemplate("ai-agent-tool", {
      name: "Smart MCP Agent",
      slug: "smart-mcp-agent",
      tagline: "Autonomous Agent with MCP tools",
      description: "An AI agent for developers.",
      websiteUrl: "https://agent.example.com"
    });

    const res = await server.handleMessage({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "validate_listing",
        arguments: { document: doc }
      }
    });

    expect(res?.result).toBeDefined();
    const result = res?.result as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.valid).toBe(true);
    expect(parsed.contentHash).toBeDefined();
    expect(parsed.contentHash).toHaveLength(64);
  });

  it("should reject unauthenticated worker mutation in submit_product", async () => {
    const doc = createDocumentFromTemplate("developer-cli", {
      name: "Test Tool",
      slug: "test-tool",
      tagline: "A test tool",
      description: "Test description",
      websiteUrl: "https://example.com"
    });

    const res = await server.handleMessage(
      {
        jsonrpc: "2.0",
        id: 99,
        method: "tools/call",
        params: {
          name: "submit_product",
          arguments: { document: doc }
        }
      },
      { workerAuth: false } // Unauthenticated worker caller without explicit api_key
    );

    expect(res?.result).toBeDefined();
    const result = res?.result as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unauthorized");
  });

  it("should reject arbitrary unauthorized API endpoints to prevent SSRF", () => {
    expect(() => validateAllowedApiUrl("https://evil-attacker.com")).toThrow(/Access to 'evil-attacker.com' is disallowed/);
    expect(() => validateAllowedApiUrl("http://169.254.169.254/latest/meta-data")).toThrow(/disallowed/);
    expect(() => validateAllowedApiUrl("ftp://nextlevelbuilder.io")).toThrow();

    // Allowed endpoints
    expect(validateAllowedApiUrl("https://nextlevelbuilder.io")).toBe("https://nextlevelbuilder.io");
    expect(validateAllowedApiUrl("https://staging.nextlevelbuilder.io")).toBe("https://staging.nextlevelbuilder.io");
    expect(validateAllowedApiUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("should execute list_templates tool", async () => {
    const res = await server.handleMessage({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: {
        name: "list_templates",
        arguments: {}
      }
    });

    const result = res?.result as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.templates).toBeDefined();
    expect(parsed.templates.length).toBe(5);
  });

  it("should return single template details when template_name passed to list_templates", async () => {
    const res = await server.handleMessage({
      jsonrpc: "2.0",
      id: 12,
      method: "tools/call",
      params: {
        name: "list_templates",
        arguments: { template_name: "developer-cli" }
      }
    });

    const result = res?.result as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.template.slug).toBe("developer-cli");
    expect(parsed.template.sampleBlocks).toBeDefined();
  });
});
