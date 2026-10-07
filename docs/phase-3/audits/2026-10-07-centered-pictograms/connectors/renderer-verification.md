# Row connector renderer verification

The shared SVG display list now accepts optional connector `via` points. It
draws the complete routed line with round joins, uses the final nonzero segment
for arrow direction, and checks every route point and arrowhead corner against
the page bounds with the existing 0.1 mm stroke padding.

`rowConnectorPoints(previous, current)` takes the actual two cell boxes. It
leaves the previous cell's bottom center, travels through the middle of the
inter-row gap, and enters the current cell's top center. This does not alter
fixed cells, row pitch, or continuation segmentation. The planner callsite is
integrated separately in this same task.

## Focused test evidence

- RED: `npm test -- src/lib/output-svg.test.ts`, 2026-10-07 12:35:56 local.
  Five tests ran: three passed and two failed as expected. The route test
  received a diagonal directly between its endpoints instead of the two
  orthogonal waypoints. The waypoint bounds test received no exception for
  a clipped route point.
- GREEN: `npm test -- src/lib/output-svg.test.ts`, 12:37:02 local.
  Five tests passed.
- GREEN: `npm test -- src/lib/output-svg.test.ts src/lib/output-connectors.test.ts`,
  12:39:33 local. Seven tests passed across two files, exit code 0. The helper
  fixtures include different cell widths and a one-column vertical route.

The initial sandboxed Vitest invocation could not start because Windows
process spawning returned EPERM. The same focused commands ran with the
approved process permission escalation. No dependency changes were made.

An independent review found no connector-only blockers. SVG, PNG and PDF use
the same renderer; they require no separate routing implementation. Full
integration and browser verification belong to the root task.
