import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  toServerDocumentSafe,
  computeContentHashSync
} from "@nextlevelbuilder/contracts";
import { resolveConfig } from "../config.js";
import { NlbApiClient } from "../api/client.js";
import pc from "picocolors";

export interface SubmitOptions {
  apiKey?: string;
  url?: string;
  org?: string;
  fastTrack?: boolean;
  payOnly?: boolean;
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
    const msg = err instanceof Error ? err.message : String(err);
    const errorMsg = `Failed to parse JSON file '${filePath}': ${msg}`;
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: errorMsg }));
    } else {
      console.error(pc.red(`✖ ${errorMsg}`));
    }
    process.exitCode = 1;
    return;
  }

  // Parse safely with canonical validation
  const docResult = toServerDocumentSafe(docData);
  if (!docResult.success) {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            success: false,
            error: "Document schema validation failed",
            details: docResult.errors
          },
          null,
          2
        )
      );
    } else {
      console.error(pc.red(`✖ Schema validation failed for '${filePath}':`));
      docResult.errors.forEach((err) => {
        console.error(`  • ${pc.bold(err.path)}: ${err.message}`);
      });
    }
    process.exitCode = 1;
    return;
  }

  const canonicalDoc = docResult.document;
  const contentHash = computeContentHashSync(canonicalDoc);
  const config = resolveConfig(options);

  // Derive slug
  const rawDoc = docData as Record<string, unknown>;
  const rawSlug = String(rawDoc.slug || canonicalDoc.title.toLowerCase().replace(/[^a-z0-9-]+/g, "-")).replace(/^-+|-+$/g, "");
  const slug = rawSlug.slice(0, 64);
  if (!/^[a-z0-9-]+$/.test(slug)) {
    const errorMsg = `Invalid product slug '${slug}'. Must be lowercase alphanumeric with single hyphens.`;
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: errorMsg }));
    } else {
      console.error(pc.red(`✖ ${errorMsg}`));
    }
    process.exitCode = 1;
    return;
  }

  // Resolve orgId
  const rawOrgId = options.org || (config as Record<string, unknown>).orgId || process.env.NLB_ORG_ID;
  if (!rawOrgId && !options.dryRun) {
    const errorMsg = "Organization ID is required. Please supply --org <orgId> (UUID from your Next Level Builders /studio account).";
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: errorMsg }));
    } else {
      console.error(pc.red(`✖ ${errorMsg}`));
    }
    process.exitCode = 1;
    return;
  }

  const orgId = String(rawOrgId || "");
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (orgId && !UUID_REGEX.test(orgId) && !options.dryRun) {
    const errorMsg = `Invalid organization ID format '${orgId}'. --org must be your organization's UUID from /studio, not its slug.`;
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: errorMsg }));
    } else {
      console.error(pc.red(`✖ ${errorMsg}`));
    }
    process.exitCode = 1;
    return;
  }

  if (options.dryRun) {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            valid: true,
            dryRun: true,
            slug,
            contentHash,
            product: {
              title: canonicalDoc.title,
              categorySlugs: canonicalDoc.categorySlugs,
              blocksCount: canonicalDoc.blocks.length
            }
          },
          null,
          2
        )
      );
    } else {
      console.log(pc.green(`✔ Dry run successful: '${filePath}' is valid for submission.`));
      console.log(`  • Title:        ${pc.bold(canonicalDoc.title)}`);
      console.log(`  • Slug:         ${slug}`);
      console.log(`  • Categories:   ${canonicalDoc.categorySlugs.join(", ")}`);
      console.log(`  • Blocks:       ${canonicalDoc.blocks.length} block(s)`);
      console.log(`  • Content Hash: ${pc.cyan(contentHash)}`);
      console.log(pc.dim("No network requests were executed (dry-run mode)."));
    }
    return;
  }

  const client = new NlbApiClient({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey
  });

  try {
    if (!options.json) {
      console.log(pc.cyan(`🚀 Submitting ${pc.bold(canonicalDoc.title)} (${slug}) to ${config.apiUrl}...`));
    }

    // Step 1: Create or register product metadata
    if (!options.json) console.log(pc.dim("  1/3 Registering product metadata..."));
    let productResp: Record<string, unknown> | undefined;
    try {
      productResp = (await client.createProduct({
        orgId,
        slug,
        title: canonicalDoc.title,
        tagline: canonicalDoc.tagline,
        websiteUrl: canonicalDoc.websiteUrl,
        logoUrl: canonicalDoc.logoUrl
      })) as unknown as Record<string, unknown>;
    } catch (createErr: unknown) {
      const createMsg = createErr instanceof Error ? createErr.message : String(createErr);
      // If already exists, continue to revision upload
      if (!createMsg.includes("already exists")) {
        throw createErr;
      }
    }
    // Step 2: Create revision
    if (!options.json) console.log(pc.dim(`  2/3 Uploading revision payload (hash: ${contentHash.slice(0, 12)}...)...`));
    const revisionResp = await client.createRevision(slug, {
      document: canonicalDoc
    });

    const revisionId =
      (revisionResp.data as Record<string, unknown>)?.id ||
      (revisionResp.data as Record<string, unknown>)?.revisionId ||
      (revisionResp.revision as Record<string, unknown>)?.id ||
      (revisionResp.revision as Record<string, unknown>)?.revisionId;

    if (!revisionId || typeof revisionId !== "string") {
      throw new Error("Revision creation succeeded on server, but no valid revision ID was returned. Aborting submission to prevent submitting an unintended revision.");
    }

    // Step 3: Submit to moderation review queue
    if (!options.json) console.log(pc.dim("  3/3 Submitting into moderation review queue..."));
    const submitResp = await client.submitProduct(slug, {
      revisionId,
      submissionNotes: options.notes,
      isFastTrack: options.fastTrack,
      payOnly: options.payOnly
    });

    // Check if 402 Payment Required was returned
    if ("requiresPayment" in submitResp && submitResp.requiresPayment) {
      const isPayOnly = Boolean(options.payOnly);
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              success: isPayOnly,
              status: "payment_required",
              slug,
              amount: submitResp.amount,
              checkoutUrl: submitResp.checkoutUrl,
              isEarlyBird: submitResp.isEarlyBird,
              slotNumber: submitResp.slotNumber,
              previewUrl: `${config.apiUrl}/studio/products/${slug}/preview`,
              message: "Payment required to activate directory listing slot."
            },
            null,
            2
          )
        );
      } else {
        console.log(pc.yellow(`\n⚠ Payment Required to Activate Directory Listing Slot`));
        console.log(`  • Amount:       ${pc.bold(String(submitResp.amount || ""))} ${submitResp.isEarlyBird ? "(Early Bird Slot)" : "(Standard Slot)"}`);
        console.log(`  • Checkout URL: ${pc.cyan(String(submitResp.checkoutUrl || ""))}`);
        console.log(`  • Preview:      ${pc.dim(`${config.apiUrl}/studio/products/${slug}/preview`)}`);
        console.log(pc.dim(`\nComplete payment above, then run 'nlb submit' again to submit your revision to the review queue.`));
      }
      if (!isPayOnly) {
        process.exitCode = 1;
      }
      return;
    }

    const subData = (submitResp as Record<string, unknown>).data as Record<string, unknown> | undefined;
    const submissionId = subData?.submissionId || (submitResp as Record<string, unknown>).submissionId || "submitted";
    const status = subData?.status || (submitResp as Record<string, unknown>).status || "awaiting_human";

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            success: true,
            slug,
            submissionId,
            status,
            contentHash,
            product: productResp?.data || productResp?.product
          },
          null,
          2
        )
      );
    } else {
      console.log(pc.green(`\n✔ Product successfully submitted to directory review queue!`));
      console.log(`  • Submission ID: ${pc.bold(String(submissionId))}`);
      console.log(`  • Status:        ${pc.yellow(String(status))}`);
      console.log(`  • Content Hash:  ${pc.cyan(contentHash)}`);
      console.log(`  • Preview URL:   ${pc.blue(`${config.apiUrl}/studio/products/${slug}/preview`)}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: msg }, null, 2));
    } else {
      if (msg.includes("Forbidden") || msg.includes("403")) {
        console.error(pc.red(`\n✖ Forbidden: You are not a member of organization '${orgId}'. Ensure --org is your organization's UUID from Next Level Builders /studio.`));
      } else {
        console.error(pc.red(`\n✖ Submission failed: ${msg}`));
      }
    }
    process.exitCode = 1;
  }
}
