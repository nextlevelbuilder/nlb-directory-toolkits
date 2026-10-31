import { Command, InvalidArgumentError } from "commander";
import pc from "picocolors";
import { resolveConfig } from "../config.js";
import { AffiliateApiError, AffiliateInputError, NlbAffiliateClient } from "../api/affiliate-client.js";
import { sanitizeTerminalText as safe } from "../preview/ascii.js";

export interface AffiliateCommonOptions {
  apiKey?: string;
  cookie?: string;
  url?: string;
  json?: boolean;
}

interface LinkFieldOptions extends AffiliateCommonOptions {
  code?: string;
  label?: string;
  discountBps?: number;
  destination?: string;
  utmCampaign?: string;
  status?: string;
  expectedVersion?: number;
}

/** Injection points for tests and embedding; the default is global fetch. */
export interface AffiliateCommandDeps {
  fetchFn?: typeof fetch;
}

function parseInteger(value: string): number {
  if (!/^\d+$/.test(value.trim())) throw new InvalidArgumentError("must be a non-negative integer");
  return Number(value);
}

function createClient(opts: AffiliateCommonOptions, deps: AffiliateCommandDeps): NlbAffiliateClient {
  const config = resolveConfig({ apiKey: opts.apiKey, url: opts.url });
  return new NlbAffiliateClient({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey,
    sessionCookie: opts.cookie || process.env.NLB_SESSION_COOKIE,
    fetchFn: deps.fetchFn
  });
}

function reportFailure(err: unknown, opts: AffiliateCommonOptions): void {
  const message = err instanceof Error ? err.message : String(err);
  if (opts.json) {
    const payload: Record<string, unknown> = { success: false, error: message };
    if (err instanceof AffiliateApiError) {
      payload.status = err.status;
      payload.notEnabled = err.notEnabled;
      if (err.code !== undefined) payload.code = err.code;
      if (err.details !== undefined) payload.details = err.details;
      if (err.hint !== undefined) payload.hint = err.hint;
    } else if (err instanceof AffiliateInputError) {
      payload.details = err.issues;
    }
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.error(pc.red(`✖ ${safe(message)}`));
    if (err instanceof AffiliateApiError && err.hint) console.error(pc.dim(`  ${safe(err.hint)}`));
    if (err instanceof AffiliateApiError && err.status === 401) {
      console.error(pc.dim("  Pass a member API key (--api-key, NLB_API_KEY, or 'nlb config set api-key') or a session cookie (--cookie, NLB_SESSION_COOKIE)."));
    }
  }
  process.exitCode = 1;
}

/** Runs one affiliate action: prints the raw JSON envelope or a readable dump, and maps failures to exit code 1. */
async function run(
  opts: AffiliateCommonOptions,
  deps: AffiliateCommandDeps,
  title: string,
  action: (client: NlbAffiliateClient) => Promise<{ data: unknown }>
): Promise<void> {
  try {
    const result = await action(createClient(opts, deps));
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(pc.green(`✔ ${title}`));
    console.log(safe(JSON.stringify(result.data, null, 2)));
    console.log(pc.dim("\nAmounts ending in Minor are minor units (cents); rates ending in Bps are basis points (100 = 1%)."));
  } catch (err) {
    reportFailure(err, opts);
  }
}

function withCommonOptions(cmd: Command): Command {
  return cmd
    .option("-k, --api-key <key>", "Member API key (or NLB_API_KEY)")
    .option("-c, --cookie <cookie>", "Better Auth session cookie, used when no API key is set (or NLB_SESSION_COOKIE)")
    .option("-u, --url <url>", "Directory API base URL")
    .option("--json", "Output the API response (or error) as JSON");
}

function withLinkFieldOptions(cmd: Command): Command {
  return cmd
    .option("--label <label>", "Private name of the link ('' clears it)")
    .option("--discount-bps <bps>", "Buyer discount in basis points (1000 = 10%), within your budget", parseInteger)
    .option("--destination <path>", "Landing path: /, /vi, /courses…, /live…, /blog… or /affiliates…")
    .option("--utm-campaign <slug>", "utm_campaign slug ('' clears it)");
}

function linkFields(opts: LinkFieldOptions): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    code: opts.code,
    label: opts.label,
    discountBps: opts.discountBps,
    destinationPath: opts.destination,
    utmCampaign: opts.utmCampaign,
    status: opts.status,
    expectedVersion: opts.expectedVersion
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

