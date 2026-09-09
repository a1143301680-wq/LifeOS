# LifeOS PC Web

## Local development

Requirements: Node.js 20.19+ or 22.12+ and the LifeOS backend on `http://127.0.0.1:8000`.

```powershell
cd D:\LifeOS\web
npm install
npm run dev
```

Vite serves the app on the URL printed in the terminal and proxies `/api` requests to the local backend, so backend CORS changes are not needed.

## Sync recovery

After `/me` validates an identity, the app loads that identity's versioned sync state from `localStorage.lifeos.sync.v1.<identity-id>`. The cursor and normalized Todo/category snapshot or tombstone cache are serialized together, then advanced one fully validated `/sync/changes` page at a time. The cache is recovery state; visible Today, Todos, and Categories remain server-authoritative projections.

The app opens `/sync/events` with the identity token only in the `Authorization` header. `sync.available` is a wake-up to pull and apply changes before refreshing affected views that were already loaded. The compact header state shows initial sync, live, reconnecting, offline, or retryable error status.

## Verification

```powershell
npm test
npm run build
npm run test:e2e
npm audit --audit-level=high
```

The API base defaults to `/api/v1`. For a non-secret deployment override, set `VITE_API_BASE_URL` in the deployment environment. Identity tokens must not be placed in environment files; the app stores the active token only in `localStorage.lifeos.identityToken` after `/me` validates it.
