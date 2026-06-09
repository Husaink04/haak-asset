import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import multer from "multer";
import { query } from "./db.js";
import {
  createUploadedFile,
  ensureNormalizedSchema,
  legacyAppState,
  listUploadedFiles,
  markUploadedFileDeleted,
  readState as readNormalizedState,
  seedNormalizedState,
  writeState as writeNormalizedState
} from "./repository.js";
import { seedState } from "./seedState.js";

dotenv.config();

const app = express();
const port = Number(process.env.API_PORT || 4000);
const origin = process.env.CORS_ORIGIN || "http://127.0.0.1:5174,http://localhost:5174";
const jwtSecret = process.env.JWT_SECRET || "dev-only-change-this-secret";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadRoot = path.resolve(__dirname, "..", process.env.UPLOAD_DIR || "uploads");
const distRoot = path.resolve(__dirname, "..", "dist");

fs.mkdirSync(uploadRoot, { recursive: true });

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      "upgrade-insecure-requests": null
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({ origin: origin.split(",").map((item) => item.trim()), credentials: false }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadRoot));

const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.AUTH_RATE_LIMIT || 20),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." }
});

const apiLimiter = rateLimit({
  windowMs: Number(process.env.API_RATE_WINDOW_MS || 60 * 1000),
  limit: Number(process.env.API_RATE_LIMIT || 240),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Try again shortly." }
});

app.use("/api", apiLimiter);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, uploadRoot),
    filename: (_request, file, callback) => {
      const ext = path.extname(file.originalname).toLowerCase();
      callback(null, `${randomUUID()}${ext}`);
    }
  }),
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024)
  },
  fileFilter: (_request, file, callback) => {
    const allowedTypes = new Set([
      "image/jpeg",
      "image/png",
      "application/pdf",
      "application/msword"
    ]);
    if (!allowedTypes.has(file.mimetype)) {
      return callback(new Error("Unsupported file type. Images must be JPG or PNG, and documents must be PDF or DOC."));
    }
    callback(null, true);
  }
});

function publicUser(user) {
  if (!user) return null;
  const { password, passwordHash, ...safeUser } = user;
  return safeUser;
}

function publicState(state) {
  return {
    ...state,
    users: state.users.map(publicUser)
  };
}

async function normalizePasswords(state) {
  const users = await Promise.all(
    state.users.map(async (user) => {
      if (user.passwordHash) {
        const { password, ...withoutPassword } = user;
        return withoutPassword;
      }
      if (user.password) {
        const { password, ...withoutPassword } = user;
        return { ...withoutPassword, passwordHash: await bcrypt.hash(password, 12) };
      }
      return user;
    })
  );
  return { ...state, users };
}

async function ensureSchema() {
  await ensureNormalizedSchema();
  const legacy = await legacyAppState();
  await seedNormalizedState(await normalizePasswords(legacy || seedState));
}

async function readState() {
  return readNormalizedState();
}

async function writeState(state) {
  await writeNormalizedState(state);
}

async function mergePasswords(nextState, currentState) {
  const currentUsers = new Map(currentState.users.map((user) => [user.id, user]));
  const merged = {
    ...nextState,
    users: nextState.users.map((user) => {
      if (user.password || user.passwordHash) return user;
      const currentUser = currentUsers.get(user.id);
      return { ...user, passwordHash: currentUser?.passwordHash, password: currentUser?.password };
    })
  };
  return normalizePasswords(merged);
}

async function verifyPassword(user, password) {
  if (user.passwordHash) return bcrypt.compare(password, user.passwordHash);
  return user.password === password;
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, clientId: user.clientId || null },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

function requireAuth(request, response, next) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return response.status(401).json({ error: "Missing auth token." });

  try {
    request.auth = jwt.verify(token, jwtSecret);
    next();
  } catch {
    response.status(401).json({ error: "Invalid or expired auth token." });
  }
}

function requireAdmin(request, response, next) {
  if (request.auth?.role !== "admin") {
    return response.status(403).json({ error: "Admin access required." });
  }
  next();
}

function uid(prefix) {
  return `${prefix}-${randomUUID()}`;
}

function canAccessClient(auth, clientId) {
  return auth.role === "admin" || auth.clientId === clientId;
}

