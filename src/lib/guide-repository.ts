import { createIndexedDbStorage, rawFingerprint, copyRecovery, RECOVERY_PREFIX, type StorageStore, type StorageReadPlan, type StorageTransaction } from "./storage";
import type { GuideRecord, GuideRepository, GuideWriteResult } from "../model/guide";
import type { InstructionDocument } from "../model/instruction";
import { migrate } from "../model/migrate";
export const GUIDE_PREFIX = "instruction-builder:guide:";
export const LEGACY_KEY = "instruction-builder:document";
export const MIGRATION_KEY = "instruction-builder:guides-migration:v1";
export interface GuideNotice {
  code: "legacy-changed" | "legacy-recovered" | "guide-recovered";
  sourceKey: string;
  recoveryKey: string;
  guideId?: string;
}
export interface GuideRepositoryOptions {
  store?: StorageStore;
  now?: () => string;
  newId?: () => string;
  onNotice?: (notice: GuideNotice) => void;
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRecord(value: unknown, id: string): GuideRecord {
  if (!object(value) || value.id !== id || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1 ||
      typeof value.createdAt !== "string" || typeof value.updatedAt !== "string" ||
      (value.deletedAt !== undefined && typeof value.deletedAt !== "string")) throw new Error("Invalid guide envelope");
  return { ...value, document: migrate(value.document) } as unknown as GuideRecord;
}

export function createGuideRepository(options: GuideRepositoryOptions = {}): GuideRepository {
  const store = options.store ?? createIndexedDbStorage();
  const now = options.now ?? (() => new Date().toISOString());
  const newId = options.newId ?? (() => crypto.randomUUID());
  const baselines = new Map<string, Map<number, string>>();
  const recovered = new Set<string>();
  let initialization: Promise<void> | undefined;
  function remember(raw: unknown, record: GuideRecord, replace = false) {
    const versions = baselines.get(record.id) ?? new Map<number, string>();
    if (replace || !versions.has(record.revision)) versions.set(record.revision, rawFingerprint(raw));
    baselines.set(record.id, versions);
  }
  function backup(transaction: StorageTransaction, raw: unknown, sourceKey: string, code: GuideNotice["code"], guideId?: string): GuideNotice {
    const recoveryKey = copyRecovery(transaction, raw, { now, newId });
    return { code, sourceKey, recoveryKey, ...(guideId === undefined ? {} : { guideId }) };
  }
  function newRecord(transaction: StorageTransaction, doc: InstructionDocument): GuideRecord {
    const id = newId();
    const time = now();
    const record = { id, revision: 1, document: structuredClone(migrate(doc)), createdAt: time, updatedAt: time };
    transaction.add(GUIDE_PREFIX + id, record); return record;
  }
  async function initialize() {
    initialization ??= store.transaction({ keys: [LEGACY_KEY, MIGRATION_KEY] }, (transaction) => {
      const raw = transaction.get(LEGACY_KEY); const marker = transaction.get(MIGRATION_KEY);
      const notices: GuideNotice[] = [];
      if (raw === undefined) return notices;
      const fingerprint = rawFingerprint(raw);
      if (marker !== undefined) {
        if (!object(marker) || typeof marker.guideId !== "string" || typeof marker.fingerprint !== "string") {
          throw new Error("Invalid legacy migration marker; original data retained");
        }
        if (marker.fingerprint !== fingerprint) notices.push(backup(transaction, raw, LEGACY_KEY, "legacy-changed", marker.guideId));
      } else {
        let document: InstructionDocument;
        try { document = migrate(raw); } catch {
          notices.push(backup(transaction, raw, LEGACY_KEY, "legacy-recovered")); return notices;
        }
        const record = newRecord(transaction, document);
        transaction.put(MIGRATION_KEY, { guideId: record.id, fingerprint });
      }
      return notices;
    }).catch((error: unknown) => {
        // A failed transaction committed neither migration nor recovery data.
        // Allow a later explicit startup retry to attempt the same policy again.
        initialization = undefined; throw error;
      }).then((notices) => { for (const notice of notices) options.onNotice?.(notice); });
    await initialization;
  }
  async function loadRecords(id?: string, refresh = false): Promise<GuideRecord[]> {
    await initialize();
    const result = await store.transaction(id === undefined ? { prefix: GUIDE_PREFIX } : { keys: [GUIDE_PREFIX + id] }, (transaction) => {
      const records: { raw: unknown; record: GuideRecord }[] = [];
      const notices: { notice: GuideNotice; fingerprint: string }[] = [];
      for (const [key, raw] of transaction.entries()) {
        if (!key.startsWith(GUIDE_PREFIX) || (id !== undefined && key !== GUIDE_PREFIX + id)) continue;
        const guideId = key.slice(GUIDE_PREFIX.length);
        let record: GuideRecord;
        try { record = validateRecord(raw, guideId); } catch {
          const fingerprint = `${key}:${rawFingerprint(raw)}`;
          if (!recovered.has(fingerprint)) notices.push({ notice: backup(transaction, raw, key, "guide-recovered", guideId), fingerprint });
          continue;
        }
        records.push({ raw, record: structuredClone(record) });
      }
      return { records, notices };
    });
    // Baselines/notices advance only after the transaction commits.
    for (const { notice, fingerprint } of result.notices) { recovered.add(fingerprint); options.onNotice?.(notice); }
    for (const { raw, record } of result.records) remember(raw, record, refresh);
    return result.records.map(({ record }) => record);
  }
  async function write(plan: StorageReadPlan, operation: (transaction: StorageTransaction) => GuideWriteResult): Promise<GuideWriteResult> {
    try {
      await initialize();
      const result = await store.transaction(plan, operation);
      if (result.ok) remember(result.record, result.record, true);
      return structuredClone(result);
    } catch { return { ok: false, reason: "unavailable" }; }
  }
  function mutate(id: string, revision: number, kind: "save" | "remove" | "restore", doc?: InstructionDocument) {
    return write({ keys: [GUIDE_PREFIX + id] }, (transaction) => {
      const raw = transaction.get(GUIDE_PREFIX + id);
      if (raw === undefined) return { ok: false, reason: "deleted" };
      let current: GuideRecord; try { current = validateRecord(raw, id); } catch { return { ok: false, reason: "unavailable" }; }
      if (current.deletedAt !== undefined && kind !== "restore") return { ok: false, reason: "deleted" };
      if (current.revision !== revision || rawFingerprint(raw) !== baselines.get(id)?.get(revision)) return { ok: false, reason: "conflict" };
      if (!Number.isSafeInteger(revision + 1)) return { ok: false, reason: "unavailable" };
      const time = now(); const next = { ...current, revision: revision + 1, updatedAt: time };
      if (kind === "save") next.document = structuredClone(migrate(doc));
      if (kind === "remove") next.deletedAt = time;
      if (kind === "restore") delete next.deletedAt;
      transaction.put(GUIDE_PREFIX + id, next); return { ok: true, record: next };
    });
  }
  return {
    loadRecoveredDocument: async (key) => {
      if (!key.startsWith(RECOVERY_PREFIX)) return undefined;
      // Recovery import is a bounded read, independent of startup migration.
      const raw = await store.transaction({ keys: [key], mode: "readonly" }, transaction => transaction.get(key));
      if (raw === undefined) return undefined;
      return migrate(typeof raw === "object" && raw !== null && "document" in raw ? raw.document : raw);
    },
    list: async () => (await loadRecords()).filter((record) => record.deletedAt === undefined)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
      .map((record) => ({ id: record.id, revision: record.revision, title: record.document.meta.title,
        presentation: record.document.meta.presentation, updatedAt: record.updatedAt })),
    // An explicit load is the repository's deliberate baseline adoption boundary.
    load: async (id) => (await loadRecords(id, true))[0],
    create: (doc) => write({}, (transaction) => ({ ok: true, record: newRecord(transaction, doc) })),
    save: (id, revision, doc) => mutate(id, revision, "save", doc),
    remove: (id, revision) => mutate(id, revision, "remove"),
    restore: (id, revision) => mutate(id, revision, "restore"),
    duplicate: (id, title) => write({ keys: [GUIDE_PREFIX + id] }, (transaction) => {
      const raw = transaction.get(GUIDE_PREFIX + id);
      if (raw === undefined) return { ok: false, reason: "deleted" };
      const record = validateRecord(raw, id);
      if (record.deletedAt !== undefined) return { ok: false, reason: "deleted" };
      return { ok: true, record: newRecord(transaction, { ...record.document, meta: { ...record.document.meta, title } }) };
    }),
  };
}
