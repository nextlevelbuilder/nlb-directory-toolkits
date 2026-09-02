# Contracts Documentation (`@nextlevelbuilder/contracts`)

`@nextlevelbuilder/contracts` defines the core data structures, Zod schemas, layout templates, canonical SHA-256 hasher, and API contracts for the Next Level Builders ecosystem.

## 16 Block Types

Every block conforms to `BlockSchema = z.discriminatedUnion("type", [ ... ])`:

| Block Type | Primary Fields | Use Case |
|---|---|---|
| `hero` | `title`, `subtitle`, `badge`, `primaryCta`, `secondaryCta`, `theme`, `alignment` | Main product hero section |
| `carousel` | `items`, `autoplay`, `intervalMs`, `layout` | Feature/image slideshow |
| `mediaGallery` | `items`, `columns`, `aspectRatio` | Multi-column screenshot/video gallery |
| `quote` | `text`, `author`, `role`, `company`, `rating`, `verified` | Testimonial & social proof |
| `grid` | `title`, `columns`, `items` (title, description, icon, badge) | Feature card grid |
| `changelog` | `releases` (version, date, changes) | Release notes & version history |
| `roadmap` | `stages` (planned, in_progress, completed) | Product roadmap |
| `pricing` | `currency`, `tiers` (name, price, billingPeriod, features, isPopular) | Transparent pricing tables |
| `faq` | `items` (question, answer, category) | Frequently asked questions |
| `techStack` | `categories` (technologies: name, icon, version) | Tech stack badges |
| `liveDemo` | `url`, `sandboxType`, `heightPx`, `instructions` | Embedded interactive sandboxes |
| `cta` | `title`, `buttonText`, `buttonUrl`, `style` | Call-to-action banner |
| `founder` | `founders` (name, role, bio, socialLinks) | Founder profiles |
| `verification` | `proofType`, `verifiedAt`, `status`, `details` | Provenance verification |
| `milestones` | `milestones` (date, title, description, metrics) | Key project milestones |
| `caseStudy` | `clientName`, `problem`, `solution`, `results`, `testimonial` | In-depth case study |

---

## 5 Layout Templates

Pre-configured block arrangements exported by `TEMPLATES`:
1. **`saas-launch`**: Hero -> MediaGallery -> Grid -> Pricing -> FAQ -> Founder -> CTA
2. **`ai-agent-tool`**: Hero -> LiveDemo -> TechStack -> Carousel -> Changelog -> Verification -> CTA
3. **`developer-cli`**: Hero -> TechStack -> Grid -> Roadmap -> Changelog -> Verification -> CTA
4. **`curated-community`**: Hero -> Grid -> Quote -> Milestones -> FAQ -> Founder -> CTA
5. **`minimalist-showcase`**: Hero -> MediaGallery -> CaseStudy -> Quote -> CTA

Helper functions:
```typescript
import { listTemplates, getTemplate, createDocumentFromTemplate } from "@nextlevelbuilder/contracts";

const templates = listTemplates();
const template = getTemplate("developer-cli");
const doc = createDocumentFromTemplate("developer-cli", {
  name: "My CLI",
  slug: "my-cli",
  tagline: "Blazing fast",
  description: "Description",
  websiteUrl: "https://example.com"
});
```

---

## Canonical SHA-256 Hasher

```typescript
import { canonicalizeJson, computeContentHash, verifyContentHash } from "@nextlevelbuilder/contracts";

// Canonicalize JSON string
const canonical = canonicalizeJson({ b: 2, a: 1 }); // '{"a":1,"b":2}'

// Asynchronous computation (Web Crypto / Node / Workers)
const hash = await computeContentHash(doc);

// Verify hash
const isValid = await verifyContentHash(doc, hash);
```
