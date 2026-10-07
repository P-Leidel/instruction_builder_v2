import { describe, it, expect } from "vitest";
import { createEmptyDocument } from "../model/instruction";
import { createGuideRepository, GUIDE_PREFIX, LEGACY_KEY, MIGRATION_KEY, type GuideStore } from "./guide-repository";

function memoryStore(seed: Map<string, unknown> = new Map()) {
  let tail = Promise.resolve();
  const state = { records: seed, failRecovery: false, failCommit: false, pause: undefined as Promise<void> | undefined };
  const store: GuideStore = { transaction: (operation) => {
    const next = tail.then(async () => {
      await state.pause;
      const draft = structuredClone(state.records);
      const value = operation({ get: (key) => draft.get(key), entries: () => [...draft], put: (key, entry) => {
        if (state.failRecovery && key.startsWith("instruction-builder:recovery:")) throw new Error("backup failed");
        draft.set(key, structuredClone(entry));
      } });
      if (state.failCommit) throw new Error("quota exceeded");
      state.records.clear();
      for (const [key, entry] of draft) state.records.set(key, entry);
      return value;
    });
    tail = next.then(() => undefined, () => undefined);
    return next;
  } };
  return { state, store };
}

function legacy() {
  return { schemaVersion: 1, meta: { title: "Old guide", domain: "recipe", createdAt: "2026-10-06T00:00:00Z" },
    steps: [{ id: "step", tokens: [{ id: "token", iconId: "onion", category: "object", quantity: { iconId: "quantity", label: "3 kg" } }] }] };
}

