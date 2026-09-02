import { describe, it, expect } from "vitest";
import {
  canonicalizeJson,
  computeContentHash,
  computeContentHashSync,
  verifyContentHash,
  verifyContentHashSync
} from "../src/hasher.js";

describe("Contracts: Canonical Hasher", () => {
  it("should sort object keys alphabetically", () => {
    const obj1 = { z: 1, a: 2, m: { b: 3, a: 4 } };
    const obj2 = { a: 2, m: { a: 4, b: 3 }, z: 1 };
    expect(canonicalizeJson(obj1)).toBe(canonicalizeJson(obj2));
    expect(canonicalizeJson(obj1)).toBe('{"a":2,"m":{"a":4,"b":3},"z":1}');
  });

  it("should preserve array order while canonicalizing objects inside arrays", () => {
    const arr1 = [{ b: 1, a: 2 }, { d: 3, c: 4 }];
    const arr2 = [{ a: 2, b: 1 }, { c: 4, d: 3 }];
    expect(canonicalizeJson(arr1)).toBe(canonicalizeJson(arr2));
    expect(canonicalizeJson(arr1)).toBe('[{"a":2,"b":1},{"c":4,"d":3}]');
  });

  it("should normalize negative zero to 0", () => {
    expect(canonicalizeJson({ zero: -0 })).toBe('{"zero":0}');
    expect(canonicalizeJson({ zero: 0 })).toBe('{"zero":0}');
  });

  it("should reject non-finite numbers", () => {
    expect(() => canonicalizeJson({ val: NaN })).toThrow(/non-finite number/);
    expect(() => canonicalizeJson({ val: Infinity })).toThrow(/non-finite number/);
  });

  it("should detect genuine circular references", () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    expect(() => canonicalizeJson(circular)).toThrow(/Circular reference detected/);
  });

  it("should handle shared non-cyclic references (DAG / diamond shapes) without false circular errors", () => {
    const shared = { key: "value", count: 42 };
    const dag = { a: shared, b: shared };
    expect(() => canonicalizeJson(dag)).not.toThrow();
    expect(canonicalizeJson(dag)).toBe('{"a":{"count":42,"key":"value"},"b":{"count":42,"key":"value"}}');
  });

  it("should compute identical hash asynchronously and synchronously", async () => {
    const doc = {
      name: "NextLevelBuilder",
      tags: ["builder", "ai", "cli"],
      meta: { featured: true, score: 99 }
    };
    const asyncHash = await computeContentHash(doc);
    const syncHash = computeContentHashSync(doc);
    expect(asyncHash).toBe(syncHash);
    expect(asyncHash).toHaveLength(64);
  });

  it("should produce deterministic hashes regardless of property insertion order", async () => {
    const doc1 = { b: "two", a: "one", nested: { y: 2, x: 1 } };
    const doc2 = { nested: { x: 1, y: 2 }, a: "one", b: "two" };

    const hash1 = await computeContentHash(doc1);
    const hash2 = await computeContentHash(doc2);
    expect(hash1).toBe(hash2);
  });

  it("should verify valid hashes and reject invalid hashes", async () => {
    const doc = { test: true, count: 42 };
    const hash = await computeContentHash(doc);

    expect(await verifyContentHash(doc, hash)).toBe(true);
    expect(verifyContentHashSync(doc, hash)).toBe(true);

    expect(await verifyContentHash(doc, "0000000000000000000000000000000000000000000000000000000000000000")).toBe(false);
    expect(verifyContentHashSync(doc, "0000000000000000000000000000000000000000000000000000000000000000")).toBe(false);
  });
});
