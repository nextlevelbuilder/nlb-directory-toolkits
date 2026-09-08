import { resolveConfig } from "../config.js";
import { NlbApiClient } from "../api/client.js";
import pc from "picocolors";

export interface GetOptions {
  url?: string;
  apiKey?: string;
  json?: boolean;
  markdown?: boolean;
}

export async function getCommand(slug: string, options: GetOptions = {}): Promise<void> {
  const config = resolveConfig(options);
  const client = new NlbApiClient({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey
  });

  try {
    if (options.markdown) {
      const md = await client.getProductMarkdown(slug);
      process.stdout.write(md.endsWith("\n") ? md : `${md}\n`);
      return;
    }

    const resp = await client.getProduct(slug);

    if (options.json) {
      console.log(JSON.stringify(resp, null, 2));
      return;
    }

    const rawData = (resp as Record<string, unknown>).data as Record<string, unknown> | undefined;
    const dataObj = rawData || (resp as Record<string, unknown>);
    const prod = (dataObj.product as Record<string, unknown>) || dataObj;
    const title = String(prod.title || prod.name || slug);

    console.log(pc.cyan(`\n🔍 Product Details: ${pc.bold(title)}`));
    console.log(`  • Slug:        ${prod.slug || slug}`);
    if (prod.tagline) console.log(`  • Tagline:     ${pc.italic(String(prod.tagline))}`);
    if (prod.websiteUrl) console.log(`  • Website:     ${pc.blue(String(prod.websiteUrl))}`);
    if (typeof prod.trustScore === "number") console.log(`  • Trust Score: ${pc.green(`${prod.trustScore}/100`)}`);
    if (prod.status) console.log(`  • Status:      ${String(prod.status)}`);
    if (prod.createdAt) console.log(`  • Created:     ${String(prod.createdAt)}`);

    const revision = dataObj.revision as Record<string, unknown> | undefined;
    const revDoc = revision?.document as Record<string, unknown> | undefined;
    const blocks = (revDoc?.blocks || (resp as Record<string, unknown>).latestDocument) as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(blocks) && blocks.length > 0) {
      console.log(pc.bold(`\n📋 Block Summary (${blocks.length} blocks):`));
      blocks.forEach((b, i: number) => {
        console.log(`  ${i + 1}. [${String(b.type || "block")}] ${b.id ? `(id: ${String(b.id)})` : ""}`);
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
