import type { AppLocale, CatalogEntry } from "./library";

export type PictureRef = { stepId: string; tokenId: string };
export type PicturePlacement =
  | { stepId: string; kind: "append" | "empty" }
  | { stepId: string; kind: "final-index"; index: number }
  | { stepId: string; kind: "anchor"; anchorId: string; edge: "before" | "after" };
export type GroupPlacement = { anchorId: string; edge: "before" | "after" };
export type PictureCommand =
  | { kind: "insert"; entry: CatalogEntry; locale: AppLocale; destination: PicturePlacement }
  | { kind: "move"; source: PictureRef; destination: PicturePlacement }
  | { kind: "duplicate"; source: PictureRef }
  | { kind: "copy"; source: PictureRef }
  | { kind: "paste"; destination: PicturePlacement };
export type PictureCommandResult =
  | { status: "changed"; stepId: string; tokenId: string }
  | { status: "copied" | "unchanged" }
  | { status: "rejected"; reason: "source-missing" | "target-missing" | "clipboard-empty" };
export type PictureFollowUp = { panel: "preserve" | "close" };
export type EditorDragSource =
  | { kind: "picture"; groupId: string; tokenId: string }
  | { kind: "group"; groupId: string }
  | { kind: "library"; entry: CatalogEntry };
export type GroupMoveCommand = { kind: "move-group"; sourceStepId: string; destination: GroupPlacement };
export type EditorDropCommand = PictureCommand | GroupMoveCommand;
