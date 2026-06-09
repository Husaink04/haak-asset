# HAAK INFOTECH Asset Management PWA

MVP implementation for HAAK INFOTECH asset lifecycle, service history, company records, and client appeal tracking.

## Demo Logins

Admin account:

- Email: `admin@haakinfotech.com`
- Password: `admin123`

Company account:

- Email: `client@example.com`
- Password: `client123`

## Run Locally

```powershell
npm install
npm run dev
```

## Docker Deployment

Deployment files are included for a Kali Linux Docker server:

- `Dockerfile`
- `docker-compose.yml`
- `.env.production.example`
- `DEPLOYMENT.md`

Follow `DEPLOYMENT.md` to push this project to GitHub and run it on the server.

## PostgreSQL Backend Setup

1. Create a PostgreSQL database in pgAdmin4 named `haak_assets`.
2. Copy `.env.example` to `.env`.
3. Update `DATABASE_URL` in `.env` with your PostgreSQL password:

```text
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/haak_assets
API_PORT=4000
CORS_ORIGIN=http://127.0.0.1:5174,http://localhost:5174
VITE_API_URL=http://127.0.0.1:4000/api
JWT_SECRET=replace-with-a-long-random-production-secret
JWT_EXPIRES_IN=8h
PUBLIC_API_URL=http://127.0.0.1:4000
UPLOAD_DIR=uploads
MAX_UPLOAD_BYTES=5242880
```

4. Start the backend:

```powershell
npm run dev:api
```

5. Start the frontend in another terminal:

```powershell
npm run dev -- --port 5174
```

Or start both together:

```powershell
npm run dev:all
```

The API automatically creates the `app_state` table and seeds demo data on first startup.

## Implemented MVP Scope

- Single login form for Admin and Company accounts.
- Role-aware dashboard and navigation.
- Admin dashboard company creation.
- Company list with assigned asset counts.
- Admin asset creation and status management.
- Phase 2 company management page with edit and guarded delete.
- Phase 2 asset edit, reassignment, delete, images, documents, and lifecycle event management.
- Client-scoped asset list and detail view.
- Admin service record creation.
- Client issue/appeal creation.
- Shared appeal conversation history visible to Admin and Client.
- JWT-backed API authentication with bcrypt password hashing.
- Real file uploads for company logos, asset images/documents, and appeal attachments.
- PWA manifest and production service worker.
- Normalized PostgreSQL backend with role-scoped CRUD APIs.
- Compatibility state sync endpoint for the current PWA frontend.

## Current Limitation

The current PWA still uses the compatibility state sync endpoint for most screen updates. The backend now has normalized tables and CRUD APIs, so the next production step is migrating each frontend screen from state sync to endpoint-specific calls.
