# Backend Setup

## Requirements

- PostgreSQL installed locally.
- pgAdmin4 available.
- Node dependencies installed with `npm install`.

## Database

Create a database named:

```text
haak_assets
```

You can create it from pgAdmin4:

1. Open pgAdmin4.
2. Connect to your local PostgreSQL server.
3. Right-click `Databases`.
4. Select `Create` > `Database`.
5. Enter `haak_assets`.
6. Save.

The backend creates the required normalized tables automatically on startup. The schema is also available at:

```text
database/schema.sql
```

## Environment

Copy:

```text
.env.example
```

to:

```text
.env
```

Set your local PostgreSQL password:

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
MIN_PASSWORD_LENGTH=8
AUTH_RATE_LIMIT=20
AUTH_RATE_WINDOW_MS=900000
API_RATE_LIMIT=240
API_RATE_WINDOW_MS=60000
```

Use a unique `JWT_SECRET` outside development. `UPLOAD_DIR` is where company logos, asset images, asset documents, and appeal attachments are stored. `PUBLIC_API_URL` is used to build file URLs returned to the frontend.
`AUTH_RATE_LIMIT` protects login attempts. `API_RATE_LIMIT` protects authenticated and unauthenticated API traffic. `MIN_PASSWORD_LENGTH` applies when admins create company logins through the CRUD API.

## Run

Backend:

```powershell
npm run dev:api
```

Frontend:

```powershell
npm run dev -- --port 5174
```

Both:

```powershell
npm run dev:all
```

## Current Backend Scope

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/state`
- `PUT /api/state`
- `POST /api/upload`
- `GET /api/users/me`
- `GET /api/companies`
- `POST /api/companies`
- `PUT /api/companies/:id`
- `DELETE /api/companies/:id`
- `GET /api/assets`
- `POST /api/assets`
- `PUT /api/assets/:id`
- `DELETE /api/assets/:id`
- `GET /api/service-records`
- `POST /api/service-records`
- `GET /api/appeals`
- `POST /api/appeals`
- `PUT /api/appeals/:id`
- `POST /api/appeals/:id/messages`
- `GET /api/files`
- `POST /api/files/cleanup`
- `DELETE /api/files/:id`

This persists app data in normalized PostgreSQL tables, signs authenticated sessions with JWT, stores passwords as bcrypt hashes, and saves uploaded files on disk for frontend use.
Uploads are recorded in `uploaded_files` with uploader, stored file name, URL, size, MIME type, optional owner entity, and deletion status. Admins can list files and clean unused uploaded files.

`GET /api/state` and `PUT /api/state` remain available as a compatibility layer for the current frontend. Internally, those routes now read from and write to normalized tables.
