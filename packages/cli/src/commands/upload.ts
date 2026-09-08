import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, extname, basename } from "node:path";
import { resolveConfig } from "../config.js";
import { NlbApiClient } from "../api/client.js";
import pc from "picocolors";

const ALLOWED_MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime"
};

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

export interface UploadOptions {
  folder?: string;
  url?: string;
  apiKey?: string;
  json?: boolean;
}

export async function uploadCommand(
  filePath: string,
  options: UploadOptions = {}
): Promise<void> {
  const fullPath = resolve(process.cwd(), filePath);

  if (!existsSync(fullPath)) {
    const errorMsg = `File not found: ${filePath}`;
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: errorMsg }));
    } else {
      console.error(pc.red(`✖ ${errorMsg}`));
    }
    process.exitCode = 1;
    return;
  }

  const ext = extname(fullPath).toLowerCase();
  const mimeType = ALLOWED_MIME_TYPES[ext];
  if (!mimeType) {
    const errorMsg = `Unsupported file format '${ext}'. Allowed: .png, .jpg, .webp, .svg, .gif, .mp4, .webm, .mov`;
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: errorMsg }));
    } else {
      console.error(pc.red(`✖ ${errorMsg}`));
    }
    process.exitCode = 1;
    return;
  }

  const stat = statSync(fullPath);
  const isVideo = mimeType.startsWith("video/");
  const limit = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  const limitStr = isVideo ? "100MB" : "10MB";

  if (stat.size > limit) {
    const errorMsg = `File size (${(stat.size / (1024 * 1024)).toFixed(2)}MB) exceeds the maximum allowed limit of ${limitStr}.`;
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: errorMsg }));
    } else {
      console.error(pc.red(`✖ ${errorMsg}`));
    }
    process.exitCode = 1;
    return;
  }

  const config = resolveConfig(options);
  const client = new NlbApiClient({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey
  });

  try {
    const fileBuffer = readFileSync(fullPath);
    const filename = basename(fullPath);
    const folder = options.folder ? options.folder.replace(/[^a-z0-9_-]/gi, "") : "uploads";

    if (!options.json) {
      console.log(pc.cyan(`📤 Uploading '${filename}' (${(stat.size / 1024).toFixed(1)} KB) to ${config.apiUrl}...`));
    }

    const resp = await client.uploadMedia(fileBuffer, filename, mimeType, folder);

    if (options.json) {
      console.log(JSON.stringify(resp, null, 2));
      return;
    }

    console.log(pc.green(`\n✔ Media uploaded successfully!`));
    console.log(`  • URL:      ${pc.bold(pc.blue(resp.url))}`);
    if (resp.provider) console.log(`  • Storage:  ${pc.dim(resp.provider)}`);
    console.log("");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: msg }, null, 2));
    } else {
      console.error(pc.red(`\n✖ Upload failed: ${msg}`));
    }
    process.exitCode = 1;
  }
}
