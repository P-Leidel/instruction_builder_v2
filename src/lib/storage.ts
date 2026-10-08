import { createStore } from "idb-keyval";
export interface StorageTransaction {
  get(key: string): unknown;
  put(key: string, value: unknown): void;
  add(key: string, value: unknown): void;
  entries(): [string, unknown][];
}
export interface StorageReadPlan {
  keys?: readonly string[];
  prefix?: string;
  mode?: "readonly" | "readwrite";
}
export interface StorageStore { transaction<T>(plan: StorageReadPlan, operation: (transaction: StorageTransaction) => T): Promise<T> }
/** A synchronous policy callback runs inside one real IndexedDB transaction. */
export function createIndexedDbStorage(): StorageStore {
  const useStore = createStore("keyval-store", "keyval");
  return { transaction: (plan, operation) => useStore(plan.mode ?? "readwrite", (store) => new Promise((resolve, reject) => {
    const transaction = store.transaction;
    let result: ReturnType<typeof operation>;
    let policyError: unknown;
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(policyError ?? transaction.error ?? new Error("Storage transaction aborted"));
    const keys = new Set(plan.keys ?? []);
    const records = new Map<string, unknown>();
    const declared = (key: string) => keys.has(key) || (plan.prefix !== undefined && key.startsWith(plan.prefix));
    let pending = keys.size + (plan.prefix === undefined ? 0 : 1);
    const abort = (error: unknown) => { policyError = error; transaction.abort(); };
    const apply = () => {
      try {
        result = operation({
          get: (key) => { if (!declared(key)) throw new Error(`Undeclared guide read: ${key}`); return records.get(key); },
          entries: () => { if (keys.size === 0 && plan.prefix === undefined) throw new Error("Undeclared guide entries read"); return [...records]; },
          put: (key, value) => { store.put(value, key); if (declared(key)) records.set(key, value); },
          add: (key, value) => { store.add(value, key); if (declared(key)) records.set(key, value); },
        });
        if (result !== null && (typeof result === "object" || typeof result === "function") && typeof (result as { then?: unknown }).then === "function") {
          throw new Error("Guide transaction policy must be synchronous");
        }
      } catch (error) { abort(error); }
    };
    const ready = () => { if (--pending === 0) apply(); };
    try {
      for (const key of keys) {
        const request = store.get(key);
        request.onsuccess = () => {
          if (request.result !== undefined) { records.set(key, request.result); ready(); return; }
          // get alone cannot distinguish a missing key from stored undefined.
          // Keep present malformed values available to recovery policy.
          const exists = store.getKey(key);
          exists.onsuccess = () => { if (exists.result !== undefined) records.set(key, undefined); ready(); };
        };
      }
      if (plan.prefix !== undefined) {
        const prefix = plan.prefix;
        // Increment the rightmost non-FFFF code unit, excluding that successor.
        // Appending FFFF would omit valid suffixes beginning with FFFF.
        let index = prefix.length - 1;
        while (index >= 0 && prefix.charCodeAt(index) === 0xffff) index--;
        const successor = index < 0 ? undefined : prefix.slice(0, index) + String.fromCharCode(prefix.charCodeAt(index) + 1);
        const range = successor === undefined ? IDBKeyRange.lowerBound(prefix) : IDBKeyRange.bound(prefix, successor, false, true);
        const request = store.openCursor(range);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor || typeof cursor.key !== "string" || !cursor.key.startsWith(prefix)) { ready(); return; }
          records.set(cursor.key, cursor.value); cursor.continue();
        };
      }
      if (pending === 0) apply();
    } catch (error) { abort(error); }
  })) };
}

/** Comparable clone graphs include cycles/binary data; opaque clone types deliberately never compare equal. */
export function rawFingerprint(value: unknown): string {
  const seen = new Map<object, number>();
  function visit(entry: unknown): unknown {
    if (entry === null || typeof entry !== "object") {
      return [typeof entry, typeof entry === "number" && Object.is(entry, -0) ? "-0" : String(entry)];
    }
    const existing = seen.get(entry); if (existing !== undefined) return ["ref", existing];
    const id = seen.size; seen.set(entry, id);
    if (entry instanceof Date) return [id, "Date", entry.getTime()];
    if (entry instanceof Map) return [id, "Map", [...entry].map(([key, item]) => [visit(key), visit(item)])];
    if (entry instanceof Set) return [id, "Set", [...entry].map(visit)];
    if (entry instanceof RegExp) return [id, "RegExp", entry.source, entry.flags];
    if (entry instanceof ArrayBuffer || ArrayBuffer.isView(entry)) {
      const bytes = entry instanceof ArrayBuffer ? new Uint8Array(entry) : new Uint8Array(entry.buffer, entry.byteOffset, entry.byteLength);
      return [id, Object.prototype.toString.call(entry), [...bytes]];
    }
    const prototype = Object.getPrototypeOf(entry);
    if (!Array.isArray(entry) && prototype !== Object.prototype && prototype !== null) {
      // Blob/File/Error and other opaque values cannot be compared synchronously
      // inside an IndexedDB transaction. Preserve them and conservatively conflict.
      return [id, "opaque", Object.prototype.toString.call(entry), crypto.randomUUID()];
    }
    return [id, Array.isArray(entry) ? ["Array", entry.length] : "Object",
      Object.keys(entry).sort().map((key) => [key, visit((entry as Record<string, unknown>)[key])])];
  }
  return JSON.stringify(visit(value));
}

export const RECOVERY_PREFIX = "instruction-builder:recovery:";
/** Retain the raw clone graph using an insert-only write in the caller's transaction. */
export function copyRecovery(transaction: StorageTransaction, raw: unknown, identity: { now: () => string; newId: () => string }): string {
  const recoveryKey = `${RECOVERY_PREFIX}${identity.now()}:${identity.newId()}`;
  transaction.add(recoveryKey, raw);
  return recoveryKey;
}