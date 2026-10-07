import { ICON_VIEW_BOX, ICON_PRESENTATION_PROPS } from "../../data/icon-library";
import { resolveIcon } from "../../lib/library-catalog";

interface IconProps {
  iconId: string;
  size?: number;
  class?: string;
}

/**
 * Renders a bundled icon (data/icon-library.ts) as a standalone inline
 * <svg>, for plain-HTML contexts (TokenPicker, Step/Token details).
 * InstructionCanvas inlines the same markup directly as a <g> instead,
 * since it's already inside an <svg> document.
 *
 * Markup comes only from the original bundled SVG sources or the neutral
 * unknown tile. Imported document text never becomes SVG markup.
 */
export function Icon({ iconId, size = 20, class: className }: IconProps) {
  const { markup } = resolveIcon(iconId);
  return (
    <svg
      width={size}
      height={size}
      viewBox={ICON_VIEW_BOX}
      aria-hidden="true"
      class={className}
      {...ICON_PRESENTATION_PROPS}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
