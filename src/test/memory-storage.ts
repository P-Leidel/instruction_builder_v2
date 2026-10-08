import type { StorageReadPlan, StorageStore } from "../lib/storage";

export interface MemoryStorageOptions {
  records?: Map<string, unknown>;
  beforeTransaction?: (plan: StorageReadPlan) => void | Promise<void>;
  beforeGet?: (key: string) => void;
  beforeWrite?: (kind: "put" | "add", key: string, value: unknown) => void;
  beforeCommit?: () => void;
}

/** Shared fixture adapter; hooks retain each domain's failure and pause timing. */
export function createMemoryStorage(options: MemoryStorageOptions = {}) {
  const records = options.records ?? new Map<string, unknown>();
  let tail = Promise.resolve();
  const store: StorageStore = { transaction: (plan, operation) => {
    const apply = () => {
      const draft = structuredClone(records);
      const keys = new Set(plan.keys ?? []);
      const declared = (key: string) => keys.has(key) || (plan.prefix !== undefined && key.startsWith(plan.prefix));
      // Native requests clone into persistent storage at put/add time, while
      // declared reads retain their cached objects until this policy finishes.
      const readView = new Map<string, unknown>();
      for (const key of keys) if (draft.has(key)) readView.set(key, structuredClone(draft.get(key)));
      if (plan.prefix !== undefined) for (const key of [...draft.keys()].sort()) {
        if (key.startsWith(plan.prefix)) readView.set(key, structuredClone(draft.get(key)));
      }
      let requestError: Error | undefined;
      const write = (kind: "put" | "add", key: string, value: unknown) => {
        if (plan.mode === "readonly") throw new Error("readonly");
        options.beforeWrite?.(kind, key, value);
        const clone = structuredClone(value);
        // Native add collisions fail the pending request after the policy, so
        // catching inside that policy cannot prevent the transaction's abort.
        if (kind === "add" && draft.has(key)) requestError ??= new Error("insert collision");
        else draft.set(key, clone);
        if (declared(key)) readView.set(key, value);
      };
      const result = operation({
        get: (key) => { options.beforeGet?.(key); if (!declared(key)) throw new Error("undeclared read"); return readView.get(key); },
        entries: () => { if (plan.prefix === undefined && keys.size === 0) throw new Error("undeclared entries"); return [...readView]; },
        put: (key, value) => write("put", key, value),
        add: (key, value) => write("add", key, value),
      });
      if (result !== null && (typeof result === "object" || typeof result === "function") && typeof (result as { then?: unknown }).then === "function") {
        throw new Error("Storage transaction policy must be synchronous");
      }
      if (requestError) throw requestError;
      options.beforeCommit?.();
      records.clear(); for (const [key, value] of draft) records.set(key, value);
      return result;
    };
    const pending = tail.then(() => {
      const started = options.beforeTransaction?.(plan);
      return started ? started.then(apply) : apply();
    });
    tail = pending.then(() => undefined, () => undefined);
    return pending;
  } };
  return { records, store };
}
