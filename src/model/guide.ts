import type { InstructionDocument } from "./instruction";

export interface GuideRecord {
  id: string;
  revision: number;
  document: InstructionDocument;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface GuideSummary {
  id: string;
  revision: number;
  title: string;
  presentation: "sequence" | "board";
  updatedAt: string;
}

export type GuideWriteResult =
  | { ok: true; record: GuideRecord }
  | { ok: false; reason: "conflict" | "unavailable" | "deleted" };

export interface GuideRepository {
  list(): Promise<readonly GuideSummary[]>;
  load(id: string): Promise<GuideRecord | undefined>;
  create(doc: InstructionDocument): Promise<GuideWriteResult>;
  save(id: string, expectedRevision: number, doc: InstructionDocument): Promise<GuideWriteResult>;
  duplicate(id: string, title: string): Promise<GuideWriteResult>;
  remove(id: string, expectedRevision: number): Promise<GuideWriteResult>;
  restore(id: string, expectedRevision: number): Promise<GuideWriteResult>;
}
