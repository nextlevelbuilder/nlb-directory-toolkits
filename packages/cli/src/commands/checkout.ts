import { resolveConfig } from "../config.js";
import { NlbApiClient } from "../api/client.js";
import pc from "picocolors";

export interface CheckoutOptions {
  email?: string;
  slug?: string;
  url?: string;
  json?: boolean;
}

export async function checkoutCommand(
  productId: string,
  options: CheckoutOptions = {}
): Promise<void> {
  const config = resolveConfig(options);
  const client = new NlbApiClient({
    baseUrl: config.apiUrl
  });

  try {
    const resp = await client.createCheckout({
      productId,
      customerEmail: options.email,
      productSlug: options.slug
    });

    if (options.json) {
      console.log(JSON.stringify(resp, null, 2));
      return;
    }

    console.log(pc.cyan(`\n💳 Next Level Builders Checkout Session Created:`));
    console.log(`  • Polar Checkout URL: ${pc.bold(pc.blue(resp.url))}`);
    console.log(pc.dim("Open the link in your browser to complete payment and activate your benefits.\n"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: msg }, null, 2));
    } else {
      console.error(pc.red(`✖ Failed to create checkout session: ${msg}`));
    }
    process.exitCode = 1;
  }
}
