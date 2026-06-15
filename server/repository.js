import { pool, query } from "./db.js";
import { seedState } from "./seedState.js";

function dateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function timestampValue(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function documentToRow(document) {
  const value = typeof document === "string" ? document : document?.url || document?.label || "";
  return {
    label: typeof document === "object" && document?.label ? document.label : value,
    url: String(value).startsWith("http") ? value : null
  };
}

export async function ensureNormalizedSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      contact_person TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      logo_url TEXT NOT NULL DEFAULT '',
      asset_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
      amc_start_date DATE,
      amc_end_date DATE,
      amc_term TEXT NOT NULL DEFAULT '',
      amc_renewal_notice_sent_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query("ALTER TABLE companies ADD COLUMN IF NOT EXISTS asset_categories JSONB NOT NULL DEFAULT '[]'::jsonb");
  await query("ALTER TABLE companies ADD COLUMN IF NOT EXISTS amc_start_date DATE");
  await query("ALTER TABLE companies ADD COLUMN IF NOT EXISTS amc_end_date DATE");
  await query("ALTER TABLE companies ADD COLUMN IF NOT EXISTS amc_term TEXT NOT NULL DEFAULT ''");
  await query("ALTER TABLE companies ADD COLUMN IF NOT EXISTS amc_renewal_notice_sent_at TIMESTAMPTZ");

  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'client')),
      client_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
      password_hash TEXT NOT NULL,
      password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (email, role)
    )
  `);

  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()");

  await query(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      asset_code TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      brand TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      serial_number TEXT NOT NULL DEFAULT '',
      purchase_date DATE,
      warranty_end_date DATE,
      location TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query("ALTER TABLE assets ADD COLUMN IF NOT EXISTS user_name TEXT NOT NULL DEFAULT ''");

  await query(`
    CREATE TABLE IF NOT EXISTS asset_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS asset_images (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS asset_documents (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS asset_lifecycle (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at_text TEXT NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS service_records (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      service_date DATE,
      service_type TEXT NOT NULL,
      technician_name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      next_service_due DATE,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS engineers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      specialization TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS appeals (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      raised_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `);

  await query("ALTER TABLE appeals ADD COLUMN IF NOT EXISTS assigned_engineer_id TEXT REFERENCES engineers(id) ON DELETE SET NULL");

  await query(`
    CREATE TABLE IF NOT EXISTS appeal_messages (
      id TEXT PRIMARY KEY,
      appeal_id TEXT NOT NULL REFERENCES appeals(id) ON DELETE CASCADE,
      sender_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      message TEXT NOT NULL,
      attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS credential_requests (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      requested_email TEXT NOT NULL DEFAULT '',
      requested_password TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL,
      resolved_at TIMESTAMPTZ
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'activity',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      client_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
      company_name TEXT NOT NULL DEFAULT '',
      actor_role TEXT NOT NULL DEFAULT '',
      actor_name TEXT NOT NULL DEFAULT '',
      entity_type TEXT NOT NULL DEFAULT '',
      entity_id TEXT NOT NULL DEFAULT '',
      tone TEXT NOT NULL DEFAULT 'info',
      read_by JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS uploaded_files (
      id TEXT PRIMARY KEY,
      uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      url TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )
  `);
}

export async function legacyAppState() {
  await query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const result = await query("SELECT data FROM app_state WHERE id = 1");
  return result.rows[0]?.data || null;
}

export async function seedNormalizedState(state) {
  const count = await query("SELECT COUNT(*)::int AS count FROM users");
  if (count.rows[0].count > 0) return;
  await writeState(state || (await legacyAppState()) || seedState);
}

export async function readState() {
  const [users, companies, settings, assets, assetCategories, images, documents, lifecycle, serviceRecords, engineers, appeals, appealMessages, credentialRequests, notifications] = await Promise.all([
    query("SELECT * FROM users ORDER BY created_at, id"),
    query("SELECT * FROM companies ORDER BY created_at, id"),
    query("SELECT key, value FROM app_settings"),
    query("SELECT * FROM assets ORDER BY created_at, id"),
    query("SELECT * FROM asset_categories ORDER BY name, id"),
    query("SELECT * FROM asset_images ORDER BY sort_order, id"),
    query("SELECT * FROM asset_documents ORDER BY sort_order, id"),
    query("SELECT * FROM asset_lifecycle ORDER BY created_at_text, id"),
    query("SELECT * FROM service_records ORDER BY service_date DESC NULLS LAST, created_at DESC"),
    query("SELECT * FROM engineers ORDER BY created_at, id"),
    query("SELECT * FROM appeals ORDER BY updated_at DESC"),
    query("SELECT * FROM appeal_messages ORDER BY created_at, id"),
    query("SELECT * FROM credential_requests ORDER BY created_at DESC"),
    query("SELECT * FROM notifications ORDER BY created_at DESC")
  ]);

  const derivedCategories = [...new Set(assets.rows.map((asset) => asset.category).filter(Boolean))].sort((first, second) => first.localeCompare(second));

  return {
    settings: {
      adminAlertEmail: "huzefarampurawala9@gmail.com",
      ...Object.fromEntries(settings.rows.map((setting) => [setting.key, setting.value]))
    },
    assetCategories: assetCategories.rows.length > 0 ? assetCategories.rows.map((category) => category.name) : derivedCategories,
    engineers: engineers.rows.map((engineer) => ({
      id: engineer.id,
      name: engineer.name,
      email: engineer.email,
      phone: engineer.phone,
      specialization: engineer.specialization,
      status: engineer.status
    })),
    users: users.rows.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      clientId: user.client_id,
      passwordHash: user.password_hash,
      passwordChangedAt: timestampValue(user.password_changed_at)
    })),
    clients: companies.rows.map((company) => ({
      id: company.id,
      companyName: company.company_name,
      contactPerson: company.contact_person,
      email: company.email,
      phone: company.phone,
      address: company.address,
      logoUrl: company.logo_url,
      assetCategories: Array.isArray(company.asset_categories) && company.asset_categories.length > 0 ? company.asset_categories : derivedCategories,
      amcStartDate: dateValue(company.amc_start_date) || "",
      amcEndDate: dateValue(company.amc_end_date) || "",
      amcTerm: company.amc_term || "",
      amcRenewalNoticeSentAt: company.amc_renewal_notice_sent_at ? timestampValue(company.amc_renewal_notice_sent_at) : "",
      status: company.status
    })),
    assets: assets.rows.map((asset) => ({
      id: asset.id,
      assetCode: asset.asset_code,
      clientId: asset.client_id,
      name: asset.name,
      userName: asset.user_name,
      category: asset.category,
      brand: asset.brand,
      model: asset.model,
      serialNumber: asset.serial_number,
      purchaseDate: dateValue(asset.purchase_date) || "",
      warrantyEndDate: dateValue(asset.warranty_end_date) || "",
      location: asset.location,
      status: asset.status,
      notes: asset.notes,
      images: images.rows.filter((image) => image.asset_id === asset.id).map((image) => image.url),
      documents: documents.rows.filter((document) => document.asset_id === asset.id).map((document) => document.url || document.label),
      lifecycle: lifecycle.rows
        .filter((item) => item.asset_id === asset.id)
        .map((item) => ({ id: item.id, type: item.type, description: item.description, createdAt: item.created_at_text }))
    })),
    serviceRecords: serviceRecords.rows.map((record) => ({
      id: record.id,
      assetId: record.asset_id,
      serviceDate: dateValue(record.service_date) || "",
      serviceType: record.service_type,
      technicianName: record.technician_name,
      description: record.description,
      nextServiceDue: dateValue(record.next_service_due) || "",
      status: record.status
    })),
    appeals: appeals.rows.map((appeal) => ({
      id: appeal.id,
      assetId: appeal.asset_id,
      clientId: appeal.client_id,
      assignedEngineerId: appeal.assigned_engineer_id,
      raisedBy: appeal.raised_by,
      title: appeal.title,
      description: appeal.description,
      priority: appeal.priority,
      status: appeal.status,
      createdAt: timestampValue(appeal.created_at),
      updatedAt: timestampValue(appeal.updated_at)
    })),
    appealMessages: appealMessages.rows.map((message) => ({
      id: message.id,
      appealId: message.appeal_id,
      senderId: message.sender_id,
      message: message.message,
      attachments: message.attachments || [],
      createdAt: timestampValue(message.created_at)
    })),
    credentialRequests: credentialRequests.rows.map((request) => ({
      id: request.id,
      clientId: request.client_id,
      requestedBy: request.requested_by,
      requestedEmail: request.requested_email,
      requestedPassword: request.requested_password,
      note: request.note,
      status: request.status,
      createdAt: timestampValue(request.created_at),
      resolvedAt: request.resolved_at ? timestampValue(request.resolved_at) : null
    })),
    notifications: notifications.rows.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      clientId: notification.client_id,
      companyName: notification.company_name,
      actorRole: notification.actor_role,
      actorName: notification.actor_name,
      entityType: notification.entity_type,
      entityId: notification.entity_id,
      tone: notification.tone,
      readBy: notification.read_by || [],
      createdAt: timestampValue(notification.created_at)
    }))
  };
}

let writeStateQueue = Promise.resolve();

async function writeStateOnce(state) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(44001, 1)");
    await client.query(`
      LOCK TABLE
        uploaded_files,
        notifications,
        appeal_messages,
        appeals,
        engineers,
        asset_categories,
        credential_requests,
        service_records,
        asset_lifecycle,
        asset_documents,
        asset_images,
        assets,
        users,
        companies
      IN ACCESS EXCLUSIVE MODE
    `);
    // Keep uploaded_files metadata intact; DELETE honors ON DELETE SET NULL for file ownership.
    await client.query("DELETE FROM appeal_messages");
    await client.query("DELETE FROM appeals");
    await client.query("DELETE FROM notifications");
    await client.query("DELETE FROM credential_requests");
    await client.query("DELETE FROM engineers");
    await client.query("DELETE FROM service_records");
    await client.query("DELETE FROM asset_lifecycle");
    await client.query("DELETE FROM asset_documents");
    await client.query("DELETE FROM asset_images");
    await client.query("DELETE FROM asset_categories");
    await client.query("DELETE FROM assets");
    await client.query("DELETE FROM users");
    await client.query("DELETE FROM companies");

    await client.query("DELETE FROM app_settings");
    for (const [key, value] of Object.entries(state.settings || {})) {
      await client.query(
        `INSERT INTO app_settings (key, value)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, JSON.stringify(value)]
      );
    }

    for (const company of state.clients || []) {
      await client.query(
        `INSERT INTO companies (id, company_name, contact_person, email, phone, address, logo_url, asset_categories, amc_start_date, amc_end_date, amc_term, amc_renewal_notice_sent_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13)`,
        [
          company.id,
          company.companyName,
          company.contactPerson || "",
          company.email || "",
          company.phone || "",
          company.address || "",
          company.logoUrl || "",
          JSON.stringify(company.assetCategories || []),
          company.amcStartDate || null,
          company.amcEndDate || null,
          company.amcTerm || "",
          company.amcRenewalNoticeSentAt || null,
          company.status || "active"
        ]
      );
    }

    for (const user of state.users || []) {
      if (!user.passwordHash) throw new Error(`Missing password hash for user ${user.id}.`);
      await client.query(
        `INSERT INTO users (id, name, email, role, client_id, password_hash, password_changed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [user.id, user.name, user.email, user.role, user.clientId || null, user.passwordHash, timestampValue(user.passwordChangedAt)]
      );
    }

    for (const asset of state.assets || []) {
      await client.query(
        `INSERT INTO assets (id, asset_code, client_id, name, user_name, category, brand, model, serial_number, purchase_date, warranty_end_date, location, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          asset.id,
          asset.assetCode,
          asset.clientId,
          asset.name,
          asset.userName || "",
          asset.category || "",
          asset.brand || "",
          asset.model || "",
          asset.serialNumber || "",
          asset.purchaseDate || null,
          asset.warrantyEndDate || null,
          asset.location || "",
          asset.status || "active",
          asset.notes || ""
        ]
      );

      for (const [index, image] of (asset.images || []).entries()) {
        await client.query("INSERT INTO asset_images (id, asset_id, url, sort_order) VALUES ($1, $2, $3, $4)", [`${asset.id}-img-${index}`, asset.id, image, index]);
      }

      for (const [index, document] of (asset.documents || []).entries()) {
        const row = documentToRow(document);
        await client.query("INSERT INTO asset_documents (id, asset_id, label, url, sort_order) VALUES ($1, $2, $3, $4, $5)", [
          `${asset.id}-doc-${index}`,
          asset.id,
          row.label,
          row.url,
          index
        ]);
      }

      for (const [index, item] of (asset.lifecycle || []).entries()) {
        await client.query("INSERT INTO asset_lifecycle (id, asset_id, type, description, created_at_text) VALUES ($1, $2, $3, $4, $5)", [
          item.id || `${asset.id}-life-${index}`,
          asset.id,
          item.type || item.serviceType || "Event",
          item.description || "",
          item.createdAt || item.serviceDate || new Date().toISOString()
        ]);
      }
    }

    const categories = (state.assetCategories && state.assetCategories.length > 0)
      ? state.assetCategories
      : [...new Set((state.assets || []).map((asset) => asset.category).filter(Boolean))].sort((first, second) => first.localeCompare(second));

    for (const [index, category] of categories.entries()) {
      await client.query(
        `INSERT INTO asset_categories (id, name)
         VALUES ($1, $2)`,
        [`asset-category-${index}`, category]
      );
    }

    for (const record of state.serviceRecords || []) {
      await client.query(
        `INSERT INTO service_records (id, asset_id, service_date, service_type, technician_name, description, next_service_due, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [record.id, record.assetId, record.serviceDate || null, record.serviceType, record.technicianName || "", record.description || "", record.nextServiceDue || null, record.status || "completed"]
      );
    }

    for (const engineer of state.engineers || []) {
      await client.query(
        `INSERT INTO engineers (id, name, email, phone, specialization, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [engineer.id, engineer.name, engineer.email || "", engineer.phone || "", engineer.specialization || "", engineer.status || "active"]
      );
    }

    for (const appeal of state.appeals || []) {
      await client.query(
        `INSERT INTO appeals (id, asset_id, client_id, assigned_engineer_id, raised_by, title, description, priority, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          appeal.id,
          appeal.assetId,
          appeal.clientId,
          appeal.assignedEngineerId || null,
          appeal.raisedBy || null,
          appeal.title,
          appeal.description || "",
          appeal.priority || "medium",
          appeal.status || "open",
          appeal.createdAt || new Date().toISOString(),
          appeal.updatedAt || appeal.createdAt || new Date().toISOString()
        ]
      );
    }

    for (const message of state.appealMessages || []) {
      await client.query(
        `INSERT INTO appeal_messages (id, appeal_id, sender_id, message, attachments, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        [message.id, message.appealId, message.senderId || null, message.message || "", JSON.stringify(message.attachments || []), message.createdAt || new Date().toISOString()]
      );
    }

    for (const request of state.credentialRequests || []) {
      await client.query(
        `INSERT INTO credential_requests (id, client_id, requested_by, requested_email, requested_password, note, status, created_at, resolved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          request.id,
          request.clientId,
          request.requestedBy || null,
          request.requestedEmail || "",
          request.requestedPassword || "",
          request.note || "",
          request.status || "pending",
          request.createdAt || new Date().toISOString(),
          request.resolvedAt || null
        ]
      );
    }

    const validNotificationClientIds = new Set((state.clients || []).map((company) => company.id));
    for (const notification of state.notifications || []) {
      await client.query(
        `INSERT INTO notifications (id, type, title, message, client_id, company_name, actor_role, actor_name, entity_type, entity_id, tone, read_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)`,
        [
          notification.id,
          notification.type || "activity",
          notification.title || "Notification",
          notification.message || "",
          notification.clientId && validNotificationClientIds.has(notification.clientId) ? notification.clientId : null,
          notification.companyName || "",
          notification.actorRole || "",
          notification.actorName || "",
          notification.entityType || "",
          notification.entityId || "",
          notification.tone || "info",
          JSON.stringify(notification.readBy || []),
          notification.createdAt || new Date().toISOString()
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function writeStateWithRetry(state) {
  const retryableCodes = new Set(["40P01", "40001"]);
  let lastError;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await writeStateOnce(state);
      return;
    } catch (error) {
      lastError = error;
      if (!retryableCodes.has(error.code) || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 75 * (attempt + 1)));
    }
  }

  throw lastError;
}

export async function writeState(state) {
  const queuedWrite = writeStateQueue.then(
    () => writeStateWithRetry(state),
    () => writeStateWithRetry(state)
  );
  writeStateQueue = queuedWrite.catch(() => {});
  return queuedWrite;
}

export async function createUploadedFile(file) {
  await query(
    `INSERT INTO uploaded_files (id, uploaded_by, original_name, stored_name, mime_type, size_bytes, url, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      file.id,
      file.uploadedBy,
      file.originalName,
      file.storedName,
      file.mimeType,
      file.sizeBytes,
      file.url,
      file.entityType || null,
      file.entityId || null
    ]
  );
}

export async function listUploadedFiles() {
  const result = await query(`
    SELECT id, uploaded_by, original_name, stored_name, mime_type, size_bytes, url, entity_type, entity_id, created_at, deleted_at
    FROM uploaded_files
    ORDER BY created_at DESC
  `);
  return result.rows.map((file) => ({
    id: file.id,
    uploadedBy: file.uploaded_by,
    originalName: file.original_name,
    storedName: file.stored_name,
    mimeType: file.mime_type,
    sizeBytes: file.size_bytes,
    url: file.url,
    entityType: file.entity_type,
    entityId: file.entity_id,
    createdAt: timestampValue(file.created_at),
    deletedAt: file.deleted_at ? timestampValue(file.deleted_at) : null
  }));
}

export async function markUploadedFileDeleted(id) {
  await query("UPDATE uploaded_files SET deleted_at = NOW() WHERE id = $1", [id]);
}
