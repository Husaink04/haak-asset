# MVP Architecture

## Product Goal

The HAAK INFOTECH Asset Management PWA centralizes asset records, service history, lifecycle changes, asset images, and issue appeals so admins and clients share the same operational history.

## User Flows

### Admin

```mermaid
flowchart TD
  A["Admin login"] --> B["Dashboard"]
  B --> C["Add or update asset"]
  B --> D["Add service record"]
  B --> E["Review client appeals"]
  E --> F["Reply to appeal"]
  E --> G["Update appeal status"]
```

### Client

```mermaid
flowchart TD
  A["Client login"] --> B["Client dashboard"]
  B --> C["View assigned assets"]
  C --> D["Open asset details"]
  D --> E["Review lifecycle and service history"]
  D --> F["Raise issue"]
  F --> G["Track shared appeal history"]
```

## Data Model

```mermaid
erDiagram
  CLIENTS ||--o{ USERS : has
  CLIENTS ||--o{ ASSETS : owns
  ASSETS ||--o{ SERVICE_RECORDS : has
  ASSETS ||--o{ ASSET_LIFECYCLE_EVENTS : has
  ASSETS ||--o{ APPEALS : has
  APPEALS ||--o{ APPEAL_MESSAGES : contains
  USERS ||--o{ APPEAL_MESSAGES : sends

  USERS {
    uuid id
    string name
    string email
    string role
    uuid client_id
  }

  CLIENTS {
    uuid id
    string company_name
    string contact_person
    string email
    string status
  }

  ASSETS {
    uuid id
    string asset_code
    uuid client_id
    string name
    string category
    string serial_number
    string status
  }

  SERVICE_RECORDS {
    uuid id
    uuid asset_id
    date service_date
    string service_type
    string status
  }

  APPEALS {
    uuid id
    uuid asset_id
    uuid client_id
    string title
    string priority
    string status
  }

  APPEAL_MESSAGES {
    uuid id
    uuid appeal_id
    uuid sender_id
    string message
    datetime created_at
  }
```

## Production Backend Target

Recommended backend stack:

- Node.js with NestJS or Express
- PostgreSQL
- Prisma ORM
- Secure HTTP-only cookie sessions or JWT with refresh rotation
- Object storage for images and documents
- Role-based and tenant-scoped authorization
- Audit logs for asset, service, and appeal mutations

## API Contract Target

- `POST /api/auth/admin/login`
- `POST /api/auth/client/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/assets`
- `POST /api/assets`
- `PATCH /api/assets/:id`
- `GET /api/assets/:id/service-records`
- `POST /api/assets/:id/service-records`
- `GET /api/appeals`
- `POST /api/appeals`
- `GET /api/appeals/:id`
- `PATCH /api/appeals/:id/status`
- `POST /api/appeals/:id/messages`

## Security Requirements For Production

- Clients must only read assets and appeals linked to their `client_id`.
- Admin actions should be permission-gated.
- Passwords must be hashed with Argon2 or bcrypt.
- File uploads need type, size, and malware checks.
- Offline caches must avoid long-lived sensitive data unless encrypted or scoped.
- Appeal history should be public to both parties unless explicitly marked as an internal admin note.
- Audit logs should record who changed assets, statuses, services, and appeals.
