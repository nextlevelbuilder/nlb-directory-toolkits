import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { toServerDocumentSafe, computeContentHashSync } from "@nextlevelbuilder/contracts";
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

  const result = toServerDocumentSafe(parsed);
  if (!result.success) {
    console.error(pc.red(`✖ Document validation failed before preview:`));
    result.errors.forEach((e) => {
      console.error(pc.red(`  • ${e.path}: ${e.message}`));
    });
    process.exitCode = 1;
    return;
  }

  const doc = result.document;
  const contentHash = computeContentHashSync(doc);
  if (options.json) {
    console.log(
      JSON.stringify(
        {
          preview: true,
          contentHash,
          document: doc
        },
        null,
        2
      )
    );
  } else {
    console.log(renderProductPreview(doc, contentHash));
  }
}
