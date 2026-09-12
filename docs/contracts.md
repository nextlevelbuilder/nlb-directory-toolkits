# Contracts Documentation (`@nextlevelbuilder/contracts`)

`@nextlevelbuilder/contracts` defines the core data structures, Zod schemas, layout templates, canonical SHA-256 hasher, and API wire contracts for the Next Level Builders ecosystem.

## 17 Canonical Server Block Types

Every block conforms to `BlockSchema = z.discriminatedUnion("type", [ ... ])`, requiring `id: string` and typed `props`:

| Block Type | Primary `props` Fields | Description |
|---|---|---|
| `hero` | `headline`, `subheadline`, `primaryCtaText`, `primaryCtaUrl`, `badge` | Main product hero section |
| `carousel` | `items: Array<{ title, imageUrl, description? }>` | Feature/product showcase carousel (1-10 slides) |
| `mediaGallery` | `images: Array<{ url, caption?, aspectRatio }>` | Image gallery (1-8 images) |
| `quote` | `quote`, `author`, `title`, `avatarUrl` | Testimonial & social proof |
| `grid` | `columns` (1-3), `items: Array<{ title, description, icon? }>` | Feature card grid (1-12 items) |
| `changelog` | `entries: Array<{ version, date, changes: string[] }>` | Release notes & version history (1-10 entries) |
| `roadmap` | `milestones: Array<{ quarter, title, status }>` | Product roadmap (1-8 items) |
| `pricing` | `tiers: Array<{ name, price, period?, features, ctaText, ctaUrl?, isPopular }>` | Transparent pricing tables (1-4 tiers) |
| `faq` | `items: Array<{ question, answer }>` | Frequently asked questions (1-20 items) |
| `techStack` | `technologies: Array<{ name, category, icon? }>` | Tech stack badges (1-16 items) |
| `liveDemo` | `embedUrl`, `sandboxTokens`, `height` | Embedded interactive sandboxes |
| `cta` | `title`, `subtitle`, `buttonText`, `buttonUrl` | Call-to-action banner |
| `founder` | `name`, `bio`, `avatarUrl`, `xHandle`, `linkedinUrl` | Founder profile |
| `verification` | `metricType`, `verifiedValue`, `verificationScope`, `verifiedAt`, `evidenceStandard` | Cryptographic & platform verification |
| `milestones` | `items: Array<{ date, title, description? }>` | Key project milestones (1-10 items) |
| `caseStudy` | `customerName`, `problem`, `solution`, `outcome`, `metrics?` | In-depth customer case study |
| `analytics` | `title` (1–100 characters, default `Traffic`), `period` (`7d`, `30d`, `90d`; default `30d`) | Live NLB product page traffic; publishing opts into public aggregate totals and daily series |

To add traffic to an existing product, insert this block into its document's `blocks` array and use the existing CLI `submit` or MCP `submit_product` revision flow:

```json
{ "id": "traffic-1", "type": "analytics", "props": { "title": "Traffic", "period": "30d" } }
```

The server determines the product from the page being rendered. Do not supply a product ID or analytics counts in the block. It measures visits to the NLB-hosted product page, not the product's external website. Publishing the block makes its aggregate totals and daily series public; referrers, countries, and devices remain organization-authorized. Templates do not insert this block automatically.

---

## Document Schemas

### 1. `ProductDocumentSchema` (Canonical Server Wire Document)
Strictly validated on the server for all revisions:
```typescript
{
  schemaVersion: 1,
  title: string,           // 1-100 chars
  tagline: string,         // 1-200 chars
  description: string,     // 10-2000 chars
  websiteUrl: string,      // Valid HTTP/HTTPS URL
  logoUrl?: string,        // Valid HTTP/HTTPS URL
  categorySlugs: string[], // 1-5 category identifiers
  tagSlugs: string[],      // 0-10 tag identifiers
  blocks: Block[]          // Array of supported block objects
}
```

