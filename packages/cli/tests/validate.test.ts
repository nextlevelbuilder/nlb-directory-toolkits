import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateCommand } from "../src/commands/validate.js";
import { createDocumentFromTemplate } from "@nextlevelbuilder/contracts";

describe("CLI: Validate Command", () => {
  const validPath = join(tmpdir(), "valid-product.json");
  const invalidPath = join(tmpdir(), "invalid-product.json");

  beforeAll(() => {
    const validDoc = createDocumentFromTemplate("developer-cli", {
      name: "Validator Tool",
      slug: "validator-tool",
      tagline: "Instant validation for builders",
      description: "A fast schema validator.",
      websiteUrl: "https://example.com"
    });
    writeFileSync(validPath, JSON.stringify(validDoc), "utf-8");

    const invalidDoc = {
      name: "Broken",
      // missing slug, description, websiteUrl, blocks
      blocks: []
    };
    writeFileSync(invalidPath, JSON.stringify(invalidDoc), "utf-8");
  });

  afterAll(() => {
    if (existsSync(validPath)) unlinkSync(validPath);
    if (existsSync(invalidPath)) unlinkSync(invalidPath);
  });

  it("should validate valid product JSON and return contentHash", async () => {
    const result = await validateCommand(validPath, { json: true });
    expect(result.valid).toBe(true);
    expect(result.contentHash).toBeDefined();
    expect(result.contentHash).toHaveLength(64);
  });

  it("should fail validation for invalid schema and return errors", async () => {
    const result = await validateCommand(invalidPath, { json: true });
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it("should return false when file does not exist", async () => {
    const result = await validateCommand("/non/existent/file.json", { json: true });
    expect(result.valid).toBe(false);
  });
});
