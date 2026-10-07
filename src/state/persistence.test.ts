import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// IndexedDB is the external boundary. The adapter preserves structured cloning
// and serial read/write transactions; the signals, migration and autosave run
// unchanged. Browser integration separately exercises real IndexedDB.
const storage = vi.hoisted(() => ({
  records: new Map<string, unknown>(),
  transaction: Promise.resolve(),
  pauseWrite: undefined as Promise<void> | undefined,
  failRecovery: false,
}));

vi.mock("idb-keyval", () => ({
  get: async (key: string) => structuredClone(storage.records.get(key)),
  set: async (key: string, value: unknown) => {
    if (storage.failRecovery && key.startsWith("instruction-builder:recovery:")) {
      throw new Error("Recovery write failed");
    }
    await storage.pauseWrite;
    storage.records.set(key, structuredClone(value));
  },
  update: (key: string, updater: (current: unknown) => unknown) => {
    const transaction = storage.transaction.then(async () => {
      await storage.pauseWrite;
      const next = updater(structuredClone(storage.records.get(key)));
      storage.records.set(key, structuredClone(next));
    });
    storage.transaction = transaction.catch(() => undefined);
    return transaction;
  },
}));

const STORAGE_KEY = "instruction-builder:document";
const savedDocument = {
  schemaVersion: 1,
  meta: { title: "Original", domain: "general", createdAt: "2026-10-06T00:00:00Z" },
  steps: [{ id: "step-1", tokens: [] }],
};

async function bootTab() {
  vi.resetModules();
  const window = Object.assign(new EventTarget(), { document: { visibilityState: "visible" } });
  vi.stubGlobal("window", window);
  const persistence = await import("./persistence");
  const state = await import("./document");
  await persistence.initPersistence();
  return { ...persistence, ...state, window };
}

async function autosave() {
  await vi.advanceTimersByTimeAsync(250);
}

