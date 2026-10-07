import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { MmBox, OutputPlan, PreparedFonts } from "../../model/output";
import type { ReadingGroup } from "../../lib/instruction-reading";
import { ReadingContent } from "../InstructionReader/InstructionReader";
import { renderOutputPage } from "../../lib/output-svg";
import { t } from "../../i18n/messages";
import "./output-preview.css";

interface OutputPreviewProps { plan: OutputPlan; fonts: PreparedFonts; readingGroups: readonly ReadingGroup[]; contentRegions: readonly MmBox[]; onError: (error: unknown) => void }
export function OutputPreview({ plan, fonts, readingGroups, contentRegions, onError }: OutputPreviewProps) {
  const [selectedPage, setSelectedPage] = useState(0), [zoom, setZoom] = useState(100), [bounds, setBounds] = useState(false);
  const visual = useRef<HTMLDivElement>(null), index = Math.min(selectedPage, plan.pages.length - 1), page = plan.pages[index], locale = plan.options.locale;
  const paddingMm = Math.min(...contentRegions.flatMap(region => [region.xMm, region.yMm, page.size.widthMm - region.xMm - region.widthMm, page.size.heightMm - region.yMm - region.heightMm]));
  useLayoutEffect(() => {
    try { const svg = renderOutputPage(page, fonts); svg.setAttribute("aria-hidden", "true"); visual.current?.replaceChildren(svg); }
    catch (error) { visual.current?.replaceChildren(); onError(error); }
  }, [page, fonts, onError]);
  return <section class="output-preview" aria-label={t(locale, "output.preview")}>
    <h3>{t(locale, "output.preview")}</h3><p>{t(locale, "output.dimensions", { width: page.size.widthMm, height: page.size.heightMm })}</p>
    <p>{t(locale, "output.page", { number: index + 1, total: plan.pages.length })} · {t(locale, `output.${plan.options.mode}`)} · {t(locale, `output.${plan.options.background}`)}</p>
    <div class="output-preview__controls"><button type="button" disabled={index === 0} onClick={() => setSelectedPage(index - 1)}>{t(locale, "output.previousPage")}</button><button type="button" disabled={index === plan.pages.length - 1} onClick={() => setSelectedPage(index + 1)}>{t(locale, "output.nextPage")}</button>
      <label>{t(locale, "output.zoom")}<select aria-label={t(locale, "output.zoom")} value={zoom} onChange={event => setZoom(Number(event.currentTarget.value))}>{[25, 50, 75, 100, 125, 150, 200].map(value => <option value={value}>{value}%</option>)}</select></label>
    </div><label class="output-dialog__check"><input type="checkbox" checked={bounds} onChange={event => setBounds(event.currentTarget.checked)} />{t(locale, "output.contentBounds")}</label>
    <p>{t(locale, "output.previewHelp")}</p>
    {Number.isFinite(paddingMm) && <p class="output-preview__padding">{t(locale, "output.paperPadding", { padding: Math.floor(paddingMm * 10 + 1e-7) / 10 })}</p>}
    <div class="output-preview__viewport" aria-hidden="true"><div class="output-preview__page" style={{ width: `${zoom}%` }}><div ref={visual} class="output-preview__image" />{bounds && contentRegions.map((region, ordinal) => <div key={ordinal} class="output-preview__bounds" style={{ left: `${region.xMm / page.size.widthMm * 100}%`, top: `${region.yMm / page.size.heightMm * 100}%`, width: `${region.widthMm / page.size.widthMm * 100}%`, height: `${region.heightMm / page.size.heightMm * 100}%` }} />)}</div></div>
    <details class="output-preview__semantic"><summary>{t(locale, "output.semanticContent")}</summary><ReadingContent groups={readingGroups} presentation={plan.presentation} locale={locale} /></details>
  </section>;
}
