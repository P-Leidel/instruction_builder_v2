import type { AppLocale } from "../model/library";
import type { OutputIssue, OutputNotice } from "../model/output";
import { t } from "../i18n/messages";

export function issueText(issue: OutputIssue, locale: AppLocale): string {
  if (issue.messageKey === "output.cellOverflow") {
    const fields = { label: "editor.pictureLabel", note: "editor.note", quantity: "quantity.title", warning: "warning.title", time: "time.title", heading: issue.source?.stepId ? "editor.groupTitle" : "editor.documentTitle", description: "editor.description", context: "output.notices" } as const;
    const field = String(issue.params?.field ?? "");
    return t(locale, "output.cellOverflow", { group: String(issue.params?.group ?? ""), format: String(issue.params?.format ?? ""), field: Object.hasOwn(fields, field) ? t(locale, fields[field as keyof typeof fields]) : field, content: String(issue.params?.content ?? "") });
  }
  switch (issue.code) {
    case "overflow": return t(locale, "output.overflow", { group: String(issue.params?.group ?? t(locale, "output.groupContext")), format: String(issue.params?.format ?? t(locale, "output.custom")) });
    case "unsupported-glyph": return t(locale, "output.unsupportedGlyph", { content: String(issue.params?.content ?? ""), codePoints: String(issue.params?.codePoints ?? "") });
    case "font-unavailable": return t(locale, "output.fontUnavailable");
    case "raster-limit": return t(locale, "output.rasterLimit");
    case "empty-selection": return t(locale, "output.emptySelection");
    case "invalid-options": return t(locale, "output.invalidOptions");
  }
}

export function noticeText(notice: OutputNotice, locale: AppLocale): string {
  return t(locale, notice.code === "empty-group" ? "output.emptyGroup" : "output.unknownSymbolNotice");
}
