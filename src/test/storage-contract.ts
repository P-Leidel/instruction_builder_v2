import type { StorageStore } from "../lib/storage";

type ContractCase = { name: string; run: (store: StorageStore, prefix: string) => Promise<void> };
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function equal(actual: unknown, expected: unknown) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}
async function rejects(operation: () => Promise<unknown>) {
  let rejected = false; try { await operation(); } catch { rejected = true; }
  assert(rejected, "Expected transaction rejection");
}

/** Plain TypeScript assertions run unchanged in Node/Vitest and native IndexedDB. */
export const storageContractCases: readonly ContractCase[] = [
  { name: "declared keys prefixes combined plans and duplicate keys", run: async (store, prefix) => {
    const keys = [prefix + "range:", prefix + "range:a", prefix + "range:\ufffftail", prefix + "rangf:", prefix + "other"];
    await store.transaction({}, tx => { for (const key of keys) tx.put(key, key); });
    equal(await store.transaction({ keys: [keys[1], keys[1]], mode: "readonly" }, tx => tx.entries().map(([key]) => key)), [keys[1]]);
    equal(await store.transaction({ keys: [keys[4]], prefix: prefix + "range:", mode: "readonly" }, tx => tx.entries().map(([key]) => key).sort()), [keys[4], ...keys.slice(0, 3)].sort());
    equal(await store.transaction({ prefix: prefix + "range:", mode: "readonly" }, tx => tx.entries().map(([key]) => key).sort()), keys.slice(0, 3).sort());
  } },
  { name: "present undefined values remain distinguishable from missing keys", run: async (store, prefix) => {
    await store.transaction({}, tx => tx.put(prefix + "present", undefined));
    equal(await store.transaction({ keys: [prefix + "present", prefix + "missing"], mode: "readonly" }, tx => [tx.get(prefix + "present"), tx.get(prefix + "missing"), tx.entries().map(([key]) => key)]), [undefined, undefined, [prefix + "present"]]);
  } },
  { name: "undeclared reads entries and readonly writes reject", run: async (store, prefix) => {
    await rejects(() => store.transaction({}, tx => tx.get(prefix)));
    await rejects(() => store.transaction({}, tx => tx.entries()));
    await rejects(() => store.transaction({ mode: "readonly" }, tx => tx.put(prefix, "bad")));
    await rejects(() => store.transaction({ mode: "readonly" }, tx => tx.add(prefix, "bad")));
    equal(await store.transaction({ keys: [prefix], mode: "readonly" }, tx => tx.get(prefix)), undefined);
  } },
  { name: "insert collisions roll back preceding writes", run: async (store, prefix) => {
    await store.transaction({}, tx => tx.put(prefix + "collision", "original"));
    await rejects(() => store.transaction({}, tx => { tx.put(prefix + "earlier", "rollback"); tx.add(prefix + "collision", "replacement"); }));
    equal(await store.transaction({ keys: [prefix + "earlier", prefix + "collision"], mode: "readonly" }, tx => [tx.get(prefix + "earlier"), tx.get(prefix + "collision")]), [undefined, "original"]);
  } },
  { name: "catching an insert collision cannot allow a transaction to commit", run: async (store, prefix) => {
    await store.transaction({}, tx => tx.put(prefix + "collision", "original"));
    await rejects(() => store.transaction({}, tx => {
      tx.put(prefix + "earlier", "rollback");
      try { tx.add(prefix + "collision", "replacement"); } catch { /* Native collisions arrive asynchronously. */ }
    }));
    equal(await store.transaction({ keys: [prefix + "earlier", prefix + "collision"], mode: "readonly" }, tx => [tx.get(prefix + "earlier"), tx.get(prefix + "collision")]), [undefined, "original"]);
  } },
  { name: "thrown policies and callable thenables roll back", run: async (store, prefix) => {
    await rejects(() => store.transaction({}, tx => { tx.put(prefix, "rollback"); throw new Error("policy failure"); }));
    await rejects(() => store.transaction({}, tx => { tx.put(prefix, "rollback"); return Promise.resolve("async policy"); }));
    equal(await store.transaction({ keys: [prefix], mode: "readonly" }, tx => tx.get(prefix)), undefined);
  } },
  { name: "noncallable then fields are ordinary stored data", run: async (store, prefix) => {
    await store.transaction({}, tx => tx.put(prefix, { then: "future", retained: true }));
    equal(await store.transaction({ keys: [prefix], mode: "readonly" }, tx => tx.get(prefix)), { then: "future", retained: true });
  } },
  { name: "declared read views observe writes but unrelated writes remain undeclared", run: async (store, prefix) => {
    await store.transaction({ keys: [prefix] }, tx => {
      tx.put(prefix, "first"); equal(tx.get(prefix), "first");
      tx.put(prefix, "second"); equal(tx.entries(), [[prefix, "second"]]);
      tx.put(prefix + "unrelated", "written"); equal(tx.entries(), [[prefix, "second"]]);
    });
    equal(await store.transaction({ keys: [prefix, prefix + "unrelated"], mode: "readonly" }, tx => [tx.get(prefix), tx.get(prefix + "unrelated")]), ["second", "written"]);
  } },
  { name: "mutating a get result without put does not persist", run: async (store, prefix) => {
    await store.transaction({}, tx => tx.put(prefix, { retained: 1 }));
    for (const mode of ["readonly", "readwrite"] as const) {
      await store.transaction({ keys: [prefix], mode }, tx => { (tx.get(prefix) as { retained: number }).retained = 2; });
      equal(await store.transaction({ keys: [prefix], mode: "readonly" }, tx => tx.get(prefix)), { retained: 1 });
    }
  } },
  { name: "request clones persist while cached reads retain input and get mutations", run: async (store, prefix) => {
    const input = { values: [1] };
    await store.transaction({ keys: [prefix, prefix + "added"] }, tx => {
      tx.put(prefix, input); input.values.push(2);
      assert(tx.get(prefix) === input, "Put must cache the supplied read-view object");
      (tx.get(prefix) as typeof input).values.push(3); equal(tx.get(prefix), { values: [1, 2, 3] });
      const added = { values: [4] }; tx.add(prefix + "added", added); added.values.push(5);
      assert(tx.get(prefix + "added") === added, "Add must cache the supplied read-view object");
    });
    equal(await store.transaction({ keys: [prefix, prefix + "added"], mode: "readonly" }, tx => [tx.get(prefix), tx.get(prefix + "added")]), [{ values: [1] }, { values: [4] }]);
  } },
  { name: "structured clone graphs retain cycles collections dates and binary views", run: async (store, prefix) => {
    const raw: { cycle?: unknown; map: Map<string, Set<string>>; date: Date; bytes: Uint8Array; buffer: ArrayBuffer } = { map: new Map([["key", new Set(["exact"])]]), date: new Date("2026-10-07T00:00:00Z"), bytes: new Uint8Array([0, 255]), buffer: new Uint8Array([3, 4]).buffer };
    raw.cycle = raw;
    await store.transaction({}, tx => tx.put(prefix, raw));
    const copy = await store.transaction({ keys: [prefix], mode: "readonly" }, tx => tx.get(prefix)) as typeof raw;
    assert(copy !== raw && copy.cycle === copy, "Clone identity or cycle lost");
    assert(copy.map instanceof Map && copy.map.get("key") instanceof Set && copy.date instanceof Date && copy.bytes instanceof Uint8Array && copy.buffer instanceof ArrayBuffer, "Clone types lost");
    equal([...copy.map.get("key")!], ["exact"]); equal(copy.date.toISOString(), raw.date.toISOString()); equal([...copy.bytes], [0, 255]); equal([...new Uint8Array(copy.buffer)], [3, 4]);
  } },
  { name: "rejected transactions do not block queued commits or returned results", run: async (store, prefix) => {
    const failure = store.transaction({}, tx => { tx.put(prefix, "rollback"); throw new Error("failure"); });
    const committed = store.transaction({}, tx => { tx.put(prefix, "committed"); return "result"; });
    await rejects(() => failure); equal(await committed, "result");
    equal(await store.transaction({ keys: [prefix], mode: "readonly" }, tx => tx.get(prefix)), "committed");
  } },
];

export async function runStorageContract(createStore: () => StorageStore) {
  const results: Record<string, true | string> = {};
  const prefix = `storage-contract:${crypto.randomUUID()}:`;
  for (const [index, test] of storageContractCases.entries()) {
    try { await test.run(createStore(), `${prefix}${index}:`); results[test.name] = true; }
    catch (error) { results[test.name] = String(error); }
  }
  return results;
}
