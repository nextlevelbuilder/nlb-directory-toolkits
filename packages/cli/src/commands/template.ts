import { writeFileSync } from "node:fs";
import { listTemplates, getTemplate, createDocumentFromTemplate } from "@nextlevelbuilder/contracts";
import pc from "picocolors";

export interface TemplateOptions {
  out?: string;
  json?: boolean;
}

export async function templateCommand(templateName?: string, options: TemplateOptions = {}): Promise<void> {
  if (!templateName) {
    const templates = listTemplates();
    if (options.json) {
      console.log(
        JSON.stringify(
          templates.map((t) => ({
            name: t.name,
            slug: t.slug,
            description: t.description,
            recommendedCategory: t.recommendedCategory,
            blockTypes: t.blockTypes
          })),
          null,
          2
        )
      );
      return;
    }

    console.log(pc.cyan(`\n🎨 Available Next Level Builders Layout Templates:\n`));
    templates.forEach((t) => {
      console.log(`  • ${pc.bold(pc.white(t.name))} ${pc.dim(`(${t.slug})`)}`);
      console.log(`    ${pc.gray(t.description)}`);
      console.log(`    Category: ${pc.yellow(t.recommendedCategory || "General")} | Blocks: ${(t.blockTypes || []).join(", ")}\n`);
    });
    console.log(pc.dim(`Generate starter file: npx @nextlevelbuilder/cli template <slug> --out product.json\n`));
    return;
  }

  const template = getTemplate(templateName);
  if (!template) {
    const available = listTemplates()
      .map((t) => t.slug)
      .join(", ");
    console.error(pc.red(`✖ Template '${templateName}' not found. Available: ${available}`));
    process.exitCode = 1;
    return;
  }

  const doc = createDocumentFromTemplate(template.slug, {
    title: "My Awesome Product",
    tagline: "Describe your product in one compelling sentence.",
    description: "Full markdown description explaining what your product does, why it matters, and how builders benefit.",
    websiteUrl: "https://myproduct.example.com"
  });

  const formattedJson = JSON.stringify(doc, null, 2);

  if (options.out) {
    writeFileSync(options.out, formattedJson, "utf-8");
    console.log(pc.green(`✔ Created template file at ${pc.bold(options.out)} using '${template.name}'`));
  } else if (options.json) {
    console.log(formattedJson);
  } else {
    console.log(pc.green(`✔ Starter template for '${template.name}':\n`));
    console.log(formattedJson);
  }
}