function scopedAssets(state, auth) {
  return auth.role === "admin" ? state.assets : state.assets.filter((asset) => asset.clientId === auth.clientId);
}

function scopedAppeals(state, auth) {
  return auth.role === "admin" ? state.appeals : state.appeals.filter((appeal) => appeal.clientId === auth.clientId);
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < Number(process.env.MIN_PASSWORD_LENGTH || 8)) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D+/g, "");
}

function collectReferencedUploadUrls(state) {
  const urls = new Set();
  for (const client of state.clients || []) {
    if (client.logoUrl) urls.add(client.logoUrl);
  }
  for (const asset of state.assets || []) {
    for (const image of asset.images || []) urls.add(image);
    for (const document of asset.documents || []) {
      if (typeof document === "string") urls.add(document);
      if (document?.url) urls.add(document.url);
    }
  }
  for (const message of state.appealMessages || []) {
    for (const attachment of message.attachments || []) {
      if (attachment?.url) urls.add(attachment.url);
    }
  }
  return urls;
}

function resolveUploadPath(storedName) {
  const resolved = path.resolve(uploadRoot, storedName);
  if (!resolved.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new Error("Invalid upload path.");
  }
  return resolved;
}

async function deleteUploadedFile(file) {
  const filePath = resolveUploadPath(file.storedName);
  await fs.promises.rm(filePath, { force: true });
  await markUploadedFileDeleted(file.id);
}

app.get("/api/health", async (_request, response) => {
  await query("SELECT 1");
  response.json({ ok: true, database: "connected" });
});

app.post("/api/auth/login", authLimiter, async (request, response) => {
  const { email, password } = request.body || {};
  if (!email || !password) {
    return response.status(400).json({ error: "Email and password are required." });
  }

  const state = await readState();
  const users = state.users.filter((item) => item.email.toLowerCase() === String(email).toLowerCase());
  let user = null;
  for (const candidate of users) {
    if (await verifyPassword(candidate, password)) {
      user = candidate;
      break;
    }
  }

  if (!user) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return response.status(401).json({ error: "Invalid email or password." });
  }

  if (user.role === "client") {
    const company = state.clients.find((client) => client.id === user.clientId);
    if (company?.status === "inactive") {
      return response.status(403).json({ error: "This company is inactive. Access has been disabled." });
    }
  }

  const normalizedState = await normalizePasswords(state);
  if (!user.passwordHash) await writeState(normalizedState);
  const normalizedUser = normalizedState.users.find((item) => item.id === user.id) || user;

  response.json({ token: signToken(normalizedUser), user: publicUser(normalizedUser), state: publicState(normalizedState) });
});

app.get("/api/state", requireAuth, async (_request, response) => {
  const state = await readState();
  response.json(publicState(state));
});

app.put("/api/state", requireAuth, async (request, response) => {
  const nextState = request.body;
  if (!nextState || !Array.isArray(nextState.users) || !Array.isArray(nextState.clients) || !Array.isArray(nextState.assets)) {
    return response.status(400).json({ error: "Invalid app state payload." });
  }

  const currentState = await readState();
  const mergedState = await mergePasswords(nextState, currentState);
  await writeState(mergedState);
  response.json(publicState(mergedState));
});

app.get("/api/users/me", requireAuth, async (request, response) => {
  const state = await readState();
  const user = state.users.find((item) => item.id === request.auth.sub);
  if (!user) return response.status(404).json({ error: "User not found." });
  response.json(publicUser(user));
});

app.get("/api/companies", requireAuth, async (request, response) => {
  const state = await readState();
  const companies = request.auth.role === "admin" ? state.clients : state.clients.filter((client) => client.id === request.auth.clientId);
  response.json(companies);
});