describe("document autosave safety", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storage.records.clear();
    storage.records.set(STORAGE_KEY, structuredClone(savedDocument));
    storage.transaction = Promise.resolve();
    storage.pauseWrite = undefined;
    storage.failRecovery = false;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("stops the legacy observer and lifecycle flush before guide initialization", async () => {
    const tab = await bootTab();
    tab.updateTitle("Pending legacy edit");
    await tab.stopLegacyPersistence();
    tab.updateTitle("New guide edit");
    tab.window.dispatchEvent(new Event("pagehide")); await autosave();
    expect(storage.records.get(STORAGE_KEY)).toMatchObject({ meta: { title: "Pending legacy edit" } });
    await tab.initPersistence(); tab.updateTitle("Still new"); await autosave();
    expect(storage.records.get(STORAGE_KEY)).toMatchObject({ meta: { title: "Pending legacy edit" } });
  });

  it("waits for an already running legacy transaction before stopping", async () => {
    const tab = await bootTab(); let release!: () => void;
    storage.pauseWrite = new Promise<void>((resolve) => { release = resolve; });
    tab.updateTitle("In flight legacy"); await autosave();
    let stopped = false; const stopping = tab.stopLegacyPersistence().then(() => { stopped = true; });
    await Promise.resolve(); expect(stopped).toBe(false);
    release(); await stopping;
    expect(storage.records.get(STORAGE_KEY)).toMatchObject({ meta: { title: "In flight legacy" } });
    tab.updateTitle("New guide edit"); await autosave();
    expect(storage.records.get(STORAGE_KEY)).toMatchObject({ meta: { title: "In flight legacy" } });
  });

  it("does not rewrite a loaded document before the first edit", async () => {
    const tab = await bootTab();
    storage.records.set(STORAGE_KEY, { ...savedDocument, meta: { ...savedDocument.meta, title: "Newer" } });
    await autosave();
    expect(storage.records.get(STORAGE_KEY)).toMatchObject({ meta: { title: "Newer" } });
    expect(tab.persistenceStatus.value).toBe("available");
  });

  it("leaves newer storage and unsaved local edits intact when a stale tab saves", async () => {
    const tabA = await bootTab();
    const staleTab = await bootTab();
    tabA.updateTitle("Saved by tab A");
    await autosave();
    staleTab.updateStepTitle("step-1", "Local edit in stale tab");
    await autosave();

    expect(storage.records.get(STORAGE_KEY)).toMatchObject({
      meta: { title: "Saved by tab A" }, steps: [{ id: "step-1", tokens: [] }],
    });
    expect(staleTab.document.value.steps[0].title).toBe("Local edit in stale tab");
    expect(staleTab.persistenceStatus.value).toBe("conflict");

    staleTab.updateTitle("More local work");
    staleTab.window.dispatchEvent(new Event("pagehide"));
    await autosave();
    expect(storage.records.get(STORAGE_KEY)).toMatchObject({ meta: { title: "Saved by tab A" } });
    expect(staleTab.document.value.meta.title).toBe("More local work");
    expect(staleTab.persistenceStatus.value).toBe("conflict");
  });

  it("serializes overlapping flushes without treating its own previous save as a conflict", async () => {
    const tab = await bootTab();
    let release!: () => void;
    storage.pauseWrite = new Promise<void>((resolve) => { release = resolve; });
    tab.updateTitle("First edit");
    tab.window.dispatchEvent(new Event("pagehide"));
    tab.updateTitle("Newest edit");
    tab.window.dispatchEvent(new Event("pagehide"));
    storage.pauseWrite = undefined;
    release();
    await autosave();

    expect(storage.records.get(STORAGE_KEY)).toMatchObject({ meta: { title: "Newest edit" } });
    expect(tab.persistenceStatus.value).toBe("available");
  });

  it("allows only one simultaneous tab write against the same saved snapshot", async () => {
    const tabA = await bootTab();
    const tabB = await bootTab();
    tabA.updateTitle("Tab A");
    tabB.updateTitle("Tab B");
    tabA.window.dispatchEvent(new Event("pagehide"));
    tabB.window.dispatchEvent(new Event("pagehide"));
    await autosave();

    expect(storage.records.get(STORAGE_KEY)).toMatchObject({ meta: { title: "Tab A" } });
    expect(tabA.persistenceStatus.value).toBe("available");
    expect(tabB.persistenceStatus.value).toBe("conflict");
    expect(tabB.document.value.meta.title).toBe("Tab B");
  });

  it("protects the first saved document when two tabs started without a record", async () => {
    storage.records.delete(STORAGE_KEY);
    const tabA = await bootTab();
    const tabB = await bootTab();
    await autosave();
    expect(storage.records.has(STORAGE_KEY)).toBe(false);
    tabA.updateTitle("First saved document");
    await autosave();
    tabB.updateTitle("Unsaved second tab");
    await autosave();

    expect(storage.records.get(STORAGE_KEY)).toMatchObject({ meta: { title: "First saved document" } });
    expect(tabB.persistenceStatus.value).toBe("conflict");
    expect(tabB.document.value.meta.title).toBe("Unsaved second tab");
  });

  it("backs up an unreadable record before allowing an edited fallback to replace it", async () => {
    const unreadable = { schemaVersion: 99, futureContent: ["recover this exact record"] };
    storage.records.set(STORAGE_KEY, unreadable);
    const tab = await bootTab();
    await autosave();
    expect(storage.records.get(STORAGE_KEY)).toEqual(unreadable);

    tab.updateTitle("Edited fallback");
    await autosave();
    expect(storage.records.get(STORAGE_KEY)).toMatchObject({ meta: { title: "Edited fallback" } });
    const backups = [...storage.records.entries()].filter(([key]) => key.startsWith("instruction-builder:recovery:"));
    expect(backups).toHaveLength(1);
    expect(backups[0][1]).toEqual(unreadable);
  });

  it("disables saves when preserving an unreadable record fails", async () => {
    const unreadable = { schemaVersion: 99, futureContent: "do not overwrite" };
    storage.records.set(STORAGE_KEY, unreadable);
    storage.failRecovery = true;
    const tab = await bootTab();
    tab.updateTitle("Local work");
    await autosave();

    expect(storage.records.get(STORAGE_KEY)).toEqual(unreadable);
    expect(tab.persistenceStatus.value).toBe("unavailable");
  });

  it("preserves a non-JSON unreadable record and disables unsafe autosaves", async () => {
    const unreadable: Record<string, unknown> = { schemaVersion: 99 };
    unreadable.cycle = unreadable;
    storage.records.set(STORAGE_KEY, unreadable);
    const tab = await bootTab();
    tab.updateTitle("Local work");
    await autosave();

    expect(storage.records.get(STORAGE_KEY)).toEqual(unreadable);
    const backups = [...storage.records.entries()].filter(([key]) => key.startsWith("instruction-builder:recovery:"));
    expect(backups).toHaveLength(1);
    expect(backups[0][1]).toEqual(unreadable);
    expect(tab.persistenceStatus.value).toBe("unavailable");
  });
});
