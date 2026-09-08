# Contracts Documentation (`@nextlevelbuilder/contracts`)

`@nextlevelbuilder/contracts` defines the core data structures, Zod schemas, layout templates, canonical SHA-256 hasher, and API wire contracts for the Next Level Builders ecosystem.

## 16 Canonical Server Block Types

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
  blocks: Block[]          // Array of 16-block compliant objects
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
- `RankingsQuerySchema` & `RankingsResponseSchema` (`data.ranks`)
- `StatsResponseSchema`
- `HealthResponseSchema`
- `VoteInputSchema` & `VoteResponseSchema`
- `ApiKeyItemSchema`, `ApiKeyListResponseSchema`, `ApiKeyCreateInputSchema`, `ApiKeyCreateResponseSchema`, `ApiKeyRevokeResponseSchema`
- `MediaUploadResponseSchema`
- `CheckoutInputSchema` & `CheckoutResponseSchema`
