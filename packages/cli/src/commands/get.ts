import { resolveConfig } from "../config.js";
import { NlbApiClient } from "../api/client.js";
import pc from "picocolors";

export interface GetOptions {
  url?: string;
  apiKey?: string;
  json?: boolean;
}

export async function getCommand(slug: string, options: GetOptions = {}): Promise<void> {
  const config = resolveConfig(options);
  const client = new NlbApiClient({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey
  });

  try {
    const resp = await client.getProduct(slug);

    if (options.json) {
      console.log(JSON.stringify(resp, null, 2));
      return;
    }

    const prod = resp.product;
    console.log(pc.cyan(`\n🔍 Product Details: ${pc.bold(prod.name)}`));
    console.log(`  • Slug:        ${prod.slug}`);
    console.log(`  • Tagline:     ${pc.italic(prod.tagline)}`);
    console.log(`  • Category:    ${prod.category}`);
    console.log(`  • Tags:        ${prod.tags.join(", ")}`);
    console.log(`  • Website:     ${pc.blue(prod.websiteUrl)}`);
    console.log(`  • Trust Score: ${pc.green(`${prod.trustScore}%`)}`);
    console.log(`  • Status:      ${prod.status}`);
    console.log(`  • Created:     ${prod.createdAt}`);

    if (resp.latestDocument?.blocks) {
      console.log(pc.bold(`\n📋 Block Summary (${resp.latestDocument.blocks.length} blocks):`));
      resp.latestDocument.blocks.forEach((b, i) => {
        console.log(`  ${i + 1}. [${b.type}]`);
      });
    }
    console.log("");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: msg }, null, 2));
    } else {
      console.error(pc.red(`✖ Failed to fetch product '${slug}': ${msg}`));
    }
    process.exitCode = 1;
  }
}