app.post("/api/companies", requireAuth, requireAdmin, async (request, response) => {
  const state = await readState();
  const form = request.body || {};
  if (!form.companyName || !form.contactPerson || !form.email) {
    return response.status(400).json({ error: "Company name, contact person, and email are required." });
  }
  if (!validateEmail(form.email) || (form.loginEmail && !validateEmail(form.loginEmail))) {
    return response.status(400).json({ error: "Enter a valid email address." });
  }

  const clientId = form.id || uid("c");
  const company = {
    id: clientId,
    companyName: form.companyName,
    contactPerson: form.contactPerson,
    email: form.email,
    phone: normalizePhone(form.phone),
    address: form.address || "",
    logoUrl: form.logoUrl || "",
    status: form.status || "active"
  };
  const users = [...state.users];
  let user = null;
  if (form.loginEmail && form.loginPassword) {
    const passwordError = validatePassword(form.loginPassword);
    if (passwordError) return response.status(400).json({ error: passwordError });
    user = {
      id: uid("u"),
      name: form.contactPerson,
      email: form.loginEmail,
      role: "client",
      clientId,
      passwordHash: await bcrypt.hash(form.loginPassword, 12)
    };
    users.push(user);
  }

  const nextState = { ...state, clients: [company, ...state.clients], users };
  await writeState(nextState);
  response.status(201).json({ company, user: publicUser(user), state: publicState(nextState) });
});

app.put("/api/companies/:id", requireAuth, requireAdmin, async (request, response) => {
  const state = await readState();
  const existing = state.clients.find((client) => client.id === request.params.id);
  if (!existing) return response.status(404).json({ error: "Company not found." });
  if (request.body?.email && !validateEmail(request.body.email)) {
    return response.status(400).json({ error: "Enter a valid email address." });
  }

  const company = { ...existing, ...request.body, id: existing.id, ...(request.body?.phone !== undefined ? { phone: normalizePhone(request.body.phone) } : {}) };
  const nextState = { ...state, clients: state.clients.map((client) => (client.id === existing.id ? company : client)) };
  await writeState(nextState);
  response.json(company);
});

app.put("/api/clients/:id/credentials", requireAuth, requireAdmin, async (request, response) => {
  const clientId = request.params.id;
  const { email, password } = request.body || {};

  if (!validateEmail(email)) {
    return response.status(400).json({ error: "Enter a valid login email address." });
  }
  if (password) {
    const passwordError = validatePassword(password);
    if (passwordError) return response.status(400).json({ error: passwordError });
  }

  const state = await readState();
  const targetUser = state.users.find((user) => user.role === "client" && user.clientId === clientId);
  if (!targetUser) {
    return response.status(404).json({ error: "Client login user not found." });
  }

  const duplicateUser = state.users.find(
    (user) => user.id !== targetUser.id && user.email.toLowerCase() === String(email).trim().toLowerCase()
  );
  if (duplicateUser) {
    return response.status(400).json({ error: "That login email is already in use." });
  }

  const updatedUser = {
    ...targetUser,
    email: String(email).trim(),
    ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {})
  };
  delete updatedUser.password;

  const nextState = {
    ...state,
    users: state.users.map((user) => (user.id === targetUser.id ? updatedUser : user))
  };
  await writeState(nextState);

  response.json({ user: publicUser(updatedUser), state: publicState(nextState) });
});

app.delete("/api/companies/:id", requireAuth, requireAdmin, async (request, response) => {
  const state = await readState();
  if (state.assets.some((asset) => asset.clientId === request.params.id)) {
    return response.status(409).json({ error: "Move or delete assigned assets before deleting this company." });
  }
  const nextState = {
    ...state,
    clients: state.clients.filter((client) => client.id !== request.params.id),
    users: state.users.filter((user) => user.clientId !== request.params.id)
  };
  await writeState(nextState);
  response.status(204).end();
});

app.get("/api/assets", requireAuth, async (request, response) => {
  const state = await readState();
  response.json(scopedAssets(state, request.auth));
});

app.post("/api/assets", requireAuth, requireAdmin, async (request, response) => {
  const state = await readState();
  const form = request.body || {};
  if (!form.assetCode || !form.name || !form.clientId) {
    return response.status(400).json({ error: "Asset code, name, and company are required." });
  }
  if (!state.clients.some((client) => client.id === form.clientId)) {
    return response.status(400).json({ error: "Company does not exist." });
  }

  const asset = {
    id: form.id || uid("a"),
    assetCode: form.assetCode,
    clientId: form.clientId,
    name: form.name,
    category: form.category || "",
    brand: form.brand || "",
    model: form.model || "",
    serialNumber: form.serialNumber || "",
    purchaseDate: form.purchaseDate || "",
    warrantyEndDate: form.warrantyEndDate || "",
    location: form.location || "",
    status: form.status || "active",
    notes: form.notes || "",
    images: form.images || (form.image ? [form.image] : []),
    documents: form.documents || [],
    lifecycle: form.lifecycle || []
  };
  const nextState = { ...state, assets: [asset, ...state.assets] };
  await writeState(nextState);
  response.status(201).json(asset);
});