describe("local guide transactions", () => {
  it("migratesLegacyExactlyOnce", async () => {
    const raw = legacy();
    const { state, store } = memoryStore(new Map([[LEGACY_KEY, raw]]));
    const a = createGuideRepository({ store }); const b = createGuideRepository({ store });
    const [listA, listB] = await Promise.all([a.list(), b.list()]);
    expect(listA).toHaveLength(1); expect(listB[0].id).toBe(listA[0].id);
    expect([...state.records.keys()].filter((key) => key.startsWith(GUIDE_PREFIX))).toHaveLength(1);
    expect(state.records.get(MIGRATION_KEY)).toMatchObject({ guideId: listA[0].id, fingerprint: expect.any(String) });
    expect(state.records.get(LEGACY_KEY)).toEqual(raw);
    const loaded = await a.load(listA[0].id);
    expect(loaded?.document.meta.presentation).toBe("sequence");
    expect(loaded?.document.steps[0].tokens[0].quantity).toMatchObject({ amount: 3, unit: "kg" });
  });

  it("creates no surprise saved guide without legacy data", async () => {
    const { state, store } = memoryStore();
    expect(await createGuideRepository({ store }).list()).toEqual([]);
    expect(state.records.size).toBe(0);
  });

  it("backsUpUnreadableLegacyBeforeFallback", async () => {
    for (const raw of [{ schemaVersion: 99, future: ["exact"] }, (() => { const value: Record<string, unknown> = {}; value.cycle = value; return value; })()]) {
      const { state, store } = memoryStore(new Map([[LEGACY_KEY, raw]]));
      expect(await createGuideRepository({ store }).list()).toEqual([]);
      expect(await createGuideRepository({ store }).list()).toEqual([]);
      const backups = [...state.records].filter(([key]) => key.startsWith("instruction-builder:recovery:"));
      expect(backups).toHaveLength(2);
      expect(backups[0][0]).not.toBe(backups[1][0]);
      for (const [, copy] of backups) expect(copy).toEqual(raw);
      expect(state.records.get(LEGACY_KEY)).toEqual(raw);
      expect(state.records.has(MIGRATION_KEY)).toBe(false);
    }
  });

  it("backup failure aborts migration and disables creation", async () => {
    const raw = { schemaVersion: 99 };
    const { state, store } = memoryStore(new Map([[LEGACY_KEY, raw]])); state.failRecovery = true;
    const repository = createGuideRepository({ store });
    await expect(repository.list()).rejects.toThrow();
    expect(await repository.create(createEmptyDocument())).toEqual({ ok: false, reason: "unavailable" });
    expect([...state.records]).toEqual([[LEGACY_KEY, raw]]);
  });

  it("preservesLaterLegacyEdits", async () => {
    const { state, store } = memoryStore(new Map([[LEGACY_KEY, legacy()]]));
    const first = await createGuideRepository({ store }).list();
    const changed = { ...legacy(), meta: { ...legacy().meta, title: "Still-open old app" } };
    state.records.set(LEGACY_KEY, changed);
    const notices: unknown[] = [];
    const next = await createGuideRepository({ store, onNotice: (notice) => notices.push(notice) }).list();
    expect(next).toEqual(first);
    expect(notices).toMatchObject([{ code: "legacy-changed", guideId: first[0].id }]);
    const backup = [...state.records].find(([key]) => key.startsWith("instruction-builder:recovery:"));
    expect(backup?.[1]).toEqual(changed);
  });

  it("commitsOnlyMatchingBaseline", async () => {
    const { state, store } = memoryStore();
    const a = createGuideRepository({ store }); const b = createGuideRepository({ store });
    const created = await a.create(createEmptyDocument()); if (!created.ok) throw new Error("fixture create failed");
    const stale = await b.load(created.record.id); if (!stale) throw new Error("fixture load failed");
    const changed = structuredClone(created.record); changed.document.meta.title = "same revision external edit";
    state.records.set(GUIDE_PREFIX + changed.id, changed);
    stale.document.meta.title = "losing work";
    await b.list(); // A summary refresh must not silently adopt another writer's raw baseline.
    expect(await b.save(stale.id, stale.revision, stale.document)).toEqual({ ok: false, reason: "conflict" });
    expect(state.records.get(GUIDE_PREFIX + changed.id)).toEqual(changed);
    expect(stale.document.meta.title).toBe("losing work");
  });

  it("an aborted explicit load cannot advance the raw baseline", async () => {
    const { state, store } = memoryStore(); const repository = createGuideRepository({ store });
    const created = await repository.create(createEmptyDocument()); if (!created.ok) throw new Error("fixture create failed");
    const changed = structuredClone(created.record); changed.document.meta.title = "External";
    state.records.set(GUIDE_PREFIX + changed.id, changed); state.failCommit = true;
    await expect(repository.load(changed.id)).rejects.toThrow();
    state.failCommit = false;
    expect(await repository.save(changed.id, 1, created.record.document)).toEqual({ ok: false, reason: "conflict" });
  });

  it("opaque non-JSON envelope values cannot silently bypass raw-baseline comparison", async () => {
    const { state, store } = memoryStore(); const repository = createGuideRepository({ store });
    const made = await repository.create(createEmptyDocument()); if (!made.ok) throw new Error("fixture create failed");
    const raw = { ...made.record, unknownFutureData: new Blob(["AAA"]) }; state.records.set(GUIDE_PREFIX + raw.id, raw);
    await repository.load(raw.id);
    state.records.set(GUIDE_PREFIX + raw.id, { ...raw, unknownFutureData: new Blob(["BBB"]) });
    expect(await repository.save(raw.id, raw.revision, raw.document)).toEqual({ ok: false, reason: "conflict" });
    expect(await (state.records.get(GUIDE_PREFIX + raw.id) as typeof raw).unknownFutureData.text()).toBe("BBB");
  });

  it("differentGuidesDoNotConflict", async () => {
    const { store } = memoryStore(); const a = createGuideRepository({ store }); const b = createGuideRepository({ store });
    const left = await a.create(createEmptyDocument()); const right = await b.create(createEmptyDocument("board"));
    if (!left.ok || !right.ok) throw new Error("fixture create failed");
    left.record.document.meta.title = "A"; right.record.document.meta.title = "B";
    expect((await Promise.all([a.save(left.record.id, 1, left.record.document), b.save(right.record.id, 1, right.record.document)]))
      .every((result) => result.ok)).toBe(true);
    const other = await b.load(left.record.id); if (!other) throw new Error("fixture load failed");
    const winner = await a.save(left.record.id, 2, { ...left.record.document, meta: { ...left.record.document.meta, title: "Winner" } });
    expect(winner.ok).toBe(true);
    expect(await b.save(other.id, 2, other.document)).toEqual({ ok: false, reason: "conflict" });
  });

  it("tombstoneBlocksStaleResurrection", async () => {
    const { store } = memoryStore(); const a = createGuideRepository({ store }); const b = createGuideRepository({ store });
    const made = await a.create(createEmptyDocument()); if (!made.ok) throw new Error("fixture create failed");
    await b.load(made.record.id);
    const removed = await a.remove(made.record.id, 1); expect(removed).toMatchObject({ ok: true, record: { revision: 2, deletedAt: expect.any(String) } });
    expect(await b.save(made.record.id, 1, made.record.document)).toEqual({ ok: false, reason: "deleted" });
    expect(await a.list()).toEqual([]);
    expect(await a.restore(made.record.id, 1)).toEqual({ ok: false, reason: "conflict" });
    expect(await a.restore(made.record.id, 2)).toMatchObject({ ok: true, record: { revision: 3 } });
    expect(await a.list()).toHaveLength(1);
  });

  it("malformedGuideDoesNotHideOthers", async () => {
    const { state, store } = memoryStore(); const notices: unknown[] = [];
    const repository = createGuideRepository({ store, onNotice: (notice) => notices.push(notice) });
    const made = await repository.create(createEmptyDocument()); if (!made.ok) throw new Error("fixture create failed");
    const bad = { id: "broken", revision: "not numeric", document: { future: "preserve" } };
    state.records.set(GUIDE_PREFIX + "broken", bad);
    expect(await repository.list()).toHaveLength(1);
    expect(state.records.get(GUIDE_PREFIX + "broken")).toEqual(bad);
    expect(notices).toMatchObject([{ code: "guide-recovered", guideId: "broken" }]);
    expect([...state.records].find(([key]) => key.startsWith("instruction-builder:recovery:"))?.[1]).toEqual(bad);
  });

  it("duplicate clones committed content with fresh envelope and caller-supplied title", async () => {
    const { store } = memoryStore(); const repository = createGuideRepository({ store });
    const doc = createEmptyDocument("board"); doc.steps[0].tokens = [{ id: "scoped-id", iconId: "onion", category: "object" }];
    const made = await repository.create(doc); if (!made.ok) throw new Error("fixture create failed");
    const copy = await repository.duplicate(made.record.id, "Guide (Kopie)"); if (!copy.ok) throw new Error("copy failed");
    expect(copy.record.id).not.toBe(made.record.id); expect(copy.record.revision).toBe(1);
    expect(copy.record.document.meta.presentation).toBe("board"); expect(copy.record.document.meta.title).toBe("Guide (Kopie)");
    expect(copy.record.document.steps[0].tokens[0].id).toBe("scoped-id");
    expect(made.record.document.meta.title).toBe(doc.meta.title);
  });

  it("lists newest updates first, uses ids for ties, and advances only committed writes", async () => {
    const { store, state } = memoryStore(); const ids = ["b", "a"]; let time = "2026-10-06T01:00:00Z";
    const repository = createGuideRepository({ store, newId: () => ids.shift()!, now: () => time });
    const b = await repository.create(createEmptyDocument()); const a = await repository.create(createEmptyDocument());
    if (!b.ok || !a.ok) throw new Error("fixture create failed");
    expect((await repository.list()).map((record) => record.id)).toEqual(["a", "b"]);
    time = "2026-10-06T02:00:00Z"; state.failCommit = true;
    expect(await repository.save(b.record.id, 1, b.record.document)).toEqual({ ok: false, reason: "unavailable" });
    state.failCommit = false;
    expect(await repository.save(b.record.id, 1, b.record.document)).toMatchObject({ ok: true, record: { revision: 2 } });
    expect((await repository.list()).map((record) => record.id)).toEqual(["b", "a"]);
  });
});
