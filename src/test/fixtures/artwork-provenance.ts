import type { CatalogEntry } from "../../model/library";
import { CATALOG_ENTRIES } from "../../data/catalog-entries";

/** Provenance evidence used by the catalog/artwork coverage tests. */

export interface ArtworkProvenance {
  id: string;
  iconIds: readonly string[];
  sourceFilePaths: readonly string[];
  creator: string;
  origin: string;
  createdAt: string;
  licenseIdentifier: string;
  licenseTextPath: string;
  reviewStatus: "structurally-checked-recipient-review-pending";
}

export const ARTWORK_PROVENANCE: readonly ArtworkProvenance[] = Object.freeze([Object.freeze({
  id: "original-pictograms-2026-10-06",
  iconIds: Object.freeze(CATALOG_ENTRIES.map((entry: CatalogEntry) => entry.iconId)),
  sourceFilePaths: Object.freeze(CATALOG_ENTRIES.map((entry) => `src/assets/pictograms/${entry.iconId}.svg`)),
  creator: "OpenAI Codex agent, authored for this repository at the user's request",
  origin: "Original geometry authored in this implementation; no stock artwork traced, copied or incorporated",
  createdAt: "2026-10-06",
  licenseIdentifier: "LicenseRef-Original-Project-Work",
  licenseTextPath: "docs/artwork/LICENSE-STATUS.md",
  reviewStatus: "structurally-checked-recipient-review-pending" as const,
})]);
