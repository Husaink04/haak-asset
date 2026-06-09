# PWA Offline Testing

## Automated Check

Run:

```powershell
npm run test:pwa
```

This builds the app and verifies:

- Manifest and favicon links exist in the production build.
- HAAK theme color is used by `index.html` and the manifest.
- PWA icons are present.
- Transparent logo and favicon assets have transparent edges.
- Service worker includes navigation fallback, API cache exclusion, upload caching, and stale-while-revalidate handling.

## Manual Browser Check

1. Start the API and frontend:

```powershell
npm run dev:all
```

2. Open `http://127.0.0.1:5174`.
3. Login once while online.
4. Stop the backend or switch DevTools Network to offline.
5. Reload the app.
6. Confirm the last logged-in user can still see cached portal data.
7. Make a small non-upload change, such as an asset status update.
8. Confirm the offline banner says changes are queued.
9. Restore the backend/network.
10. Click `Retry sync` or wait for the browser `online` event.
11. Reload and confirm the change persists from PostgreSQL.

## Hardening Rules

- Do not cache `/api/*` responses in the service worker.
- Do not depend on uploads while fully offline; uploaded files require the API.
- Keep app-shell files in the static cache.
- Cache uploaded files and remote images only after they have been fetched successfully.
- Bump the service worker cache version when changing cached asset names.
