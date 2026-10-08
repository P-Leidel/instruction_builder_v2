import type { EditorGroupPlacement, EditorLayout, MmBox } from "../model/output";

export function hasMinimumTargetSize(box: MmBox, scale: number): boolean {
  return box.widthMm * scale >= 44 && box.heightMm * scale >= 44;
}

export function canPlaceGroupControls(placement: EditorGroupPlacement, scale: number): boolean {
  return !placement.continued && !!placement.headingBox && hasMinimumTargetSize(placement.headingBox, scale) && placement.headingBox.widthMm * scale >= 280;
}

export function projectEditorControls(layout: EditorLayout | undefined, selectedStepIds: readonly string[], scale: number): { auxiliaryStepIds: readonly string[]; needsPictureList: boolean } {
  const groups = layout?.pages.flatMap(page => page.groups) ?? [];
  const inline = new Set(groups.filter(group => canPlaceGroupControls(group, scale)).map(group => group.stepId));
  return {
    auxiliaryStepIds: selectedStepIds.filter(id => !inline.has(id)),
    needsPictureList: !layout || groups.some(group => group.pictures.some(picture => !hasMinimumTargetSize(picture.cellBox, scale))),
  };
}
