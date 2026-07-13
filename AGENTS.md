# AGENTS.md

## Cursor Cloud specific instructions

CleanOps is an npm-workspaces monorepo (`packages/api`, `web`, `mobile`, `shared`). Standard commands live in the root `package.json` and `README.md`/`MVP.md`; prefer those. Notes below are the non-obvious bits.

### Services & how to run them
- The startup update script only runs `npm install`. PostgreSQL is installed at the system level (baked into the VM snapshot); it is **not** auto-started.
- Start Postgres each session before running the API: `sudo pg_ctlcluster 16 main start`.
- Then run `./scripts/mvp-setup.sh` (idempotent) to create/seed the `cleanops` role + database and write `packages/api/.env`. It uses the `sudo -n -u postgres` admin path automatically.
- Dev servers (run from repo root): `npm run dev:api` (:3001), `npm run dev:web` (:5173), `npm run dev:mobile` (:5174). The web/mobile Vite configs proxy `/api` and `/v1` to `http://localhost:3001`, so the API must be running for the frontends to work.
- Redis and the BullMQ worker are optional in dev: `packages/api/.env` sets `MVP_MODE=true` and `REDIS_OPTIONAL=true`, so the API stays up without Redis.

### Lint / test / build
- No linter is configured in any workspace.
- Tests: `npm test` (only `packages/api` has tests, via vitest); they do not require a running DB.
- Build/typecheck: `npm run build` (tsc across workspaces; web/mobile also run vite build).

### Gotchas
- Changing `packages/web/tailwind.config.js` (e.g. brand colors) is **not** reliably hot-reloaded — restart `npm run dev:web` and hard-refresh the browser to see color/theme changes.
- The web brand color is the `coastal` palette in `packages/web/tailwind.config.js`; components reference `coastal-50..900` plus Tailwind's default `sky-*`.
- Demo logins (from `db/seed.sql`): office `admin@harbourshine.nz` / `password123`, cleaner `mia@harbourshine.nz` / `password123`.
- The invoice detail "Mark paid" button is intentionally a no-op in the current UI (no mark-paid API endpoint yet); "Mark sent" works.
