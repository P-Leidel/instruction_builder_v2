export function DragHandleIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="currentColor">{[5, 12, 19].map(y => <g key={y}><circle cx="8" cy={y} r="1.6" /><circle cx="16" cy={y} r="1.6" /></g>)}</svg>;
}
