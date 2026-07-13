# Firebase integration

Firebase is optional in CleanOps. Postgres remains the source of truth for jobs,
clients, invoices, users, schedules, checklists, and all other business data.
Firebase is used only for static hosting, checklist-photo object storage through
API-minted signed URLs, and FCM push delivery for SOS alerts.

## 1. Create a Firebase project

```sh
npx firebase-tools login
npx firebase-tools projects:create cleanops-demo
```

Replace `cleanops-demo` in `.firebaserc` with the project id you create before
deploying real environments.

## 2. Enable Storage and Cloud Messaging

In the Firebase console:

1. Open the project.
2. Enable Cloud Storage.
3. Enable Cloud Messaging.
4. Note the Storage bucket name for `FIREBASE_STORAGE_BUCKET`.

Storage rules are deny-all for direct client access. Checklist uploads are
performed with signed URLs minted by the API through the Firebase Admin SDK,
which bypasses Storage rules.

## 3. Create Hosting sites and apply targets

Create separate Hosting sites for the office web app and cleaner mobile PWA:

```sh
npx firebase-tools hosting:sites:create cleanops-web
npx firebase-tools hosting:sites:create cleanops-mobile
npx firebase-tools target:apply hosting web cleanops-web
npx firebase-tools target:apply hosting mobile cleanops-mobile
```

If you use a different project id or site names, update `.firebaserc`.

## 4. Configure the API service account

Download a Firebase Admin service account JSON file from:

Firebase console -> Project settings -> Service accounts -> Generate new
private key.

Set the JSON as a single-line string:

```sh
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-bucket-name
```

Alternatively, set `GOOGLE_APPLICATION_CREDENTIALS` to the service account file
path. The API starts without these variables; Firebase features return a soft
unavailable/no-op path when credentials are absent.

## 5. Create Firebase web apps

Create one Firebase web app for the office app and one for the cleaner app.
Copy the web app config into the relevant Vite environment variables:

```sh
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```

CleanOps authentication still uses API JWTs. Do not move business records to
Firestore.

## 6. Deploy hosting and storage rules

Install is kept light by using `npx` instead of adding `firebase-tools` to the
repo:

```sh
npm run build
npx firebase-tools deploy --only hosting,storage
```

The root helper script is also available when `firebase` is on your PATH:

```sh
npm run firebase:deploy
```

## 7. What Firebase owns vs Postgres owns

Firebase:

- Hosts the static builds from `packages/web/dist` and `packages/mobile/dist`.
- Stores checklist photo objects uploaded through API-generated signed URLs.
- Sends SOS push notifications through FCM to registered office devices.

Postgres:

- Remains the source of truth for businesses, users, clients, properties, jobs,
  schedules, checklists, invoices, payments, messages, SOS records, and device
  push tokens.
- Stores uploaded photo URLs/paths when checklist results reference photos.

Firestore is configured deny-all and has no indexes because CleanOps does not
use Firestore for business data.
