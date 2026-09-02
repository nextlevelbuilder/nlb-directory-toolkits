import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ProductDocumentSchema, computeContentHash } from "@nextlevelbuilder/contracts";
import { resolveConfig } from "../config.js";
import { NlbApiClient } from "../api/client.js";
import pc from "picocolors";

export interface SubmitOptions {
  apiKey?: string;
  url?: string;
  notes?: string;
  dryRun?: boolean;
  json?: boolean;
}

export async function submitCommand(filePath: string, options: SubmitOptions = {}): Promise<void> {
  const fullPath = resolve(process.cwd(), filePath);

  if (!existsSync(fullPath)) {
    const errorMsg = `File not found: ${filePath}`;
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: errorMsg }));
    } else {
      console.error(pc.red(`✖ ${errorMsg}`));
    }
    process.exitCode = 1;
    return;
  }

  let docData: unknown;
  try {
    docData = JSON.parse(readFileSync(fullPath, "utf-8"));
  } catch (err) {
    const errorMsg = `Invalid JSON in ${filePath}: ${err instanceof Error ? err.message : String(err)}`;
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: errorMsg }));
    } else {
      console.error(pc.red(`✖ ${errorMsg}`));
    }
    process.exitCode = 1;
    return;
  }

  const parseResult = ProductDocumentSchema.safeParse(docData);
  if (!parseResult.success) {
    const errors = parseResult.error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message
    }));
    if (options.json) {
      console.log(JSON.stringify({ success: false, errors }));
    } else {
      console.error(pc.red(`✖ Document validation failed:`));
      errors.forEach((e) => console.error(pc.red(`  • ${e.path}: ${e.message}`)));
    }
    process.exitCode = 1;
    return;
  }

  const doc = parseResult.data;
  const contentHash = await computeContentHash(doc);
  const config = resolveConfig(options);

  if (options.dryRun) {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            dryRun: true,
            valid: true,
            slug: doc.slug,
            contentHash,
            targetUrl: config.apiUrl,
            steps: ["createProduct", "createRevision", "submitProduct"]
          },
          null,
          2
        )
      );
    } else {
      console.log(pc.yellow(`⚡ [DRY RUN] Document is valid. Simulation successful:`));
      console.log(`  • Product:      ${pc.bold(doc.name)} (${doc.slug})`);
      console.log(`  • Content Hash: ${pc.cyan(contentHash)}`);
      console.log(`  • Target URL:   ${pc.blue(config.apiUrl)}`);
      console.log(`  • Auth Source:  ${config.sources.apiKeySource}`);
    }
    return;
  }

  const client = new NlbApiClient({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey
  });

  try {
    if (!options.json) {
      console.log(pc.cyan(`🚀 Submitting ${pc.bold(doc.name)} (${doc.slug}) to ${config.apiUrl}...`));
    }

    // Step 1: Create or fetch product envelope
    if (!options.json) console.log(pc.dim("  1/3 Registering product metadata..."));
    const productResp = await client.createProduct({
      name: doc.name,
      slug: doc.slug,
      tagline: doc.tagline,
      description: doc.description,
      category: doc.category,
      tags: doc.tags,
      websiteUrl: doc.websiteUrl,
      repoUrl: doc.repoUrl,
      logoUrl: doc.logoUrl
    });

    // Step 2: Create revision
    if (!options.json) console.log(pc.dim(`  2/3 Uploading revision payload (hash: ${contentHash.slice(0, 12)}...)...`));
    const revisionResp = await client.createRevision(doc.slug, {
      contentHash,
      hashVersion: "v1",
      document: doc
    });

    // Step 3: Submit to moderation review queue
    if (!options.json) console.log(pc.dim("  3/3 Submitting into moderation review queue..."));
    const submitResp = await client.submitProduct(doc.slug, {
      revisionId: revisionResp.revision.revisionId,
      notes: options.notes
    });

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            success: true,
            slug: doc.slug,
            submissionId: submitResp.submissionId,
            status: submitResp.status,
            contentHash,
            product: productResp.product
          },
          null,
          2
        )
      );
    } else {
      console.log(pc.green(`\n✔ Product successfully submitted to directory review queue!`));
      console.log(`  • Submission ID: ${pc.bold(submitResp.submissionId)}`);
      console.log(`  • Status:        ${pc.yellow(submitResp.status)}`);
      console.log(`  • Content Hash:  ${pc.cyan(contentHash)}`);
      console.log(`  • Track Status:  ${pc.dim(`npx @nextlevelbuilder/cli status ${doc.slug}`)}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: msg }, null, 2));
    } else {
      console.error(pc.red(`\n✖ Submission failed: ${msg}`));
    }
    process.exitCode = 1;
  }
}
