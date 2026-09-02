import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ProductDocumentSchema, computeContentHash } from "@nextlevelbuilder/contracts";
import pc from "picocolors";

export interface ValidateOptions {
  json?: boolean;
}

export async function validateCommand(filePath: string, options: ValidateOptions = {}): Promise<{ valid: boolean; contentHash?: string; errors?: unknown[] }> {
  const fullPath = resolve(process.cwd(), filePath);

  if (!existsSync(fullPath)) {
    const errorMsg = `File not found: ${filePath}`;
    if (options.json) {
      console.log(JSON.stringify({ valid: false, error: errorMsg }, null, 2));
    } else {
      console.error(pc.red(`✖ ${errorMsg}`));
    }
    process.exitCode = 1;
    return { valid: false, errors: [{ message: errorMsg }] };
  }

  let rawContent: string;
  try {
    rawContent = readFileSync(fullPath, "utf-8");
  } catch (err) {
    const errorMsg = `Failed to read file: ${err instanceof Error ? err.message : String(err)}`;
    if (options.json) {
      console.log(JSON.stringify({ valid: false, error: errorMsg }, null, 2));
    } else {
      console.error(pc.red(`✖ ${errorMsg}`));
    }
    process.exitCode = 1;
    return { valid: false, errors: [{ message: errorMsg }] };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch (err) {
    const errorMsg = `Invalid JSON syntax in ${filePath}: ${err instanceof Error ? err.message : String(err)}`;
    if (options.json) {
      console.log(JSON.stringify({ valid: false, error: errorMsg }, null, 2));
    } else {
      console.error(pc.red(`✖ ${errorMsg}`));
    }
    process.exitCode = 1;
    return { valid: false, errors: [{ message: errorMsg }] };
  }

  const result = ProductDocumentSchema.safeParse(parsedJson);

  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
      code: e.code
    }));

    if (options.json) {
      console.log(JSON.stringify({ valid: false, errors }, null, 2));
    } else {
      console.error(pc.red(`✖ Validation failed for ${pc.bold(filePath)}:`));
      errors.forEach((err) => {
        console.error(pc.red(`  • ${pc.bold(err.path || "root")}: ${err.message}`));
      });
    }
    process.exitCode = 1;
    return { valid: false, errors };
  }

  const contentHash = await computeContentHash(result.data);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          valid: true,
          contentHash,
          hashVersion: "v1",
          product: {
            name: result.data.name,
            slug: result.data.slug,
            blocksCount: result.data.blocks.length
          }
        },
        null,
        2
      )
    );
  } else {
    console.log(pc.green(`✔ Schema valid! ${pc.bold(result.data.name)} (${result.data.blocks.length} blocks)`));
    console.log(pc.cyan(`  Canonical SHA-256 Hash: ${pc.bold(contentHash)}`));
  }

  return { valid: true, contentHash };
}