### 2. `AuthorProductDocumentSchema` & `toServerDocument`
Allows author-friendly fields (`name` instead of `title`, single `category` or array, `tags`) and automatically converts them to the canonical server format:
```typescript
import { toServerDocument, computeContentHashSync } from "@nextlevelbuilder/contracts";

const authorDoc = {
  name: "My CLI",
  category: "Developer Tools",
  tags: ["ai", "agents"],
  tagline: "High-impact tool",
  description: "Detailed description of the tool.",
  websiteUrl: "https://example.com",
  blocks: [...]
};

const serverDoc = toServerDocument(authorDoc);
const hash = computeContentHashSync(serverDoc);
```

---

## 5 Layout Templates

Exported via `LAYOUT_TEMPLATES`:
1. **`saas-launch`**: Hero -> MediaGallery -> Grid -> TechStack -> FAQ -> CTA
2. **`ai-agent`**: Hero -> MediaGallery -> Grid -> Milestones -> CTA
3. **`dev-tool`**: Hero -> TechStack -> Grid -> Changelog -> CTA
4. **`community-curated`**: Hero -> Founder -> Grid -> CTA
5. **`minimalist`**: Hero -> MediaGallery -> CTA

Helper functions:
```typescript
import { listTemplates, getTemplate, createDocumentFromTemplate } from "@nextlevelbuilder/contracts";

const templates = listTemplates();
const template = getTemplate("dev-tool"); // Also accepts legacy aliases like "developer-cli"
const doc = createDocumentFromTemplate("dev-tool", {
  title: "My CLI",
  tagline: "Blazing fast",
  description: "Detailed description.",
  websiteUrl: "https://example.com"
});
```

---

## API Wire Schemas

Exported from `@nextlevelbuilder/contracts`:
- `ProductCreateInputSchema` & `ProductCreateResponseSchema`
- `ProductRevisionInputSchema` & `ProductRevisionResponseSchema`
- `ProductSubmitInputSchema`, `ProductSubmitSuccessSchema` & `ProductSubmitPaymentRequiredSchema` (HTTP 402)
- `ProductListQuerySchema` & `ProductListResponseSchema` (with `limit` & `offset` pagination)
- `ProductDetailResponseSchema`
- `ProductTrafficQuerySchema` & `ProductTrafficResponseSchema` (`GET /api/v1/products/{slug}/traffic`)
- `RankingsQuerySchema` & `RankingsResponseSchema` (`data.ranks`)
- `StatsResponseSchema`
- `HealthResponseSchema`
- `VoteInputSchema` & `VoteResponseSchema`
- `ApiKeyItemSchema`, `ApiKeyListResponseSchema`, `ApiKeyCreateInputSchema`, `ApiKeyCreateResponseSchema`, `ApiKeyRevokeResponseSchema`
- `MediaUploadResponseSchema`
- `CheckoutInputSchema` & `CheckoutResponseSchema`

### Product traffic

The traffic endpoint requires an API key authorized for the product's organization. Optional `from` and `to` must be UTC ISO timestamps; `to` defaults to now and `from` to 30 days before `to`. The start must precede the end, the end cannot be in the future, and the range cannot exceed 90 days.

```typescript
{
  data: {
    source: "clickhouse",
    from: string, to: string, updatedAt: string,
    pageViews: number, visitors: number, outboundClicks: number, activeVisitors: number,
    series: Array<{ date: string; pageViews: number; visitors: number; outboundClicks: number }>,
    referrers: Array<{ name: string; count: number }>,
    countries: Array<{ name: string; count: number }>,
    devices: Array<{ name: string; count: number }>
  }
}
```

Series dates use `YYYY-MM-DD`. Missing or unavailable analytics are errors, not zero-filled responses.

`visitors` counts daily visitor sessions. Session identifiers are salted by UTC date, so a returning session on the next UTC day counts again. A range total therefore is not a count of unique people across the whole period.
