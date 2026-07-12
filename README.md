# CleanOps

CleanOps is a private cleaning-operations monorepo for building a ZenMaid-style
platform focused first on New Zealand and then the Philippines. The product
combines booking and recurring job generation, cleaner scheduling, checklists,
GPS/time capture, invoicing, payments, customer messaging, public APIs, and
office SOS workflows.

Key differentiators:

- NZ-first GST and inclusive pricing support, with a path to PH VAT/BIR needs.
- Cleaner-first mobile workflows for jobs, access notes, checklists, time, and SOS.
- Operational automation for recurring work, reminders, webhooks, and invoices.
- Public API surface versioned separately from app-only routes.

## Monorepo structure

```text
.
├── db/
│   ├── migrations/001_initial_schema.sql
│   └── seed.sql
├── packages/
│   ├── api/       # Express API, workers, service modules
│   ├── shared/    # Shared types, tax helpers, constants
│   ├── web/       # Planned web client workspace
│   └── mobile/    # Planned mobile workspace
├── docker-compose.yml
└── package.json
```

## Quick start with Docker Compose

Requirements: Docker with Compose v2.

```sh
cp .env.example .env
docker compose up --build
```

Services:

- API: http://localhost:3001
- API health: http://localhost:3001/health
- OpenAPI JSON: http://localhost:3001/openapi.json
- Postgres: localhost:5432 (`cleanops` / `cleanops`)
- Redis: localhost:6379

On the first Postgres boot, Compose mounts:

- `db/migrations/001_initial_schema.sql` as
  `/docker-entrypoint-initdb.d/001_initial_schema.sql`
- `db/seed.sql` as `/docker-entrypoint-initdb.d/002_seed.sql`

The seed creates the demo account `admin@harbourshine.nz` with password
`password123`, plus a cleaner, clients, properties, checklist, and recurrence.
Postgres only runs init scripts when the data volume is empty. To reset local
data:

```sh
docker compose down -v
docker compose up --build
```

## Local development without Docker

Requirements:

- Node.js 22
- npm
- Postgres 15 or 16
- Redis 7

Install dependencies:

```sh
npm install
```

Create a local database and apply schema/seed:

```sh
createdb cleanops
psql postgres://cleanops:cleanops@localhost:5432/cleanops -f db/migrations/001_initial_schema.sql
psql postgres://cleanops:cleanops@localhost:5432/cleanops -f db/seed.sql
```

If your local Postgres role or database differs, update `DATABASE_URL` in
`.env` and `packages/api/.env.example` accordingly.

Run the API and worker:

```sh
npm run dev:api
npm run worker
```

Build and test all workspaces that currently expose matching scripts:

```sh
npm run build
npm test
```

## Packages

- `@cleanops/api`: Express application, auth, route handlers, service modules,
  BullMQ workers, and OpenAPI document.
- `@cleanops/shared`: Shared constants, tax helpers, geographic utilities, and
  cross-platform TypeScript types.
- `@cleanops/web`: Planned browser app workspace.
- `@cleanops/mobile`: Planned cleaner mobile app workspace.

## Environment variables

Root and API examples live in `.env.example` and `packages/api/.env.example`.
Important variables:

- `DATABASE_URL`: Postgres connection string.
- `REDIS_URL`: Redis connection string for BullMQ and cache-backed features.
- `JWT_SECRET`: Secret used to sign API tokens; change it outside local dev.
- `PORT`: API port, default `3001`.
- `NODE_ENV`: `development`, `test`, or `production`.
- `CORS_ORIGIN`: Comma-separated local web/mobile origins for development.
- `PUBLIC_API_RATE_LIMIT_POINTS` and `PUBLIC_API_RATE_LIMIT_DURATION`: Public
  API rate-limit controls.
- `RECURRENCE_HORIZON_WEEKS`: Future recurrence generation horizon.
- `TWILIO_*`, `POSTMARK_*`, `STRIPE_*`, `WINDCAVE_*`, `PAYMONGO_*`: Provider
  credentials and webhook secrets.
- `OFFICE_SOS_SMS_NUMBER`: Office escalation number for cleaner SOS alerts.

## Jurisdiction rollout

CleanOps starts with New Zealand:

- NZD currency.
- Pacific/Auckland timezone defaults.
- GST jurisdiction seeded at 15%.
- Inclusive pricing as the default business mode.

The Philippines rollout follows after NZ workflows stabilize:

- PHP currency and Asia/Manila timezone defaults.
- VAT jurisdiction at 12%.
- BIR permit/ATP fields already exist in the business and invoice schema.
- PayMongo support is represented in payment-provider configuration.

## API versioning

The app currently exposes internal product routes under `/api/*`. Public API
routes are mounted under `/v1` and should remain backwards compatible within a
major version. Breaking public contract changes should be introduced under a new
version prefix such as `/v2`.

## License and privacy

This repository is private and proprietary. Do not redistribute code, schema, or
seed data outside the CleanOps project without explicit permission.
