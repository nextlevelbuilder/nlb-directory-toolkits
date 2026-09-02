import type { ProductDocument, Block } from "@nextlevelbuilder/contracts";
import pc from "picocolors";

/**
 * Sanitizes arbitrary untrusted text before printing to terminal.
 * Strips ANSI escapes, OSC sequences, CSI sequences, and dangerous C0 control characters (\x00-\x1F, \x7F).
 */
export function sanitizeTerminalText(input: string): string {
  if (typeof input !== "string") return "";
  return input
    // Strip OSC sequences: \x1b]...\x07 or \x1b]...\x1b\
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "")
    // Strip CSI / ANSI color sequences: \x1b[...m
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    // Strip other control characters except newline and tab
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

  const safeName = sanitizeTerminalText(doc.name);
  const safeSlug = sanitizeTerminalText(doc.slug);
  const safeTagline = sanitizeTerminalText(doc.tagline);
  const safeCategory = sanitizeTerminalText(doc.category);
  const safeTags = doc.tags.map((t) => sanitizeTerminalText(t));
  const safeWebsiteUrl = sanitizeTerminalText(doc.websiteUrl);

  // 1. Header Box
  lines.push(pc.cyan(topBorder()));
  lines.push(pc.cyan(boxLine(`${pc.bold(pc.white(safeName))}  ${pc.dim(`(${safeSlug})`)}`)));
  lines.push(pc.cyan(boxLine(pc.italic(pc.yellow(safeTagline)))));
  lines.push(pc.cyan(divider()));
  lines.push(pc.cyan(boxLine(`${pc.bold("Category:")} ${safeCategory}   ${pc.bold("Tags:")} ${safeTags.map((t) => pc.bgCyan(pc.black(` ${t} `))).join(" ")}`)));
  lines.push(pc.cyan(boxLine(`${pc.bold("Website:")}  ${pc.blue(safeWebsiteUrl)}`)));
  if (doc.repoUrl) {
    lines.push(pc.cyan(boxLine(`${pc.bold("Repo:")}     ${pc.dim(sanitizeTerminalText(doc.repoUrl))}`)));
  }
  if (contentHash) {
    lines.push(pc.cyan(boxLine(`${pc.bold("SHA-256:")}  ${pc.green(sanitizeTerminalText(contentHash))}`)));
  }
  if (doc.metadata.layoutTemplate) {
    lines.push(pc.cyan(boxLine(`${pc.bold("Template:")} ${pc.magenta(sanitizeTerminalText(doc.metadata.layoutTemplate))}`)));
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
  const header = `[#${index}] Block: ${pc.bold(pc.magenta(block.type.toUpperCase()))}`;
  lines.push(pc.gray(topBorder(70)));
  lines.push(pc.gray(boxLine(header, 68)));
  lines.push(pc.gray(divider(70)));

  switch (block.type) {
    case "hero":
      lines.push(pc.gray(boxLine(`${pc.bold("Title:")}    ${sanitizeTerminalText(block.title)}`, 68)));
      if (block.subtitle) lines.push(pc.gray(boxLine(`${pc.bold("Subtitle:")} ${sanitizeTerminalText(block.subtitle)}`, 68)));
      if (block.badge) lines.push(pc.gray(boxLine(`${pc.bold("Badge:")}    ${pc.yellow(sanitizeTerminalText(block.badge))}`, 68)));
      if (block.primaryCta) {
        lines.push(pc.gray(boxLine(`${pc.bold("Primary CTA:")} [${pc.green(sanitizeTerminalText(block.primaryCta.label))}] -> ${sanitizeTerminalText(block.primaryCta.url)}`, 68)));
      }
      lines.push(pc.gray(boxLine(`${pc.bold("Theme:")}    ${block.theme} | ${pc.bold("Align:")} ${block.alignment}`, 68)));
      break;

    case "carousel":
      lines.push(pc.gray(boxLine(`${pc.bold("Slides:")}   ${block.items.length} items (autoplay: ${block.autoplay}, ${block.intervalMs}ms)`, 68)));
      block.items.slice(0, 3).forEach((item, i) => {
        lines.push(pc.gray(boxLine(`  ${i + 1}. ${sanitizeTerminalText(item.title || "Untitled")} -> ${sanitizeTerminalText(item.imageUrl)}`, 68)));
      });
      break;

    case "mediaGallery":
      lines.push(pc.gray(boxLine(`${pc.bold("Gallery:")}  ${block.items.length} media items (${block.columns} columns, ${block.aspectRatio})`, 68)));
      block.items.slice(0, 3).forEach((item, i) => {
        lines.push(pc.gray(boxLine(`  ${i + 1}. [${item.type}] ${sanitizeTerminalText(item.alt || "Media")} -> ${sanitizeTerminalText(item.url)}`, 68)));
      });
      break;

    case "quote":
      lines.push(pc.gray(boxLine(pc.italic(`"${sanitizeTerminalText(block.text)}"`), 68)));
      lines.push(pc.gray(boxLine(`  -- ${pc.bold(sanitizeTerminalText(block.author))}${block.role ? `, ${sanitizeTerminalText(block.role)}` : ""}${block.company ? ` at ${sanitizeTerminalText(block.company)}` : ""}`, 68)));
      break;

    case "grid":
      lines.push(pc.gray(boxLine(`${pc.bold("Title:")}    ${sanitizeTerminalText(block.title || "Features")} (${block.columns} columns)`, 68)));
      block.items.forEach((item) => {
        const desc = sanitizeTerminalText(item.description);
        lines.push(pc.gray(boxLine(`  • ${pc.bold(sanitizeTerminalText(item.title))}: ${desc.slice(0, 50)}${desc.length > 50 ? "..." : ""}`, 68)));
      });
      break;

    case "pricing":
      lines.push(pc.gray(boxLine(`${pc.bold("Pricing:")}  ${sanitizeTerminalText(block.title || "Plans")} (${block.currency})`, 68)));
      block.tiers.forEach((tier) => {
        const popular = tier.isPopular ? pc.yellow(" (Popular)") : "";
        lines.push(pc.gray(boxLine(`  [${pc.bold(sanitizeTerminalText(tier.name))}] $${tier.price}/${tier.billingPeriod}${popular} - ${tier.features.length} features`, 68)));
      });
      break;

    case "faq":
      lines.push(pc.gray(boxLine(`${pc.bold("FAQ:")}      ${block.items.length} Questions`, 68)));
      block.items.slice(0, 3).forEach((item, i) => {
        lines.push(pc.gray(boxLine(`  Q${i + 1}: ${sanitizeTerminalText(item.question)}`, 68)));
      });
      break;

    case "techStack":
      lines.push(pc.gray(boxLine(`${pc.bold("Tech Stack:")} ${block.categories.length} Categories`, 68)));
      block.categories.forEach((cat) => {
        const techs = cat.technologies.map((t) => sanitizeTerminalText(t.name)).join(", ");
        lines.push(pc.gray(boxLine(`  • ${pc.bold(sanitizeTerminalText(cat.name))}: ${techs}`, 68)));
      });
      break;

    case "liveDemo":
      lines.push(pc.gray(boxLine(`${pc.bold("Sandbox:")}  ${block.sandboxType} (${block.heightPx}px)`, 68)));
      lines.push(pc.gray(boxLine(`${pc.bold("URL:")}      ${pc.blue(sanitizeTerminalText(block.url))}`, 68)));
      break;

    case "changelog":
      lines.push(pc.gray(boxLine(`${pc.bold("Changelog:")} ${block.releases.length} Releases`, 68)));
      block.releases.slice(0, 2).forEach((rel) => {
        lines.push(pc.gray(boxLine(`  • ${pc.bold(sanitizeTerminalText(rel.version))} (${sanitizeTerminalText(rel.date)}): ${rel.changes.length} changes`, 68)));
      });
      break;

    case "roadmap":
      lines.push(pc.gray(boxLine(`${pc.bold("Roadmap:")}   ${block.stages.length} Stages`, 68)));
      block.stages.forEach((stage) => {
        lines.push(pc.gray(boxLine(`  • [${stage.stage}] ${pc.bold(sanitizeTerminalText(stage.title))} (${stage.items.length} items)`, 68)));
      });
      break;

    case "founder":
      lines.push(pc.gray(boxLine(`${pc.bold("Founders:")}  ${block.founders.length} Profiles`, 68)));
      block.founders.forEach((f) => {
        lines.push(pc.gray(boxLine(`  • ${pc.bold(sanitizeTerminalText(f.name))} (${sanitizeTerminalText(f.role)})`, 68)));
      });
      break;

    case "verification":
      lines.push(pc.gray(boxLine(`${pc.bold("Proof:")}     ${block.proofType} -> ${pc.yellow(block.status)} (${sanitizeTerminalText(block.verifiedAt || "pending")})`, 68)));
      break;

    case "milestones":
      lines.push(pc.gray(boxLine(`${pc.bold("Milestones:")} ${block.milestones.length} Events`, 68)));
      block.milestones.slice(0, 3).forEach((m) => {
        lines.push(pc.gray(boxLine(`  • ${sanitizeTerminalText(m.date)}: ${pc.bold(sanitizeTerminalText(m.title))}`, 68)));
      });
      break;

    case "caseStudy":
      lines.push(pc.gray(boxLine(`${pc.bold("Case Study:")} ${sanitizeTerminalText(block.title)} (${sanitizeTerminalText(block.clientName)})`, 68)));
      if (block.problem) lines.push(pc.gray(boxLine(`  Problem: ${sanitizeTerminalText(block.problem).slice(0, 55)}...`, 68)));
      if (block.solution) lines.push(pc.gray(boxLine(`  Solution: ${sanitizeTerminalText(block.solution).slice(0, 55)}...`, 68)));
      break;

    case "cta":
      lines.push(pc.gray(boxLine(`${pc.bold("CTA:")}       ${sanitizeTerminalText(block.title)}`, 68)));
      lines.push(pc.gray(boxLine(`  [${pc.green(sanitizeTerminalText(block.buttonText))}] -> ${sanitizeTerminalText(block.buttonUrl)}`, 68)));
      break;
  }

  lines.push(pc.gray(bottomBorder(70)));
  return lines.join("\n");
}
