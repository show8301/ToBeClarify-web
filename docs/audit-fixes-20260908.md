# DEV audit fixes — 2026-09-08

The settlement page now uses `/api/admin/staff-members`, whose IDs identify staff and which managers may access. The developer-only account directory remains unchanged. Settlement loading cancels obsolete requests and has explicit payroll/form types.

Reservation upstream failures return 502 with no-store instead of a cacheable successful empty list. Staff and room caches accept successful empty arrays. Gallery details can load IDs introduced after the build snapshot, and a confirmed upstream 404 clears stale album content.

`GET /api/health` remains a liveness probe. `GET /api/health/dependencies` performs bounded read-only checks of home and reservations and returns 200 when both succeed, otherwise 503. Monitoring can use this readiness endpoint; this change does not create an external alert subscription. Until the API reservation SQL fix is deployed, degraded readiness is expected.

TypeScript contracts for existing JavaScript auth/shared components are annotated without changing their runtime behavior. CI now runs lint and TypeScript checks in addition to build. The 24 existing image warnings remain separate optimization work. Automated test suites are not part of DEV deployment.

Release flow: changes first deploy from `dev`; production Web remains gated on user confirmation. Git commits and pushes for this change use verified GitHub identity `nick800608` (24969952).
