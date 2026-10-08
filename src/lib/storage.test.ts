import { describe, expect, it } from "vitest";
import { rawFingerprint } from "./storage";
import { createMemoryStorage } from "../test/memory-storage";
import { storageContractCases } from "../test/storage-contract";

describe("shared storage contract", () => {
  it.each(storageContractCases)("$name", async ({ run }) => {
    await run(createMemoryStorage().store, "contract:");
  });
});

describe("raw fingerprints", () => {
  it("compares clone graphs while preserving identity and binary distinctions", () => {
    const graph: Record<string, unknown> = { date: new Date("2026-10-07"), map: new Map([["a", new Set([1])]]), bytes: new Uint8Array([0, 255]), regex: /test/gi };
    graph.self = graph;
    expect(rawFingerprint(graph)).toBe(rawFingerprint(structuredClone(graph)));
    expect(rawFingerprint({ a: 1, b: 2 })).toBe(rawFingerprint({ b: 2, a: 1 }));
    expect(rawFingerprint(-0)).not.toBe(rawFingerprint(0));
    expect(rawFingerprint(new Uint8Array([1]))).not.toBe(rawFingerprint(new Uint8Array([2])));
    const shared = {}; expect(rawFingerprint([shared, shared])).not.toBe(rawFingerprint([{}, {}]));
    expect(rawFingerprint(Array(1))).not.toBe(rawFingerprint([]));
  });
  it("conservatively distinguishes opaque clone types", () => {
    const value = new Blob(["same"]);
    expect(rawFingerprint(value)).not.toBe(rawFingerprint(value));
  });
});