app.put("/api/assets/:id", requireAuth, requireAdmin, async (request, response) => {
  const state = await readState();
  const existing = state.assets.find((asset) => asset.id === request.params.id);
  if (!existing) return response.status(404).json({ error: "Asset not found." });
  const asset = { ...existing, ...request.body, id: existing.id };
  const nextState = { ...state, assets: state.assets.map((item) => (item.id === existing.id ? asset : item)) };
  await writeState(nextState);
  response.json(asset);
});

app.delete("/api/assets/:id", requireAuth, requireAdmin, async (request, response) => {
  const state = await readState();
  const nextState = {
    ...state,
    assets: state.assets.filter((asset) => asset.id !== request.params.id),
    serviceRecords: state.serviceRecords.filter((record) => record.assetId !== request.params.id),
    appeals: state.appeals.filter((appeal) => appeal.assetId !== request.params.id),
    appealMessages: state.appealMessages.filter((message) => state.appeals.find((appeal) => appeal.id === message.appealId)?.assetId !== request.params.id)
  };
  await writeState(nextState);
  response.status(204).end();
});

app.get("/api/service-records", requireAuth, async (request, response) => {
  const state = await readState();
  const allowedAssetIds = new Set(scopedAssets(state, request.auth).map((asset) => asset.id));
  response.json(state.serviceRecords.filter((record) => allowedAssetIds.has(record.assetId)));
});

app.post("/api/service-records", requireAuth, requireAdmin, async (request, response) => {
  const state = await readState();
  const form = request.body || {};
  if (!form.assetId || !form.serviceType || !form.description) {
    return response.status(400).json({ error: "Asset, service type, and description are required." });
  }
  const record = {
    id: form.id || uid("s"),
    assetId: form.assetId,
    serviceDate: form.serviceDate || new Date().toISOString().slice(0, 10),
    serviceType: form.serviceType,
    technicianName: form.technicianName || "",
    description: form.description,
    nextServiceDue: form.nextServiceDue || "",
    status: form.status || "completed"
  };
  const nextState = { ...state, serviceRecords: [record, ...state.serviceRecords] };
  await writeState(nextState);
  response.status(201).json(record);
});

app.get("/api/appeals", requireAuth, async (request, response) => {
  const state = await readState();
  response.json(scopedAppeals(state, request.auth));
});

app.post("/api/appeals", requireAuth, async (request, response) => {
  const state = await readState();
  const form = request.body || {};
  const asset = state.assets.find((item) => item.id === form.assetId);
  if (!asset) return response.status(404).json({ error: "Asset not found." });
  if (!canAccessClient(request.auth, asset.clientId)) return response.status(403).json({ error: "Asset access denied." });

  const now = new Date().toISOString();
  const appeal = {
    id: form.id || uid("ap"),
    assetId: asset.id,
    clientId: asset.clientId,
    raisedBy: request.auth.sub,
    title: form.title,
    description: form.description || "",
    priority: form.priority || "medium",
    status: "open",
    createdAt: now,
    updatedAt: now
  };
  const nextState = { ...state, appeals: [appeal, ...state.appeals] };
  await writeState(nextState);
  response.status(201).json({ appeal });
});

app.put("/api/appeals/:id", requireAuth, requireAdmin, async (request, response) => {
  const state = await readState();
  const existing = state.appeals.find((appeal) => appeal.id === request.params.id);
  if (!existing) return response.status(404).json({ error: "Appeal not found." });
  const appeal = { ...existing, ...request.body, id: existing.id, updatedAt: new Date().toISOString() };
  const nextState = { ...state, appeals: state.appeals.map((item) => (item.id === existing.id ? appeal : item)) };
  await writeState(nextState);
  response.json(appeal);
});

