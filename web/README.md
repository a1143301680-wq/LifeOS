# LifeOS PC Web

## Local development

Requirements: Node.js 20.19+ or 22.12+ and the LifeOS backend on `http://127.0.0.1:8000`.

```powershell
cd D:\LifeOS\web
npm install
npm run dev
```

Vite serves the app on the URL printed in the terminal and proxies `/api` requests to the local backend, so backend CORS changes are not needed.

## Verification

```powershell
npm test
npm run build
npm run test:e2e
```

The API base defaults to `/api/v1`. For a non-secret deployment override, set `VITE_API_BASE_URL` in the deployment environment. Identity tokens must not be placed in environment files; the app stores the active token only in `localStorage.lifeos.identityToken` after `/me` validates it.