export function registerAffiliateCommands(program: Command, deps: AffiliateCommandDeps = {}): Command {
  const affiliates = program
    .command("affiliates")
    .alias("affiliate")
    .description("Affiliate program: your level, budget, referral links, conversions, commissions and payouts. Acts only on your own account; payout methods are set up in a signed-in browser session on the website.");

  const add = (parent: Command, name: string, description: string) => withCommonOptions(parent.command(name).description(description));

  add(affiliates, "program", "Show the program: levels, budgets, eligible plans, payout threshold and fees, and the current Affiliate Agreement version")
    .action(async (opts: AffiliateCommonOptions) => {
      await run(opts, deps, "Affiliate program", (c) => c.getProgram());
    });

  add(affiliates, "me", "Show your affiliate account: level, budget, balances and masked payout method")
    .alias("status")
    .action(async (opts: AffiliateCommonOptions) => {
      await run(opts, deps, "Your affiliate account", (c) => c.getMe());
    });

  add(affiliates, "join", "Join the program after reading and accepting the Affiliate Agreement (see 'nlb affiliates program' for its version)")
    .requiredOption("--terms-version <version>", "Affiliate Agreement version you read and accept")
    .action(async (opts: AffiliateCommonOptions & { termsVersion: string }) => {
      await run(opts, deps, "Joined the affiliate program", (c) => c.join({ termsVersion: opts.termsVersion }));
    });

  add(affiliates, "preview", "Preview the commission a buyer discount leaves within your budget")
    .requiredOption("--discount-bps <bps>", "Buyer discount in basis points (1000 = 10%)", parseInteger)
    .option("--price-minor <amount>", "Pre-tax price in minor units for a worked example", parseInteger)
    .action(async (opts: AffiliateCommonOptions & { discountBps: number; priceMinor?: number }) => {
      await run(opts, deps, "Incentive preview", (c) => c.preview({ discountBps: opts.discountBps, ...(opts.priceMinor !== undefined ? { priceMinor: opts.priceMinor } : {}) }));
    });

  const links = affiliates.command("links").description("List, create or update your referral links");
  add(links, "list", "List your referral links with clicks and conversions").action(async (opts: AffiliateCommonOptions) => {
    await run(opts, deps, "Your referral links", (c) => c.listLinks());
  });
  withLinkFieldOptions(add(links, "create", "Create a referral link (a random code is used when --code is omitted)")
    .option("--code <code>", "Public code in the /r/<code> URL (4-32 lowercase letters, digits or hyphens; cannot change later)"))
    .action(async (opts: LinkFieldOptions) => {
      await run(opts, deps, "Link created", (c) => c.createLink(linkFields(opts)));
    });
  withLinkFieldOptions(add(links, "update", "Update one of your links for future checkouts (past purchases keep their terms)"))
    .argument("<id>", "Link id (from 'nlb affiliates links list')")
    .option("--status <status>", "active, paused or archived (archiving is permanent)")
    .option("--expected-version <version>", "Refuse the edit if the link's version changed since you read it", parseInteger)
    .action(async (id: string, opts: LinkFieldOptions) => {
      await run(opts, deps, "Link updated", (c) => c.updateLink(id, linkFields(opts)));
    });

  add(affiliates, "conversions", "List your referred purchases (buyers are never identified)")
    .option("--limit <n>", "Maximum rows (1-100)", parseInteger)
    .action(async (opts: AffiliateCommonOptions & { limit?: number }) => {
      await run(opts, deps, "Your conversions", (c) => c.listConversions(opts.limit !== undefined ? { limit: opts.limit } : {}));
    });

  add(affiliates, "commissions", "Show your commission balances and ledger")
    .option("--limit <n>", "Maximum ledger rows (1-100)", parseInteger)
    .action(async (opts: AffiliateCommonOptions & { limit?: number }) => {
      await run(opts, deps, "Your commissions", (c) => c.getCommissions(opts.limit !== undefined ? { limit: opts.limit } : {}));
    });

  add(affiliates, "payouts", "List your payouts with fees, withholding and status").action(async (opts: AffiliateCommonOptions) => {
    await run(opts, deps, "Your payouts", (c) => c.listPayouts());
  });

  return affiliates;
}