app.delete("/api/appeals/:id", requireAuth, async (request, response) => {
  const state = await readState();
  const existing = state.appeals.find((appeal) => appeal.id === request.params.id);
  if (!existing) return response.status(404).json({ error: "Appeal not found." });
  if (!canAccessClient(request.auth, existing.clientId)) {
    return response.status(403).json({ error: "Appeal access denied." });
  }

  const nextState = {
    ...state,
    appeals: state.appeals.filter((appeal) => appeal.id !== existing.id),
    appealMessages: state.appealMessages.filter((message) => message.appealId !== existing.id)
  };
  await writeState(nextState);
  response.status(204).end();
});

app.post("/api/appeals/:id/messages", requireAuth, (_request, response) => {
  response.status(410).json({ error: "Appeal chat updates are disabled." });
});

app.get("/api/files", requireAuth, requireAdmin, async (_request, response) => {
  const state = await readState();
  const referenced = collectReferencedUploadUrls(state);
  const files = await listUploadedFiles();
  response.json(files.map((file) => ({ ...file, referenced: referenced.has(file.url), deleted: Boolean(file.deletedAt) })));
});

app.post("/api/files/cleanup", requireAuth, requireAdmin, async (request, response) => {
  const dryRun = request.body?.dryRun !== false;
  const state = await readState();
  const referenced = collectReferencedUploadUrls(state);
  const files = (await listUploadedFiles()).filter((file) => !file.deletedAt && !referenced.has(file.url));
  const cleaned = [];

  if (!dryRun) {
    for (const file of files) {
      await deleteUploadedFile(file);
      cleaned.push(file.id);
    }
  }

  response.json({
    dryRun,
    orphanCount: files.length,
    cleanedCount: cleaned.length,
    files: files.map((file) => ({ id: file.id, originalName: file.originalName, url: file.url, sizeBytes: file.sizeBytes }))
  });
});

app.delete("/api/files/:id", requireAuth, requireAdmin, async (request, response) => {
  const files = await listUploadedFiles();
  const file = files.find((item) => item.id === request.params.id && !item.deletedAt);
  if (!file) return response.status(404).json({ error: "File not found." });
  const referenced = collectReferencedUploadUrls(await readState());
  if (referenced.has(file.url)) {
    return response.status(409).json({ error: "File is still referenced by an asset, company, or appeal." });
  }
  await deleteUploadedFile(file);
  response.status(204).end();
});

app.post("/api/upload", requireAuth, (request, response) => {
  upload.single("file")(request, response, async (error) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return response.status(400).json({ error: "File must be 10 MB or smaller." });
    }
    if (error) {
      return response.status(400).json({ error: error.message || "A valid file is required." });
    }
    if (!request.file) {
      return response.status(400).json({ error: "A valid file is required." });
    }

    const publicBaseUrl = process.env.PUBLIC_API_URL || `http://127.0.0.1:${port}`;
    const url = `${publicBaseUrl}/uploads/${request.file.filename}`;
    const record = {
      id: uid("file"),
      uploadedBy: request.auth.sub,
      originalName: request.file.originalname,
      storedName: request.file.filename,
      mimeType: request.file.mimetype,
      sizeBytes: request.file.size,
      url,
      entityType: request.body?.entityType,
      entityId: request.body?.entityId
    };
    await createUploadedFile(record);

    response.json({
      id: record.id,
      fileName: request.file.originalname,
      mimeType: request.file.mimetype,
      size: request.file.size,
      url
    });
  });
});

if (process.env.NODE_ENV === "production" && fs.existsSync(distRoot)) {
  app.use(express.static(distRoot));
  app.get("*", (request, response, next) => {
    if (request.path.startsWith("/api/") || request.path.startsWith("/uploads/")) {
      return next();
    }
    response.sendFile(path.join(distRoot, "index.html"));
  });
}

ensureSchema()
  .then(() => {
    const server = app.listen(port, () => {
      console.log(`HAAK Asset API listening on http://127.0.0.1:${port}`);
    });
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use. Stop the existing API process or set API_PORT to another port.`);
      } else {
        console.error("API server listener failed");
        console.error(error);
      }
      process.exit(1);
    });
  })
  .catch((error) => {
    console.error("Failed to start API server");
    console.error(error);
    process.exit(1);
  });
