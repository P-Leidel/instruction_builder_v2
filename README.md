# Visual Instruction Builder

A browser-based, offline-first app for creating visual instructions, picture routines and choice boards. It serves workplace reminders across language barriers and supported learning at home or in the classroom.

The overhaul adds three original pictogram libraries, English/German controls and default labels, a responsive editor, local saved guides and physical output from labels to large prints. The local technical delivery passed independent reviews and clean-install checks; [milestones](docs/milestones.md) tracks status. Practical participant, device and physical-print acceptance remains pending.

## Getting started

Use Node.js 24 LTS. Other supported Node ranges are declared in `package.json`.

```bash
npm ci
npm run dev       # start the dev server
npm run typecheck # tsc -b, no emit
npm run lint      # eslint .
npm test          # Vitest unit suite
npm run test:tooling # browser-gate / offline build tests
npm run build     # typecheck + production build + offline assets
npx playwright install chromium # once per development machine
npm run test:browser # starts/stops its own dev server; screenshots in artifacts/browser
npm run test:pwa   # production offline exports + update lifecycle; build first
```

## Documentation

Planning and architecture docs live in [docs/](docs/):

- [docs/milestones.md](docs/milestones.md) — the single source of truth for current phase/task status; start here.
- [7 October codebase health review](docs/phase-3/reviews/2026-10-07-codebase-health-review.md) — current reliability findings, minor fixes, architecture debt and UX decisions, with source line references.
- [docs/project-plan.md](docs/project-plan.md) — the approved project plan (goals, stack, phased task list, risks, success criteria).
- [2026-10-06 takeover review](docs/phase-3/audits/2026-10-06-takeover-review.md) — historical baseline UX, graphics, mobile, and reliability findings and verified minor fixes; the overhaul handoff records their resolution.
- [Agent specification package](docs/superpowers/specs/2026-10-06-overhaul/README.md) — confirmed product choices, shared contracts, and separately owned overhaul deliveries.
- [Agent implementation plan](docs/superpowers/plans/2026-10-06-agent-implementation.md) — dependency order, parallel work, acceptance tests, and review gates.
- [Implementation and takeover handoff](docs/phase-3/audits/2026-10-06-overhaul/implementation-report.md) — delivered work, technical evidence, limitations and remaining release tasks.
- [UX/design direction](docs/superpowers/specs/2026-10-06-ux-design-overhaul.md) — practical visual instructions, simple authoring, and scalable physical output.
- [Reliability maintenance](docs/phase-3/progress/2026-10-06-reliability-maintenance.md) — follow-up fixes and verification.
- [Persistence recovery](docs/persistence-recovery.md) — backing up local work and recovering unreadable records.
- [docs/phase-1/architecture.md](docs/phase-1/architecture.md) — the Phase 1 architecture blueprint (data model, app architecture, folder structure, component responsibilities, roadmap, risks). Historical - see milestones.md for what's actually been built since.
- [docs/phase-1/foundation.md](docs/phase-1/foundation.md) — explains every file in the original Phase 1 scaffold and why it exists.

## Deployment

The chosen host is Vercel. Use the Vite defaults:

- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 24

No Vercel-specific package, serverless function, or backend configuration is
required. The app is deployed as a static client-side build.

## Status

See [docs/milestones.md](docs/milestones.md) for the current phase and task-by-task status - it's the one place that's kept up to date as work lands, so it's deliberately not duplicated here.
