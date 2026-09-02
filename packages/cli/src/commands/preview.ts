import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ProductDocumentSchema, computeContentHash } from "@nextlevelbuilder/contracts";
import { renderProductPreview } from "../preview/ascii.js";
import pc from "picocolors";

export interface PreviewOptions {
  json?: boolean;
}

export async function previewCommand(filePath: string, options: PreviewOptions = {}): Promise<void> {
  const fullPath = resolve(process.cwd(), filePath);

  if (!existsSync(fullPath)) {
    console.error(pc.red(`✖ File not found: ${filePath}`));
    process.exitCode = 1;
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(fullPath, "utf-8"));
  } catch (err) {
    console.error(pc.red(`✖ Invalid JSON in ${filePath}: ${err instanceof Error ? err.message : String(err)}`));
    process.exitCode = 1;
    return;
  }

  const result = ProductDocumentSchema.safeParse(parsed);
  if (!result.success) {
    console.error(pc.red(`✖ Document validation failed before preview:`));
    result.error.errors.forEach((e) => {
      console.error(pc.red(`  • ${e.path.join(".")}: ${e.message}`));
    });
    process.exitCode = 1;
    return;
  }

  const contentHash = await computeContentHash(result.data);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          preview: true,
          contentHash,
          document: result.data
        },
        null,
        2
      )
    );
  } else {
    console.log(renderProductPreview(result.data, contentHash));
  }
}
