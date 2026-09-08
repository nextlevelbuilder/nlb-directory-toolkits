import type { ProductDocument, Block } from "@nextlevelbuilder/contracts";
import pc from "picocolors";

/**
 * Sanitizes arbitrary untrusted text before printing to terminal.
 * Strips ANSI escapes, OSC sequences, CSI sequences, and dangerous C0 control characters (\x00-\x1F, \x7F).
 */
export function sanitizeTerminalText(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

function stripAnsiForLength(content: string): string {
  return content.replace(/\x1b\[[0-9;]*m/g, "");
}

function boxLine(content: string, width = 74): string {
  const cleanLen = stripAnsiForLength(content).length;
  const padding = Math.max(0, width - cleanLen);
  return `│ ${content}${" ".repeat(padding)} │`;
}

function divider(width = 76): string {
  return `├${"─".repeat(width - 2)}┤`;
}

function topBorder(width = 76): string {
  return `┌${"─".repeat(width - 2)}┐`;
}

function bottomBorder(width = 76): string {
  return `└${"─".repeat(width - 2)}┘`;
}

export function renderProductPreview(doc: ProductDocument, contentHash?: string): string {
  const lines: string[] = [];

  const rawDoc = doc as Record<string, unknown>;
  const safeTitle = sanitizeTerminalText(doc.title || rawDoc.name || "Untitled Product");
  const safeSlug = sanitizeTerminalText(rawDoc.slug || safeTitle.toLowerCase().replace(/[^a-z0-9-]+/g, "-"));
  const safeTagline = sanitizeTerminalText(doc.tagline);
  const rawCategories = Array.isArray(doc.categorySlugs) ? doc.categorySlugs : [rawDoc.category as string].filter(Boolean);
  const safeCategories = rawCategories.map((c) => sanitizeTerminalText(c));
  const rawTags = Array.isArray(doc.tagSlugs) ? doc.tagSlugs : Array.isArray(rawDoc.tags) ? (rawDoc.tags as string[]) : [];
  const safeTags = rawTags.map((t) => sanitizeTerminalText(t));
  const safeWebsiteUrl = sanitizeTerminalText(doc.websiteUrl);
  // 1. Header Box
  lines.push(pc.cyan(topBorder()));
  lines.push(pc.cyan(boxLine(`${pc.bold(pc.white(safeTitle))}  ${pc.dim(`(${safeSlug})`)}`)));
  lines.push(pc.cyan(boxLine(pc.italic(pc.yellow(safeTagline)))));
  lines.push(pc.cyan(divider()));
  lines.push(
    pc.cyan(
      boxLine(
        `${pc.bold("Categories:")} ${safeCategories.join(", ") || "General"}   ${pc.bold("Tags:")} ${safeTags.map((t) => pc.bgCyan(pc.black(` ${t} `))).join(" ")}`
      )
    )
  );
  lines.push(pc.cyan(boxLine(`${pc.bold("Website:")}     ${pc.blue(safeWebsiteUrl)}`)));
  if (rawDoc.repoUrl) {
    lines.push(pc.cyan(boxLine(`${pc.bold("Repo:")}        ${pc.dim(sanitizeTerminalText(rawDoc.repoUrl))}`)));
  }
  if (contentHash) {
    lines.push(pc.cyan(boxLine(`${pc.bold("SHA-256:")}     ${pc.green(sanitizeTerminalText(contentHash))}`)));
  }
  lines.push(pc.cyan(bottomBorder()));
  lines.push("");

  // 2. Blocks Section
  lines.push(pc.bold(pc.underline(`📋 Product Blocks (${doc.blocks.length} blocks):`)));
  lines.push("");

  doc.blocks.forEach((block, index) => {
    lines.push(renderBlock(block, index + 1));
    lines.push("");
  });

  return lines.join("\n");
}

function renderBlock(block: Block, index: number): string {
  const lines: string[] = [];
  const header = `[#${index}] Block: ${pc.bold(pc.magenta(block.type.toUpperCase()))} ${block.id ? pc.dim(`(id: ${block.id})`) : ""}`;
  lines.push(pc.gray(topBorder(70)));
  lines.push(pc.gray(boxLine(header, 68)));
  lines.push(pc.gray(divider(70)));

  switch (block.type) {
    case "hero": {
      const p = block.props;
      lines.push(pc.gray(boxLine(`${pc.bold("Headline:")}    ${sanitizeTerminalText(p.headline)}`, 68)));
      if (p.subheadline) lines.push(pc.gray(boxLine(`${pc.bold("Subheadline:")} ${sanitizeTerminalText(p.subheadline)}`, 68)));
      if (p.badge) lines.push(pc.gray(boxLine(`${pc.bold("Badge:")}       ${pc.yellow(sanitizeTerminalText(p.badge))}`, 68)));
      if (p.primaryCtaText && p.primaryCtaUrl) {
        lines.push(pc.gray(boxLine(`${pc.bold("CTA:")}         ${sanitizeTerminalText(p.primaryCtaText)} -> ${pc.blue(sanitizeTerminalText(p.primaryCtaUrl))}`, 68)));
      }
      break;
    }
    case "carousel": {
      const items = block.props.items || [];
      lines.push(pc.gray(boxLine(`Slides: ${items.length} item(s)`, 68)));
      items.forEach((item, i) => {
        lines.push(pc.gray(boxLine(`  ${i + 1}. ${sanitizeTerminalText(item.title)} (${sanitizeTerminalText(item.imageUrl)})`, 68)));
      });
      break;
    }
    case "mediaGallery": {
      const images = block.props.images || [];
      lines.push(pc.gray(boxLine(`Images: ${images.length} item(s)`, 68)));
      images.forEach((img, i) => {
        lines.push(pc.gray(boxLine(`  ${i + 1}. ${sanitizeTerminalText(img.caption || img.url)}`, 68)));
      });
      break;
    }
    case "quote": {
      const p = block.props;
      lines.push(pc.gray(boxLine(`"${sanitizeTerminalText(p.quote)}"`, 68)));
      lines.push(pc.gray(boxLine(`  — ${pc.bold(sanitizeTerminalText(p.author))}${p.title ? `, ${sanitizeTerminalText(p.title)}` : ""}`, 68)));
      break;
    }
    case "grid": {
      const p = block.props;
      lines.push(pc.gray(boxLine(`Columns: ${p.columns} | Items: ${p.items.length}`, 68)));
      p.items.forEach((item) => {
        lines.push(pc.gray(boxLine(`  • ${pc.bold(sanitizeTerminalText(item.title))}: ${sanitizeTerminalText(item.description)}`, 68)));
      });
      break;
    }
    case "pricing": {
      const tiers = block.props.tiers || [];
      lines.push(pc.gray(boxLine(`Tiers (${tiers.length}):`, 68)));
      tiers.forEach((tier) => {
        const safeFeatures = Array.isArray(tier.features) ? tier.features.map((f) => sanitizeTerminalText(f)) : [];
        lines.push(pc.gray(boxLine(`  • ${pc.bold(sanitizeTerminalText(tier.name))} (${sanitizeTerminalText(tier.price)}): ${safeFeatures.join(", ")}`, 68)));
      });
      break;
    }
    case "faq": {
      const items = block.props.items || [];
      lines.push(pc.gray(boxLine(`FAQ Items: ${items.length}`, 68)));
      items.forEach((item, i) => {
        lines.push(pc.gray(boxLine(`  Q${i + 1}: ${sanitizeTerminalText(item.question)}`, 68)));
      });
      break;
    }
    case "techStack": {
      const techs = block.props.technologies || [];
      lines.push(pc.gray(boxLine(`Technologies (${techs.length}):`, 68)));
      techs.forEach((t) => {
        lines.push(pc.gray(boxLine(`  • ${sanitizeTerminalText(t.name)} (${sanitizeTerminalText(t.category)})`, 68)));
      });
      break;
    }
    case "liveDemo": {
      const p = block.props;
      lines.push(pc.gray(boxLine(`Live Demo Embed: ${pc.blue(sanitizeTerminalText(p.embedUrl))}`, 68)));
      break;
    }
    case "cta": {
      const p = block.props;
      lines.push(pc.gray(boxLine(`${pc.bold(sanitizeTerminalText(p.title))}`, 68)));
      lines.push(pc.gray(boxLine(`Button: ${sanitizeTerminalText(p.buttonText)} -> ${pc.blue(sanitizeTerminalText(p.buttonUrl))}`, 68)));
      break;
    }
    case "founder": {
      const p = block.props;
      lines.push(pc.gray(boxLine(`Founder: ${pc.bold(sanitizeTerminalText(p.name))}`, 68)));
      lines.push(pc.gray(boxLine(`Bio: ${sanitizeTerminalText(p.bio)}`, 68)));
      break;
    }
    case "changelog": {
      const entries = block.props.entries || [];
      lines.push(pc.gray(boxLine(`Changelog Releases (${entries.length}):`, 68)));
      entries.forEach((e) => {
        const safeChanges = Array.isArray(e.changes) ? e.changes.map((c) => sanitizeTerminalText(c)) : [];
        lines.push(pc.gray(boxLine(`  • v${sanitizeTerminalText(e.version)} (${sanitizeTerminalText(e.date)}): ${safeChanges.join("; ")}`, 68)));
      });
      break;
    }
    case "roadmap": {
      const milestones = block.props.milestones || [];
      lines.push(pc.gray(boxLine(`Roadmap Milestones (${milestones.length}):`, 68)));
      milestones.forEach((m) => {
        lines.push(pc.gray(boxLine(`  • [${sanitizeTerminalText(m.status)}] ${sanitizeTerminalText(m.quarter)}: ${sanitizeTerminalText(m.title)}`, 68)));
      });
      break;
    }
    case "milestones": {
      const items = block.props.items || [];
      lines.push(pc.gray(boxLine(`Milestones (${items.length}):`, 68)));
      items.forEach((m) => {
        lines.push(pc.gray(boxLine(`  • ${sanitizeTerminalText(m.date)}: ${sanitizeTerminalText(m.title)}`, 68)));
      });
      break;
    }
    case "caseStudy": {
      const p = block.props;
      lines.push(pc.gray(boxLine(`Case Study: ${pc.bold(sanitizeTerminalText(p.customerName))}`, 68)));
      lines.push(pc.gray(boxLine(`Solution: ${sanitizeTerminalText(p.solution)}`, 68)));
      break;
    }
    case "verification": {
      const p = block.props;
      lines.push(pc.gray(boxLine(`Verified Metric (${sanitizeTerminalText(p.metricType)}): ${pc.green(sanitizeTerminalText(p.verifiedValue))}`, 68)));
      lines.push(pc.gray(boxLine(`Evidence Standard: ${sanitizeTerminalText(p.evidenceStandard)}`, 68)));
      break;
    }
    default:
      lines.push(pc.gray(boxLine(`Block type: ${(block as Block).type}`, 68)));
      break;
  }

  lines.push(pc.gray(bottomBorder(70)));
  return lines.join("\n");
}
