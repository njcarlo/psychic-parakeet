# CleanOps MVP

## In scope

1. Register/login (office + cleaner)
2. Clients & properties CRUD
3. Schedule: view/create/assign jobs
4. Cleaner app: today's jobs, clock in/out GPS, access notes after clock-in, checklist, SOS
5. Invoices from completed jobs (NZ GST inclusive), mark sent
6. Manual bank payment record

## Out of scope for MVP

- PH PayMongo / BIR enforcement UI
- Public API consumers / API keys UI (code can remain)
- Live Twilio/Postmark/Stripe
- Nightly worker dependency for demo (can generate on-demand or use seed jobs)
- Full offline sync polish beyond what's already there

## Demo script (happy path)

1. Login office (`admin@harbourshine.nz` / `password123`) → see today's seeded jobs on dashboard
2. Open schedule → create/assign jobs as needed
3. Login cleaner on mobile (`mia@harbourshine.nz` / `password123`) → clock in → view access notes → complete checklist → clock out
4. Clock-out auto-marks the job completed → office creates invoice → mark sent → record manual payment

## Quick start

```sh
./scripts/mvp-setup.sh
npm run dev:api
npm run dev:web     # http://localhost:5173
npm run dev:mobile  # http://localhost:5174
```
