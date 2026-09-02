import { webcrypto, createHash } from "node:crypto";

export const HASH_VERSION = "v1" as const;

/**
 * Deterministically sorts object keys and serializes to canonical JSON.
 * - Recursively sorts all object keys in lexicographical order.
 * - Preserves array element order while canonicalizing nested values.
 * - Normalizes -0 to 0.
 * - Rejects NaN, Infinity, -Infinity.
 * - Drops undefined keys in objects.
 * - Detects genuine circular references using a recursion-stack Set.
 */
export function canonicalizeJson(value: unknown, stack = new Set<object>()): string {
  if (value === null || value === undefined) {
    return "null";
  }

  const type = typeof value;

  if (type === "boolean") {
    return value ? "true" : "false";
  }

  if (type === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Cannot canonicalize non-finite number: ${value}`);
    }
    // Normalize negative zero
    return Object.is(value, -0) ? "0" : value.toString();
  }

  if (type === "string") {
    return JSON.stringify(value);
  }

  if (type === "object") {
    if (stack.has(value)) {
      throw new TypeError("Circular reference detected during JSON canonicalization");
    }
    stack.add(value);

    try {
      if (Array.isArray(value)) {
        const items = value.map((item) => canonicalizeJson(item, stack));
        return `[${items.join(",")}]`;
      }

      // Sort object keys alphabetically
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      const entries: string[] = [];

      for (const key of keys) {
        const val = record[key];
        if (val !== undefined && typeof val !== "function" && typeof val !== "symbol") {
          entries.push(`${JSON.stringify(key)}:${canonicalizeJson(val, stack)}`);
        }
      }

      return `{${entries.join(",")}}`;
    } finally {
      // Pop from recursion stack so shared non-cyclic DAG references are allowed
      stack.delete(value);
    }
  }

  throw new TypeError(`Unsupported type for canonicalization: ${type}`);
}

/**
 * Asynchronously computes deterministic SHA-256 canonical hash formatted as lowercase hex string.
 * Compatible with Node.js 18+, Cloudflare Workers, and modern browser runtimes.
 */
export async function computeContentHash(data: unknown): Promise<string> {
  const canonical = canonicalizeJson(data);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(canonical);

  const subtle = globalThis.crypto?.subtle ?? (webcrypto?.subtle as SubtleCrypto);
  if (!subtle) {
    return createHash("sha256").update(canonical).digest("hex");
  }
  const hashBuffer = await subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Synchronous computation of SHA-256 canonical hash using Node.js crypto.
 */
export function computeContentHashSync(data: unknown): string {
  const canonical = canonicalizeJson(data);
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Verifies that a document matches an expected SHA-256 canonical hash.
 */
export async function verifyContentHash(data: unknown, expectedHash: string): Promise<boolean> {
  const actualHash = await computeContentHash(data);
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Synchronously verifies that a document matches an expected SHA-256 canonical hash.
 */
export function verifyContentHashSync(data: unknown, expectedHash: string): boolean {
  const actualHash = computeContentHashSync(data);
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}
