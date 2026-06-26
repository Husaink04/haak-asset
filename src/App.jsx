import {
  AlertCircle,
  Archive,
  Bell,
  Building2,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  FileText,
  History,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Moon,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  UserRound,
  Wifi,
  WifiOff
} from "lucide-react";
import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";

const STORE_KEY = "haak-asset-management-state-v1";
const TOKEN_KEY = "haak-asset-management-token-v1";
const USER_KEY = "haak-asset-management-user-v1";
const VIEW_KEY = "haak-asset-management-view-v1";
const PENDING_STATE_KEY = "haak-asset-management-pending-state-v1";
const THEME_KEY = "haak-asset-management-theme-v1";
const API_URL = normalizeApiUrl(import.meta.env?.VITE_API_URL);
const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_BYTES = Number(import.meta.env?.VITE_MAX_UPLOAD_BYTES || DEFAULT_MAX_UPLOAD_BYTES);
const MAX_UPLOAD_MB = Math.max(1, Math.round(MAX_UPLOAD_BYTES / (1024 * 1024)));
const PASSWORD_ROTATION_DAYS = 90;
const FRIENDLY_ERROR_MESSAGE = "Something went wrong. Please try again.";
const DEFAULT_ADMIN_ALERT_EMAIL = "huzefarampurawala9@gmail.com";
const AMC_TERMS = [
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "2Y", months: 24 },
  { label: "3Y", months: 36 }
];
const SERVICE_DUE_TERMS = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 }
];
const IMAGE_UPLOAD_TYPES = new Set(["image/jpeg", "image/png"]);
const DOCUMENT_UPLOAD_TYPES = new Set([
  "application/pdf",
  "application/msword"
]);

function normalizeApiUrl(value) {
  const raw = String(value || "").trim();
  if (raw) return raw.replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/api`;
  }
  return "/api";
}

const seedState = {
  settings: {
    adminAlertEmail: DEFAULT_ADMIN_ALERT_EMAIL
  },
  assetCategories: ["Laptop", "Printer"],
  credentialRequests: [],
  engineers: [],
  notifications: [],
  users: [
    { id: "u-admin", name: "HAAK Admin", email: "admin@haakinfotech.com", password: "admin123", role: "admin" },
    { id: "u-client", name: "Client Manager", email: "client@example.com", password: "client123", role: "client", clientId: "c-1" }
  ],
  clients: [
    {
      id: "c-1",
      companyName: "Apex Manufacturing Pvt Ltd",
      contactPerson: "Client Manager",
      email: "client@example.com",
      phone: "+91 98765 43210",
      address: "Coimbatore, Tamil Nadu",
      logoUrl: "",
      assetCategories: ["Laptop", "Printer"],
      amcStartDate: "2026-06-01",
      amcEndDate: "2027-06-01",
      amcTerm: "1Y",
      amcRenewalNoticeSentAt: "",
      status: "active"
    }
  ],
  assets: [
    {
      id: "a-1",
      assetCode: "HAAK-LAP-001",
      clientId: "c-1",
      name: "Dell Latitude 5440",
      category: "Laptop",
      brand: "Dell",
      model: "Latitude 5440",
      serialNumber: "DL-5440-IN-104",
      purchaseDate: "2025-09-12",
      warrantyEndDate: "2028-09-11",
      location: "Finance Department",
      status: "active",
      notes: "Assigned to finance lead. Includes charger and docking station.",
      images: [
        "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80"
      ],
      documents: ["Invoice INV-2025-241", "Warranty Certificate"],
      lifecycle: [
        { id: "l-1", type: "Purchased", description: "Asset purchased by HAAK INFOTECH.", createdAt: "2025-09-12" },
        { id: "l-2", type: "Assigned", description: "Assigned to Apex Manufacturing.", createdAt: "2025-09-14" }
      ]
    },
    {
      id: "a-2",
      assetCode: "HAAK-PRN-004",
      clientId: "c-1",
      name: "HP LaserJet Pro",
      category: "Printer",
      brand: "HP",
      model: "M404dn",
      serialNumber: "HP-M404-8821",
      purchaseDate: "2024-04-03",
      warrantyEndDate: "2027-04-02",
      location: "Admin Office",
      status: "in_service",
      notes: "Paper feed roller replacement scheduled.",
      images: [
        "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&w=900&q=80"
      ],
      documents: ["Service Manual"],
      lifecycle: [
        { id: "l-3", type: "Purchased", description: "Printer purchased and tagged.", createdAt: "2024-04-03" },
        { id: "l-4", type: "Service", description: "Moved to in-service state.", createdAt: "2026-05-24" }
      ]
    }
  ],
  serviceRecords: [
    {
      id: "s-1",
      assetId: "a-1",
      serviceDate: "2026-02-10",
      serviceType: "Inspection",
      technicianName: "R. Karthik",
      description: "Battery health checked, firmware updated, and device cleaned.",
      nextServiceDue: "2026-08-10",
      status: "completed"
    },
    {
      id: "s-2",
      assetId: "a-2",
      serviceDate: "2026-05-24",
      serviceType: "Repair",
      technicianName: "S. Priya",
      description: "Paper jam diagnosed. Roller replacement required.",
      nextServiceDue: "2026-06-18",
      status: "pending"
    }
  ],
  appeals: [
    {
      id: "ap-1",
      assetId: "a-2",
      clientId: "c-1",
      assignedEngineerId: null,
      raisedBy: "u-client",
      title: "Printer paper feed issue",
      description: "Printer pulls multiple sheets during invoice printing.",
      priority: "high",
      status: "in_review",
      createdAt: "2026-05-24T10:00:00.000Z",
      updatedAt: "2026-05-25T14:15:00.000Z"
    }
  ],
  appealMessages: [
    {
      id: "m-1",
      appealId: "ap-1",
      senderId: "u-client",
      message: "The issue started after the last toner replacement.",
      createdAt: "2026-05-24T10:05:00.000Z"
    },
    {
      id: "m-2",
      appealId: "ap-1",
      senderId: "u-admin",
      message: "Technician inspected the printer. Roller replacement is scheduled.",
      createdAt: "2026-05-25T14:15:00.000Z"
    }
  ]
};

function loadState() {
  const saved = localStorage.getItem(STORE_KEY);
  if (!saved) return seedState;
  try {
    const parsed = JSON.parse(saved);
    const derivedCategories = [...new Set((parsed.assets || []).map((asset) => asset.category).filter(Boolean))];
    const fallbackCategories = parsed.assetCategories?.length ? parsed.assetCategories : (derivedCategories.length ? derivedCategories : seedState.assetCategories);
    return {
      ...seedState,
      ...parsed,
      settings: {
        ...seedState.settings,
        ...(parsed.settings || {})
      },
      assetCategories: fallbackCategories,
      clients: (parsed.clients || seedState.clients).map((client) => ({
        ...client,
        assetCategories: client.assetCategories?.length ? client.assetCategories : fallbackCategories,
        amcStartDate: client.amcStartDate || "",
        amcEndDate: client.amcEndDate || "",
        amcTerm: client.amcTerm || "",
        amcRenewalNoticeSentAt: client.amcRenewalNoticeSentAt || ""
      })),
      credentialRequests: parsed.credentialRequests || [],
      engineers: parsed.engineers || [],
      notifications: parsed.notifications || []
    };
  } catch {
    return seedState;
  }
}

function saveState(nextState) {
  localStorage.setItem(STORE_KEY, JSON.stringify(nextState));
}

function loadStoredUser() {
  const saved = localStorage.getItem(USER_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function saveStoredUser(nextUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
}

function normalizeView(nextView, user) {
  const allowedViews = user?.role === "admin"
    ? new Set(["dashboard", "companies", "assets", "appeals", "service", "settings"])
    : new Set(["dashboard", "assets", "appeals", "service", "settings"]);
  return allowedViews.has(nextView) ? nextView : "dashboard";
}

function loadStoredView(user) {
  return normalizeView(localStorage.getItem(VIEW_KEY), user);
}

function saveStoredView(nextView) {
  localStorage.setItem(VIEW_KEY, nextView);
}

function loadStoredTheme() {
  return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

function loadPendingState() {
  const saved = localStorage.getItem(PENDING_STATE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    localStorage.removeItem(PENDING_STATE_KEY);
    return null;
  }
}

function queuePendingState(nextState) {
  localStorage.setItem(PENDING_STATE_KEY, JSON.stringify({ state: nextState, queuedAt: new Date().toISOString() }));
}

function clearPendingState() {
  localStorage.removeItem(PENDING_STATE_KEY);
}

function isConflictError(error) {
  return error?.isApiError && error?.status === 409;
}

function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(VIEW_KEY);
}

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const isFormData = options.body instanceof FormData;
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      },
      ...options
    });
  } catch (error) {
    const friendlyError = new Error(FRIENDLY_ERROR_MESSAGE);
    friendlyError.isNetworkError = true;
    friendlyError.cause = error;
    throw friendlyError;
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      clearStoredSession();
      window.setTimeout(() => window.location.reload(), 0);
    }
    const error = new Error(body.error || "API request failed.");
    error.status = response.status;
    error.detail = body.detail;
    error.isApiError = true;
    throw error;
  }
  return body;
}

function friendlyErrorMessage(error, fallback = FRIENDLY_ERROR_MESSAGE) {
  if (error?.isNetworkError) return fallback;
  if (error?.isApiError) {
    return [error.message, error.detail].filter(Boolean).join(" ");
  }
  return error?.message || fallback;
}

function uploadErrorMessage(error) {
  if (error?.message?.startsWith("File must be") || error?.message?.startsWith("Images must be") || error?.message?.startsWith("Unsupported")) {
    return error.message;
  }
  if (error?.isApiError && error.message) {
    return error.message;
  }
  if (error?.isNetworkError) {
    return "Could not reach the upload server. Please restart the app and try again.";
  }
  return "Something went wrong while uploading. Please try again.";
}

async function checkApiHealth() {
  await apiRequest("/health");
}

function validateUploadFile(file) {
  if (!file) {
    throw new Error("A valid file is required.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File must be ${MAX_UPLOAD_MB} MB or smaller.`);
  }
  const isImage = file.type.startsWith("image/");
  if (isImage && !IMAGE_UPLOAD_TYPES.has(file.type)) {
    throw new Error("Images must be JPG or PNG.");
  }
  if (!isImage && !DOCUMENT_UPLOAD_TYPES.has(file.type)) {
    throw new Error("Unsupported document type.");
  }
}

async function uploadFile(file) {
  if (!localStorage.getItem(TOKEN_KEY)) {
    throw new Error("Sign in again before uploading.");
  }
  validateUploadFile(file);
  const formData = new FormData();
  formData.append("file", file);
  try {
    return await apiRequest("/upload", {
      method: "POST",
      body: formData
    });
  } catch (error) {
    throw new Error(formatUploadError(error, "file"));
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(dateString, months) {
  const base = dateString ? new Date(`${dateString}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return "";
  base.setMonth(base.getMonth() + months);
  return base.toISOString().slice(0, 10);
}

function monthsForTerm(term, options = AMC_TERMS) {
  return options.find((item) => item.label === term)?.months || options[0]?.months || 1;
}

function clientCategories(client, fallbackCategories = []) {
  return client?.assetCategories?.length ? client.assetCategories : fallbackCategories;
}

function isPriorityAsset(asset) {
  return ["in_service", "repairing", "damaged"].includes(asset.status);
}

function isPriorityServiceRecord(record) {
  return ["repairing", "pending", "in_service"].includes(record.status);
}

function isPriorityAppeal(appeal) {
  return ["critical", "high"].includes(appeal.priority) || ["open", "in_review", "awaiting_client"].includes(appeal.status);
}

function isWithinAmcEditWindow(client) {
  if (!client?.amcEndDate) return true;
  const endDate = new Date(`${client.amcEndDate}T00:00:00`);
  if (Number.isNaN(endDate.getTime())) return true;
  const todayDate = new Date(`${today()}T00:00:00`);
  const daysLeft = Math.ceil((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysLeft >= 0 && daysLeft <= 10;
}

function formatTimestamp(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day} ${month} ${year}, ${hours}:${minutes} ${period}`;
}

function formatCalendarDate(value) {
  if (!value) return "Not set";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T00:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function fileNameFromUrl(value) {
  if (!value) return "Uploaded file";
  try {
    return decodeURIComponent(new URL(value).pathname.split("/").pop() || value);
  } catch {
    return String(value).split("/").pop() || value;
  }
}

function resolveMediaUrl(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (raw.startsWith("/uploads/")) return raw;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.pathname.startsWith("/uploads/")) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return raw.startsWith("/") ? raw : url.href;
  } catch {
    return raw;
  }
}

function documentLabel(value) {
  if (!value) return "Document";
  const raw = String(value).trim();
  if (!raw) return "Document";
  if (raw.startsWith("http") || raw.startsWith("/uploads/")) {
    return fileNameFromUrl(raw);
  }
  return raw;
}

function isDocumentLink(value) {
  const raw = String(value || "").trim();
  return raw.startsWith("http") || raw.startsWith("/uploads/");
}

function formatUploadError(error, kind = "file") {
  if (error?.message) return error.message;
  return `Unable to upload ${kind}. Check the file type, size limit, and API connection.`;
}

function formatLifecycleDescription(item) {
  const description = item?.description || "";
  const type = String(item?.type || item?.serviceType || "").toLowerCase();
  if (type === "document") {
    return description
      .replace(/(^|[\s])\/uploads\/[^\s]+(\sadded\.)?$/i, (_match, prefix = "", suffix = "") => `${prefix}${documentLabel(description)}${suffix || ""}`)
      .replace(/^\/uploads\/.+$/i, documentLabel(description));
  }
  return description;
}

function normalizePhone(value) {
  return String(value || "").replace(/\D+/g, "").slice(0, 10);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+$/.test(String(value || "").trim());
}

function passwordPolicyWarnings(password) {
  if (!password) return [];
  const warnings = [];
  if (!/[A-Z]/.test(password)) warnings.push("uppercase letter");
  if (!/[a-z]/.test(password)) warnings.push("lowercase letter");
  if (!/\d/.test(password)) warnings.push("number");
  if (!/[^A-Za-z0-9]/.test(password)) warnings.push("special character");
  return warnings;
}

function passwordAgeDays(user) {
  if (!user?.passwordChangedAt) return null;
  const changedAt = new Date(user.passwordChangedAt);
  if (Number.isNaN(changedAt.getTime())) return null;
  return Math.floor((Date.now() - changedAt.getTime()) / (1000 * 60 * 60 * 24));
}

function PasswordPolicyHint({ password }) {
  const warnings = passwordPolicyWarnings(password);
  return (
    <div className="password-policy-hint">
      <strong>Password guidance</strong>
      <span>Use at least 8 characters. Uppercase, lowercase, numbers, and special characters are recommended.</span>
      {warnings.length > 0 && <small>Missing recommended: {warnings.join(", ")}.</small>}
      <small>Passwords should be changed every {PASSWORD_ROTATION_DAYS} days.</small>
    </div>
  );
}

function PasswordRotationNotice({ user }) {
  const age = passwordAgeDays(user);
  if (age === null || age < PASSWORD_ROTATION_DAYS) return null;
  return (
    <div className="password-rotation-notice">
      Your password is {age} days old. Please change it as part of the 90-day password policy.
    </div>
  );
}

function codeToken(value, fallback = "GEN") {
  const words = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return fallback;
  if (words.length === 1) return words[0].slice(0, 4);
  return words.slice(0, 3).map((word) => word[0]).join("").slice(0, 4) || fallback;
}

function generateAssetCode(clients, assets, clientId, category, existingId = null) {
  const client = clients.find((item) => item.id === clientId);
  const companyToken = codeToken(client?.companyName, "COMP");
  const categoryToken = codeToken(category, "GEN");
  const prefix = `${companyToken}-${categoryToken}-`;
  const nextSerialNumber = assets
    .filter((asset) => asset.id !== existingId && asset.clientId === clientId && asset.category === category)
    .reduce((highest, asset) => {
      if (!String(asset.assetCode || "").startsWith(prefix)) return highest;
      const serial = Number.parseInt(String(asset.assetCode).slice(prefix.length), 10);
      return Number.isFinite(serial) ? Math.max(highest, serial) : highest;
    }, 0) + 1;
  const nextSerial = String(nextSerialNumber).padStart(3, "0");
  return `${companyToken}-${categoryToken}-${nextSerial}`;
}

function duplicateAssetCodes(assets) {
  const seen = new Set();
  const duplicates = new Set();
  for (const asset of assets || []) {
    const normalized = String(asset?.assetCode || "").trim().toLowerCase();
    if (!normalized) continue;
    if (seen.has(normalized)) duplicates.add(asset.assetCode);
    seen.add(normalized);
  }
  return [...duplicates];
}

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
}

function createNotification(state, details) {
  const client = details.clientId ? state.clients.find((item) => item.id === details.clientId) : null;
  return {
    id: uid("note"),
    type: details.type || "activity",
    title: details.title,
    message: details.message,
    clientId: details.clientId || null,
    companyName: client?.companyName || details.companyName || "",
    actorRole: details.actorRole || "",
    actorName: details.actorName || "",
    entityType: details.entityType || "",
    entityId: details.entityId || "",
    tone: details.tone || "info",
    createdAt: new Date().toISOString(),
    readBy: []
  };
}

function withNotification(state, details) {
  const notification = createNotification(state, details);
  return {
    ...state,
    notifications: [notification, ...(state.notifications || [])].slice(0, 500)
  };
}

function scopedNotifications(notifications, user) {
  const items = notifications || [];
  if (user.role === "admin") return items;
  return items.filter((item) => item.clientId === user.clientId);
}

function unreadNotificationCount(notifications, user) {
  if (!user) return 0;
  return scopedNotifications(notifications, user).filter((notification) => !(notification.readBy || []).includes(user.id)).length;
}

function statusClass(status) {
  return `badge ${String(status || "open").replace("_", "-")}`;
}

function formatStatusLabel(status) {
  const safeStatus = String(status || "open");
  const labels = {
    in_service: "In service",
    in_review: "In review",
    awaiting_client: "Waiting to Client's approval",
    closed: "Closed/Cancelled",
    approved: "Approved",
    pending: "Repairing",
    completed: "Repaired",
    repairing: "Repairing",
    repaired: "Repaired"
  };
  return labels[safeStatus] || safeStatus.replace(/_/g, " ");
}

function sortByNewestDate(items, key) {
  return [...items].sort((first, second) => String(second[key] || "").localeCompare(String(first[key] || "")));
}

function getScopedServiceRecords(records, assets) {
  const allowedAssetIds = new Set(assets.map((asset) => asset.id));
  return records.filter((record) => allowedAssetIds.has(record.assetId));
}

function getLatestServiceRecord(records, assetId) {
  return sortByNewestDate(
    records.filter((record) => record.assetId === assetId),
    "serviceDate"
  )[0] || null;
}

function LoginCard({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const result = await onLogin(email.trim(), password);
    setIsSubmitting(false);
    if (result !== true) setError(result || "Invalid email or password.");
  }

  return (
    <form className="login-panel" onSubmit={submit}>
      <div className="login-card-head">
        <div className="login-icon"><ShieldCheck size={28} /></div>
        <div>
          <span className="eyebrow">Secure portal</span>
          <h2>Sign in</h2>
          <p>Use your HAAK Admin or company account.</p>
        </div>
      </div>
      <label className="field-label">
        Email address
        <span className="input-shell">
          <Mail size={18} />
          <input
            type="email"
            autoComplete="email"
            placeholder="name@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </span>
      </label>
      <label className="field-label">
        Password
        <span className="input-shell">
          <LockKeyhole size={18} />
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button type="button" className="icon-button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>
      {error && <div className="form-error">{error}</div>}
      <button className="primary login-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
      <div className="login-meta">
        <span><ShieldCheck size={15} /> JWT secured</span>
        <span><Smartphone size={15} /> PWA ready</span>
      </div>
    </form>
  );
}

function LoginScreen({ onLogin }) {
  return (
    <main className="login-page">
      <section className="brand-panel">
        <div>
          <img className="brand-logo" src="/haak-logo-transparent.png" alt="HAAK INFOTECH" />
          <span className="eyebrow">HAAK INFOTECH</span>
          <h1>Asset Management</h1>
          <p>Track assets, service history, documents, and company issue workflows from a secure PWA.</p>
        </div>
        <div className="feature-grid">
          <span><Archive size={18} /> Asset lifecycle</span>
          <span><History size={18} /> Service history</span>
          <span><Camera size={18} /> Asset images</span>
          <span><Smartphone size={18} /> Offline PWA</span>
        </div>
      </section>
      <section className="login-grid">
        <LoginCard onLogin={onLogin} />
      </section>
    </main>
  );
}

function AdminIdentityBadge({ apiStatus }) {
  const isOnline = apiStatus === "connected";
  return (
    <div className={`admin-identity-chip ${isOnline ? "online" : "offline"}`} title={isOnline ? "System online" : "Connection issue"}>
      {isOnline ? <Wifi size={17} /> : <WifiOff size={17} />}
      <span>
        <strong>System status</strong>
        <small>{isOnline ? "Live sync" : "Offline mode"}</small>
      </span>
    </div>
  );
}

function NotificationCenter({ user, notifications, unreadCount, onMarkRead, onClear }) {
  return (
    <div className="notification-center">
      <div className="notification-center-head">
        <div>
          <span className="eyebrow">{user.role === "admin" ? "All company activity" : "Company activity"}</span>
          <h2>Notifications</h2>
        </div>
        <span className={unreadCount > 0 ? "badge open" : "badge active"}>{unreadCount} unread</span>
      </div>
      <div className="notification-actions">
        <button className="secondary" type="button" onClick={onMarkRead} disabled={notifications.length === 0 || unreadCount === 0}>Mark all read</button>
        <button className="danger compact-danger" type="button" onClick={onClear} disabled={notifications.length === 0}>Clear notifications</button>
      </div>
      <div className="notification-list notification-center-list">
        {notifications.length > 0 ? notifications.map((notification) => {
          const isUnread = !(notification.readBy || []).includes(user.id);
          return (
            <article key={notification.id} className={`notification-card ${notification.tone || "info"} ${isUnread ? "unread" : "read"}`}>
              <div className="notification-icon"><Bell size={17} /></div>
              <div>
                <div className="notification-card-head">
                  <strong>{notification.title}</strong>
                  <small>{formatTimestamp(notification.createdAt)}</small>
                </div>
                <p>{notification.message}</p>
                <div className="notification-meta">
                  {isUnread && <span>Unread</span>}
                  {notification.companyName && <span>{notification.companyName}</span>}
                  {notification.actorRole && <span>{notification.actorRole}</span>}
                  {notification.entityType && <span>{notification.entityType}</span>}
                </div>
              </div>
            </article>
          );
        }) : (
          <div className="empty-state compact-empty-state">
            <Bell size={28} />
            <h2>No notifications</h2>
            <p>Alerts and activity updates will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Shell({ user, children, view, setView, onLogout, headerAction, notice, clientBrand, apiStatus = "offline", theme = "light", onToggleTheme, notifications = [], unreadCount = 0, onMarkNotificationsRead, onClearNotifications }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(() => window.matchMedia("(max-width: 1180px)").matches);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isDarkTheme = theme === "dark";
  const shellCollapsed = sidebarCollapsed && !isCompactViewport;
  const nav = user.role === "admin"
    ? [
        ["dashboard", "Dashboard", Archive],
        ["companies", "Companies", Building2],
        ["assets", "Assets", FileText],
        ["appeals", "Appeals", MessageSquare],
        ["service", "Service", History],
        ["settings", "Settings", ShieldCheck]
      ]
    : [
        ["dashboard", "Dashboard", Archive],
        ["assets", "My Assets", FileText],
        ["appeals", "Issues", MessageSquare],
        ["service", "Service History", History],
      ["settings", "Settings", ShieldCheck]
    ];

  useEffect(() => {
    localStorage.setItem("haak-sidebar-collapsed", sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1180px)");
    const syncViewport = (event) => setIsCompactViewport(event.matches);
    setIsCompactViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    setShowNotifications(false);
  }, [view]);

  useEffect(() => {
    if (!isCompactViewport) setMobileNavOpen(false);
  }, [isCompactViewport]);

  async function hardRefresh() {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.update()));
      }
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }
    } finally {
      window.location.reload();
    }
  }

  function selectView(nextView) {
    setView(nextView);
    if (isCompactViewport) setMobileNavOpen(false);
  }

  return (
    <>
      <Toaster richColors closeButton position="top-right" />
      <div className={`app-shell ${user.role}-shell ${shellCollapsed ? "sidebar-collapsed" : ""} ${isCompactViewport ? "mobile-shell" : ""} ${mobileNavOpen ? "mobile-nav-open" : "mobile-nav-closed"}`}>
      <aside>
        <div className="sidebar-top">
          <div className="logo">
            <img src="/haak-logo-transparent.png" alt="HAAK INFOTECH" />
            <div className="logo-copy">
              <strong className="logo-label">Asset Management</strong>
              <small>{user.role === "admin" ? "Admin workspace" : "Client workspace"}</small>
            </div>
          </div>
          <button
            className="mobile-menu-toggle"
            type="button"
            onClick={() => setMobileNavOpen((current) => !current)}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileNavOpen}
          >
            <Menu size={18} />
            <span>{mobileNavOpen ? "Close" : "Menu"}</span>
          </button>
        </div>
        <div className="sidebar-section-label">Main</div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button key={id} className={view === id ? "active" : ""} onClick={() => selectView(id)} title={shellCollapsed ? label : undefined} aria-label={label}>
              <Icon size={18} />
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-actions">
          <div className="sidebar-section-label">Preferences</div>
          <button
            className="collapse-toggle"
            type="button"
            onClick={() => isCompactViewport ? setMobileNavOpen((current) => !current) : setSidebarCollapsed((current) => !current)}
            aria-label={shellCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={shellCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={isCompactViewport ? mobileNavOpen : !shellCollapsed}
          >
            {(isCompactViewport ? !mobileNavOpen : shellCollapsed) ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            <span>{isCompactViewport ? (mobileNavOpen ? "Collapse" : "Expand") : (shellCollapsed ? "Expand" : "Collapse")}</span>
          </button>
          <button
            className="theme-toggle"
            type="button"
            onClick={onToggleTheme}
            aria-label={isDarkTheme ? "Switch to light mode" : "Switch to dark mode"}
            title={isDarkTheme ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={isDarkTheme}
          >
            {isDarkTheme ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="logout" onClick={onLogout} title={shellCollapsed ? "Logout" : undefined} aria-label="Logout"><LogOut size={18} /> <span>Logout</span></button>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <div className="page-heading">
            <span className="eyebrow">{user.role === "admin" ? "Admin portal" : "Client portal"}</span>
            <h1>{view === "dashboard" ? "Dashboard" : view[0].toUpperCase() + view.slice(1)}</h1>
          </div>
          <div className="header-actions">
            {headerAction}
            <button className="refresh-button" type="button" onClick={hardRefresh} aria-label="Hard refresh app" title="Hard refresh app">
              <RefreshCw size={18} />
              <span>Refresh</span>
            </button>
            <div className="notification-shell">
              <button className={`notification-bell-button ${showNotifications ? "active" : ""}`} type="button" onClick={() => setShowNotifications((current) => !current)} aria-label="Open notifications" aria-expanded={showNotifications}>
                <Bell size={18} />
                {unreadCount > 0 && <span>{unreadCount}</span>}
              </button>
              {showNotifications && (
                <NotificationCenter
                  user={user}
                  notifications={notifications}
                  unreadCount={unreadCount}
                  onMarkRead={onMarkNotificationsRead}
                  onClear={onClearNotifications}
                />
              )}
            </div>
            {user.role === "admin" ? <AdminIdentityBadge apiStatus={apiStatus} /> : null}
            {clientBrand ? (
              <div className="client-brand-chip">
                <CompanyLogo client={clientBrand} />
                <span>
                  <strong>{clientBrand.companyName}</strong>
                  <small>{clientBrand.contactPerson || "Client portal"}</small>
                </span>
              </div>
            ) : null}
          </div>
        </header>
        {notice ? (
          <div className={`app-toast ${notice.tone || "success"}`} role="status" aria-live="polite">
            <CheckCircle2 size={16} />
            <span>{notice.message}</span>
          </div>
        ) : null}
        {children}
      </div>
      </div>
    </>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="stat">
      <div>{icon}</div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function CollapsiblePanel({ eyebrow, title, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`panel dashboard-panel collapsible-panel ${open ? "open" : "collapsed"}`}>
      <div className="panel-head">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        <div className="panel-head-actions">
          {badge}
          <button className="secondary icon-text-button" type="button" onClick={() => setOpen((current) => !current)}>
            {open ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            {open ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
      {open && children}
    </div>
  );
}

function CompanyLogo({ client }) {
  if (client.logoUrl) {
    return <img className="company-logo" src={resolveMediaUrl(client.logoUrl)} alt={`${client.companyName} logo`} />;
  }

  return (
    <div className="company-mark">
      <Building2 size={18} />
    </div>
  );
}

function AssetVisual({ asset, className = "" }) {
  const imageUrl = asset.images?.[0];
  if (imageUrl) {
    return <img className={className} src={resolveMediaUrl(imageUrl)} alt={asset.name} />;
  }

  return (
    <div className={`asset-placeholder ${className}`.trim()} aria-hidden="true">
      <Camera size={22} />
    </div>
  );
}

function CompanyForm({ onCreate, className = "" }) {
  const steps = ["Company", "AMC", "Logo", "Login"];
  const [step, setStep] = useState(0);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState(0);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [form, setForm] = useState({
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    logoUrl: "",
    assetCategoriesText: "Laptop, Printer",
    amcStartDate: today(),
    amcTerm: "1Y",
    amcEndDate: addMonths(today(), 12),
    loginEmail: "",
    loginPassword: ""
  });

  function update(field, value) {
    setForm((current) => {
      const sanitizedValue = field === "phone" ? normalizePhone(value) : field === "address" ? value.slice(0, 150) : value;
      const next = { ...current, [field]: sanitizedValue };
      if (field === "email" && !current.loginEmail) next.loginEmail = value;
      if (field === "amcStartDate" || field === "amcTerm") {
        const startDate = field === "amcStartDate" ? sanitizedValue : current.amcStartDate;
        const term = field === "amcTerm" ? sanitizedValue : current.amcTerm;
        next.amcEndDate = addMonths(startDate, monthsForTerm(term));
      }
      return next;
    });
  }

  async function uploadLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setUploadError("");
    try {
      const result = await uploadFile(file);
      update("logoUrl", result.url);
    } catch (error) {
      setUploadError(uploadErrorMessage(error));
    } finally {
      setUploadingLogo(false);
      event.target.value = "";
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!isValidEmail(form.email) || !isValidEmail(form.loginEmail)) {
      setUploadError("Enter a valid client and login email address.");
      return;
    }
    const created = await onCreate(form);
    if (created === false) return;
    setForm({
      companyName: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      logoUrl: "",
      assetCategoriesText: "Laptop, Printer",
      amcStartDate: today(),
      amcTerm: "1Y",
      amcEndDate: addMonths(today(), 12),
      loginEmail: "",
      loginPassword: ""
    });
    setStep(0);
    setMaxUnlockedStep(0);
  }

  function canContinue() {
    if (step === 0) return Boolean(form.companyName.trim() && form.contactPerson.trim() && form.email.trim());
    if (step === 1) return Boolean(form.amcStartDate && form.amcTerm);
    if (step === 2) return true;
    return Boolean(form.loginEmail.trim() && form.loginPassword.trim());
  }

  function goToStep(index) {
    if (index <= maxUnlockedStep) {
      setStep(index);
    }
  }

  function goForward() {
    const nextStep = Math.min(step + 1, steps.length - 1);
    setMaxUnlockedStep((current) => Math.max(current, nextStep));
    setStep(nextStep);
  }

  return (
    <form className={`panel asset-wizard company-wizard ${className}`.trim()} onSubmit={submit}>
      <div className="panel-head">
        <div>
          <span className="eyebrow">Step {step + 1} of {steps.length}</span>
          <h2>Add New Company</h2>
        </div>
        <span className="badge active">{steps[step]}</span>
      </div>
      <div className="stepper company-stepper" aria-label="Company creation steps">
        {steps.map((label, index) => (
          <button
            className={index === step ? "step active" : index < step ? "step done" : "step"}
            key={label}
            type="button"
            onClick={() => goToStep(index)}
            disabled={index > maxUnlockedStep}
          >
            <span>{index + 1}</span>
            {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="wizard-step company-wizard-step">
          <h3>Company profile</h3>
          <p>Add the company identity and primary contact details.</p>
          <label>
            Company name
            <input placeholder="Company name" value={form.companyName} onChange={(event) => update("companyName", event.target.value)} required />
          </label>
          <label>
            Contact person
            <input placeholder="Contact person" value={form.contactPerson} onChange={(event) => update("contactPerson", event.target.value)} required />
          </label>
          <label>
            Client email
            <input type="email" placeholder="Client email" value={form.email} onChange={(event) => update("email", event.target.value)} required />
          </label>
          <label>
            Phone
            <input inputMode="numeric" placeholder="Phone" value={form.phone} onChange={(event) => update("phone", event.target.value)} maxLength={10} />
          </label>
          <label>
            Address
            <textarea placeholder="Address" value={form.address} onChange={(event) => update("address", event.target.value)} maxLength={150} />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="wizard-step company-wizard-step">
          <h3>AMC and categories</h3>
          <p>Set the contract period and the asset categories that belong to this company.</p>
          <label>
            AMC starts
            <input type="date" value={form.amcStartDate} onChange={(event) => update("amcStartDate", event.target.value)} />
          </label>
          <label>
            AMC period
            <select value={form.amcTerm} onChange={(event) => update("amcTerm", event.target.value)}>
              {AMC_TERMS.map((term) => <option key={term.label} value={term.label}>{term.label}</option>)}
            </select>
          </label>
          <label>
            AMC ends
            <input type="date" value={form.amcEndDate} onChange={(event) => update("amcEndDate", event.target.value)} />
          </label>
          <label>
            Company categories
            <input placeholder="Laptop, CCTV, Printer" value={form.assetCategoriesText} onChange={(event) => update("assetCategoriesText", event.target.value)} />
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="wizard-step company-wizard-step">
          <h3>Company logo</h3>
          <p>Upload a company logo. It will appear in company records and client pages.</p>
          <label>
            Upload logo
            <input type="file" accept=".jpg,.jpeg,.png" onChange={uploadLogo} disabled={uploadingLogo} />
          </label>
          {uploadingLogo && <small className="upload-note">Uploading logo...</small>}
          {uploadError && <small className="upload-error">{uploadError}</small>}
          <div className="company-logo-preview">
            {form.logoUrl ? <img src={resolveMediaUrl(form.logoUrl)} alt="Company logo preview" /> : <Building2 size={30} />}
            <span>
              <strong>{form.companyName || "Company name"}</strong>
              <small>Logo preview</small>
            </span>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="wizard-step company-wizard-step">
          <h3>Client login</h3>
          <p>Create the login ID and password this company will use in the Client portal.</p>
          <label>
            Login ID
            <input type="email" placeholder="client@company.com" value={form.loginEmail} onChange={(event) => update("loginEmail", event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" placeholder="Create password" value={form.loginPassword} onChange={(event) => update("loginPassword", event.target.value)} required />
          </label>
          <PasswordPolicyHint password={form.loginPassword} />
          <div className="review-box">
            <strong>{form.companyName || "Company name"}</strong>
            <small>Client portal login: {form.loginEmail || "Not set"}</small>
          </div>
        </div>
      )}

      <div className="wizard-actions">
        <button className="secondary" type="button" disabled={step === 0} onClick={() => setStep((current) => current - 1)}>Back</button>
        {step < steps.length - 1 ? (
          <button className="primary" type="button" disabled={!canContinue()} onClick={goForward}>Next step</button>
        ) : (
          <button className="primary" type="submit" disabled={!canContinue()}><Building2 size={16} /> + Add New Company</button>
        )}
      </div>
    </form>
  );
}

function EngineerModal({ engineers, onClose, onCreate, onUpdateStatus }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    status: "active"
  });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: field === "phone" ? normalizePhone(value) : value }));
  }

  function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    onCreate(form);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="engineer-modal-title" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <div>
            <span className="eyebrow">Admin setup</span>
            <h2 id="engineer-modal-title">Add engineer</h2>
          </div>
          <button className="secondary modal-close" type="button" onClick={onClose}>Close</button>
        </div>
        <form className="form-grid engineer-form-grid" onSubmit={submit}>
          <input placeholder="Engineer name" value={form.name} onChange={(event) => update("name", event.target.value)} required />
          <input type="email" placeholder="Engineer email" value={form.email} onChange={(event) => update("email", event.target.value)} />
          <input inputMode="numeric" placeholder="Phone" value={form.phone} onChange={(event) => update("phone", event.target.value)} maxLength={10} />
          <input placeholder="Specialization" value={form.specialization} onChange={(event) => update("specialization", event.target.value)} />
          <select value={form.status} onChange={(event) => update("status", event.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button className="primary" type="submit"><UserRound size={16} /> Save engineer</button>
        </form>
        <div className="engineer-list">
          <h3>Existing engineers</h3>
          {engineers.length > 0 ? engineers.map((engineer) => (
            <div key={engineer.id} className="engineer-row">
              <div>
                <strong>{engineer.name}</strong>
                <small>{engineer.phone || "Phone not added yet"}</small>
              </div>
              <select value={engineer.status} onChange={(event) => onUpdateStatus(engineer.id, event.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )) : <div className="empty-inline">No engineers added yet.</div>}
        </div>
      </div>
    </div>
  );
}

function AssetCategoryManager({ categories, onCreateCategory }) {
  const [name, setName] = useState("");

  function submit(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateCategory(trimmed);
    setName("");
  }

  return (
    <div className="panel asset-category-manager">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Asset setup</span>
          <h2>Asset categories</h2>
        </div>
        <span className="badge active">{categories.length}</span>
      </div>
      <form className="inline-form" onSubmit={submit}>
        <input placeholder="Add category" value={name} onChange={(event) => setName(event.target.value)} />
        <button className="primary" type="submit"><Plus size={16} /> Add category</button>
      </form>
      <div className="category-chip-list">
        {categories.map((category) => <span key={category} className="badge active">{category}</span>)}
      </div>
    </div>
  );
}

function CompanyList({ clients, assets }) {
  return (
    <div className="panel">
      <h2>Companies</h2>
      <div className="company-list">
        {clients.map((client) => (
          <div className="company-row" key={client.id}>
            <CompanyLogo client={client} />
            <span>
              <strong>{client.companyName}</strong>
              <small>{client.contactPerson} - {client.email}</small>
            </span>
            <span className="badge active">{assets.filter((asset) => asset.clientId === client.id).length} assets</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompanyEditor({ client, assets, onUpdate, onDelete }) {
  const [form, setForm] = useState({
    ...client,
    assetCategoriesText: clientCategories(client).join(", "),
    renewalTerm: client.amcTerm || "1Y"
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const assignedAssets = assets.filter((asset) => asset.clientId === client.id);
  const canEditAmc = isWithinAmcEditWindow(client);
  const activeAssetCount = assignedAssets.filter((asset) => asset.status === "active").length;
  const amcLabel = client.amcEndDate ? formatCalendarDate(client.amcEndDate) : "Not set";

  function update(field, value) {
    if (["amcStartDate", "amcTerm", "amcEndDate"].includes(field) && !canEditAmc) return;
    setForm((current) => {
      const sanitizedValue = field === "phone" ? normalizePhone(value) : field === "address" ? value.slice(0, 150) : value;
      const next = { ...current, [field]: sanitizedValue };
      if (field === "amcStartDate" || field === "amcTerm") {
        const startDate = field === "amcStartDate" ? sanitizedValue : current.amcStartDate;
        const term = field === "amcTerm" ? sanitizedValue : current.amcTerm;
        next.amcEndDate = addMonths(startDate, monthsForTerm(term));
      }
      return next;
    });
  }

  function normalizedCompanyForm(nextForm = form) {
    const { assetCategoriesText, renewalTerm, ...company } = nextForm;
    return {
      ...company,
      assetCategories: assetCategoriesText
        .split(",")
        .map((category) => category.trim())
        .filter(Boolean)
    };
  }

  function renewAmc() {
    if (!canEditAmc) return;
    const nextStartDate = form.amcEndDate || today();
    const nextEndDate = addMonths(nextStartDate, monthsForTerm(form.renewalTerm));
    const next = {
      ...form,
      amcStartDate: nextStartDate,
      amcEndDate: nextEndDate,
      amcTerm: form.renewalTerm,
      amcRenewalNoticeSentAt: ""
    };
    setForm(next);
    onUpdate(normalizedCompanyForm(next), "renewed");
  }

  async function uploadLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setUploadError("");
    try {
      const result = await uploadFile(file);
      update("logoUrl", result.url);
    } catch (error) {
      setUploadError(uploadErrorMessage(error));
    } finally {
      setUploadingLogo(false);
      event.target.value = "";
    }
  }

  function submit(event) {
    event.preventDefault();
    if (!isValidEmail(form.email)) {
      setUploadError("Enter a valid client email address.");
      return;
    }
    onUpdate(normalizedCompanyForm());
  }

  return (
    <form className="panel company-editor" onSubmit={submit}>
      <div className="panel-head company-editor-head">
        <div>
          <span className="eyebrow">Company workspace</span>
          <h2>Edit company details</h2>
        </div>
        <span className={statusClass(form.status)}>{form.status}</span>
      </div>

      <div className="company-editor-summary">
        <div className="company-logo-preview">
          {form.logoUrl ? <img src={resolveMediaUrl(form.logoUrl)} alt={`${form.companyName} logo`} /> : <Building2 size={28} />}
          <span>
            <strong>{form.companyName}</strong>
            <small>{form.contactPerson || "Primary contact pending"}</small>
          </span>
        </div>
        <div className="company-health-grid">
          <div className="company-health-card">
            <small>Assigned assets</small>
            <strong>{assignedAssets.length}</strong>
            <span>{activeAssetCount} active</span>
          </div>
          <div className="company-health-card">
            <small>AMC coverage</small>
            <strong>{form.amcTerm || "Not set"}</strong>
            <span>Ends {amcLabel}</span>
          </div>
          <div className="company-health-card">
            <small>Portal access</small>
            <strong>{form.email || "Not set"}</strong>
            <span>{form.phone || "Phone pending"}</span>
          </div>
        </div>
      </div>

      <div className="company-editor-grid">
        <section className="company-editor-section">
          <div className="company-section-head">
            <div>
              <span className="eyebrow">Identity</span>
              <h3>Company profile</h3>
            </div>
          </div>
          <div className="field-grid">
            <label>
              Company name
              <input placeholder="Company name" value={form.companyName} onChange={(event) => update("companyName", event.target.value)} required />
            </label>
            <label>
              Contact person
              <input placeholder="Contact person" value={form.contactPerson} onChange={(event) => update("contactPerson", event.target.value)} required />
            </label>
          </div>
          <div className="field-grid">
            <label>
              Client email
              <input type="email" placeholder="Client email" value={form.email} onChange={(event) => update("email", event.target.value)} required />
            </label>
            <label>
              Phone
              <input inputMode="numeric" placeholder="Phone" value={form.phone} onChange={(event) => update("phone", event.target.value)} maxLength={10} />
            </label>
          </div>
          <label>
            Address
            <textarea placeholder="Address" value={form.address} onChange={(event) => update("address", event.target.value)} maxLength={150} />
          </label>
        </section>

        <section className="company-editor-section">
          <div className="company-section-head">
            <div>
              <span className="eyebrow">Branding</span>
              <h3>Logo and categories</h3>
            </div>
          </div>
          <label>
            Upload logo
            <input type="file" accept=".jpg,.jpeg,.png" onChange={uploadLogo} disabled={uploadingLogo} />
          </label>
          {uploadingLogo && <small className="upload-note">Uploading logo...</small>}
          {uploadError && <small className="upload-error">{uploadError}</small>}
          <label>
            Company categories
            <input placeholder="Laptop, CCTV, Printer" value={form.assetCategoriesText} onChange={(event) => update("assetCategoriesText", event.target.value)} />
          </label>
        </section>

        <section className="company-editor-section">
          <div className="company-section-head">
            <div>
              <span className="eyebrow">Contract</span>
              <h3>AMC and access status</h3>
            </div>
          </div>
          <div className="field-grid">
            <label>
              AMC starts
              <input type="date" value={form.amcStartDate || ""} onChange={(event) => update("amcStartDate", event.target.value)} disabled={!canEditAmc} />
            </label>
            <label>
              AMC term
              <select value={form.amcTerm || "1Y"} onChange={(event) => update("amcTerm", event.target.value)} disabled={!canEditAmc}>
                {AMC_TERMS.map((term) => <option key={term.label} value={term.label}>{term.label}</option>)}
              </select>
            </label>
          </div>
          <div className="field-grid">
            <label>
              AMC ends
              <input type="date" value={form.amcEndDate || ""} onChange={(event) => update("amcEndDate", event.target.value)} disabled={!canEditAmc} />
            </label>
            <label>
              Company status
              <select value={form.status} onChange={(event) => update("status", event.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          <div className="review-box">
            <strong>AMC renewal</strong>
            <small>
              {canEditAmc
                ? `Current end date: ${form.amcEndDate || "Not set"}`
                : `Locked until 10 days before ${form.amcEndDate || "AMC end date"}.`}
            </small>
            <div className="field-grid">
              <label>
                Renewal term
                <select value={form.renewalTerm || "1Y"} onChange={(event) => update("renewalTerm", event.target.value)} disabled={!canEditAmc}>
                  {AMC_TERMS.map((term) => <option key={term.label} value={term.label}>{term.label}</option>)}
                </select>
              </label>
              <button className="secondary company-renew-button" type="button" onClick={renewAmc} disabled={!canEditAmc}>Renew AMC</button>
            </div>
          </div>
        </section>
      </div>

      <div className="company-editor-actions">
        <button className="primary" type="submit"><Save size={16} /> Save company</button>
        <button className="danger" type="button" disabled={assignedAssets.length > 0} onClick={() => onDelete(client.id)}>
          <Trash2 size={16} /> Delete company
        </button>
      </div>
      {assignedAssets.length > 0 && <small>Move or delete assigned assets before deleting this company.</small>}
    </form>
  );
}

function CompaniesPage({ user, data, setData, notify }) {
  const [selectedId, setSelectedId] = useState(data.clients[0]?.id);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const companyDirectory = useMemo(() => data.clients.map((client) => {
    const assignedAssets = data.assets.filter((asset) => asset.clientId === client.id);
    return {
      ...client,
      assetCount: assignedAssets.length,
      activeAssetCount: assignedAssets.filter((asset) => asset.status === "active").length
    };
  }), [data.assets, data.clients]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return companyDirectory.filter((client) => {
      const matchesFilter = statusFilter === "all" || client.status === statusFilter;
      if (!matchesFilter) return false;
      if (!query) return true;
      return [
        client.companyName,
        client.contactPerson,
        client.email,
        client.phone
      ].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [companyDirectory, search, statusFilter]);

  useEffect(() => {
    if (!filteredClients.length) return;
    if (!filteredClients.some((client) => client.id === selectedId)) {
      setSelectedId(filteredClients[0].id);
    }
  }, [filteredClients, selectedId]);

  const selected = companyDirectory.find((client) => client.id === selectedId) || filteredClients[0] || companyDirectory[0];
  const activeCompanies = companyDirectory.filter((client) => client.status === "active").length;
  const totalAssets = companyDirectory.reduce((sum, client) => sum + client.assetCount, 0);

  async function createCompany(form) {
    try {
      const payload = {
      companyName: form.companyName,
      contactPerson: form.contactPerson,
      email: form.email,
      phone: form.phone,
      address: form.address,
      logoUrl: form.logoUrl,
      assetCategories: form.assetCategoriesText
        .split(",")
        .map((category) => category.trim())
        .filter(Boolean),
      amcStartDate: form.amcStartDate,
      amcEndDate: form.amcEndDate,
      amcTerm: form.amcTerm,
      status: "active",
      loginEmail: form.loginEmail,
      loginPassword: form.loginPassword
    };
      const result = await apiRequest("/companies", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const nextState = result.state || data;
      setDataState(nextState);
      saveState(nextState);
      clearPendingState();
      setPendingSync(false);
      setApiStatus("connected");
      setSelectedId(result.company.id);
      const welcomeStatus = result.email?.welcome;
      if (welcomeStatus?.failed > 0 || welcomeStatus?.skipped) {
        notify(`Added ${result.company.companyName}, but email was not sent. Check SMTP settings.`, "warning");
      } else {
        notify(`Added ${result.company.companyName} and sent client email.`);
      }
      return true;
    } catch (error) {
      notify(friendlyErrorMessage(error), "error");
      return false;
    }
  }

  function updateCompany(form, action = "updated") {
    setData((current) => withNotification(
      {
        ...current,
        clients: current.clients.map((client) => client.id === form.id ? form : client)
      },
      {
        type: action === "renewed" ? "amc_renewed" : "company_updated",
        title: action === "renewed" ? "AMC renewed" : "Company updated",
        message: action === "renewed" ? `${form.companyName} AMC was renewed by admin.` : `${form.companyName} company details were updated by admin.`,
        clientId: form.id,
        actorRole: "admin",
        actorName: user.name,
        entityType: action === "renewed" ? "amc" : "company",
        entityId: form.id
      }
    ));
    notify(action === "renewed" ? `Renewed AMC for ${form.companyName}.` : `Updated ${form.companyName}.`);
  }

  function deleteCompany(clientId) {
    setData((current) => {
      const remaining = current.clients.filter((client) => client.id !== clientId);
      setSelectedId(remaining[0]?.id);
      const deletedClient = current.clients.find((client) => client.id === clientId);
      return withNotification(
        { ...current, clients: remaining, users: current.users.filter((item) => item.clientId !== clientId) },
        {
          type: "company_deleted",
          title: "Company deleted",
          message: `${deletedClient?.companyName || "A company"} was deleted by admin.`,
          clientId,
          companyName: deletedClient?.companyName,
          actorRole: "admin",
          actorName: user.name,
          entityType: "company",
          entityId: clientId,
          tone: "warning"
        }
      );
    });
    notify("Company deleted.");
  }

  return (
    <section className="companies-page">
      <div className="panel companies-hero">
        <div className="companies-hero-copy">
          <span className="eyebrow">Relationship management</span>
          <h2>Companies</h2>
          <p>Review account health, maintain contract details, and onboard new client companies from one clear workspace.</p>
        </div>
        <div className="companies-hero-stats">
          <div className="companies-hero-stat">
            <small>Total companies</small>
            <strong>{companyDirectory.length}</strong>
            <span>{activeCompanies} active</span>
          </div>
          <div className="companies-hero-stat">
            <small>Managed assets</small>
            <strong>{totalAssets}</strong>
            <span>Across all clients</span>
          </div>
          <div className="companies-hero-stat">
            <small>Directory results</small>
            <strong>{filteredClients.length}</strong>
            <span>{statusFilter === "all" ? "All statuses" : `${statusFilter} only`}</span>
          </div>
        </div>
      </div>

      <div className="companies-layout">
        <div className="panel companies-directory">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Directory</span>
              <h2>Company records</h2>
            </div>
            <span className="badge active">{filteredClients.length}</span>
          </div>

          <label className="search companies-search">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search company, contact, email, phone"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <div className="segmented-control companies-filter" role="tablist" aria-label="Company status filter">
            {["all", "active", "inactive"].map((value) => (
              <button
                key={value}
                type="button"
                className={statusFilter === value ? "active" : ""}
                onClick={() => setStatusFilter(value)}
              >
                {value === "all" ? "All" : value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>

          <div className="company-list company-directory-list">
            {filteredClients.length > 0 ? filteredClients.map((client) => (
              <button
                className={selected?.id === client.id ? "company-row company-directory-row selectable active" : "company-row company-directory-row selectable"}
                key={client.id}
                onClick={() => setSelectedId(client.id)}
              >
                <CompanyLogo client={client} />
                <span className="company-directory-copy">
                  <strong>{client.companyName}</strong>
                  <small>{client.contactPerson}</small>
                  <small>{client.email}</small>
                </span>
                <span className="company-directory-meta">
                  <span className={statusClass(client.status)}>{client.status}</span>
                  <small>{client.assetCount} assets</small>
                </span>
              </button>
            )) : (
              <div className="empty-inline">
                No companies match the current search or status filter.
              </div>
            )}
          </div>
        </div>

        <div className="companies-workspace">
          {selected ? (
            <>
              <div className="panel company-overview">
                <div className="company-overview-head">
                  <div className="company-logo-preview company-overview-brand">
                    {selected.logoUrl ? <img src={resolveMediaUrl(selected.logoUrl)} alt={`${selected.companyName} logo`} /> : <Building2 size={28} />}
                    <span>
                      <strong>{selected.companyName}</strong>
                      <small>{selected.contactPerson}</small>
                    </span>
                  </div>
                  <span className={statusClass(selected.status)}>{selected.status}</span>
                </div>
                <div className="company-overview-grid">
                  <div className="company-overview-card">
                    <small>Primary email</small>
                    <strong>{selected.email}</strong>
                    <span>{selected.phone || "Phone pending"}</span>
                  </div>
                  <div className="company-overview-card">
                    <small>Asset coverage</small>
                    <strong>{selected.assetCount} assigned</strong>
                    <span>{selected.activeAssetCount} active right now</span>
                  </div>
                  <div className="company-overview-card">
                    <small>AMC timeline</small>
                    <strong>{selected.amcTerm || "Not set"}</strong>
                    <span>Ends {selected.amcEndDate ? formatCalendarDate(selected.amcEndDate) : "Not set"}</span>
                  </div>
                </div>
                <div className="company-overview-notes">
                  <strong>Address</strong>
                  <p>{selected.address || "Address not added yet."}</p>
                </div>
              </div>
              <CompanyEditor key={selected.id} client={selected} assets={data.assets} onUpdate={updateCompany} onDelete={deleteCompany} />
            </>
          ) : (
            <div className="panel empty-state">
              <Building2 size={36} />
              <h2>No company selected</h2>
              <p>Create a company or adjust the search filters to continue.</p>
            </div>
          )}
        </div>

        <CompanyForm onCreate={createCompany} className="companies-create-panel" />
      </div>
    </section>
  );
}

function Dashboard({ user, data, scopedAssets, scopedAppeals, clientBrand }) {
  const scopedServiceRecords = getScopedServiceRecords(data.serviceRecords, scopedAssets);
  const serviceWindowEnd = new Date();
  serviceWindowEnd.setDate(serviceWindowEnd.getDate() + 30);
  const serviceWindowEndKey = serviceWindowEnd.toISOString().slice(0, 10);
  const openAppeals = scopedAppeals.filter((appeal) => !["resolved", "closed", "approved"].includes(appeal.status) && isPriorityAppeal(appeal));
  const dueServices = scopedServiceRecords.filter((record) => isPriorityServiceRecord(record) && record.nextServiceDue && record.nextServiceDue <= serviceWindowEndKey);
  const inServiceAssets = scopedAssets.filter((asset) => ["in_service", "repairing"].includes(asset.status));
  const attentionAssets = scopedAssets.filter(isPriorityAsset);
  const recentAppeals = [...openAppeals].sort((first, second) => new Date(second.updatedAt) - new Date(first.updatedAt)).slice(0, 4);
  const serviceDueList = [...dueServices].sort((first, second) => String(first.nextServiceDue).localeCompare(String(second.nextServiceDue))).slice(0, 4);
  const recentServiceHistory = sortByNewestDate(scopedServiceRecords.filter(isPriorityServiceRecord), "serviceDate").slice(0, 5);

  if (user.role === "admin") {
    return (
      <section className="admin-dashboard">
        <div className="panel dashboard-hero">
          <div>
            <span className="eyebrow">Operations overview</span>
            <h2>HAAK asset control center</h2>
            <p>Monitor company coverage, asset condition, service due dates, and client issue status from one focused dashboard.</p>
          </div>
          <div className="dashboard-health">
            <span><strong>{data.clients.length}</strong> Companies</span>
            <span><strong>{scopedAssets.length}</strong> Assets</span>
            <span><strong>{openAppeals.length}</strong> Open issues</span>
          </div>
        </div>

        <div className="stats-grid dashboard-kpis">
          <Stat label="Companies" value={data.clients.length} icon={<Building2 />} />
          <Stat label="Total assets" value={scopedAssets.length} icon={<Archive />} />
          <Stat label="Priority issues" value={openAppeals.length} icon={<AlertCircle />} />
          <Stat label="Service due" value={dueServices.length} icon={<History />} />
        </div>

        <div className="dashboard-main-grid">
          <CollapsiblePanel eyebrow="Issue queue" title="Priority appeals" badge={<span className="badge open">{openAppeals.length}</span>}>
            <div className="dashboard-list">
              {recentAppeals.length > 0 ? recentAppeals.map((appeal) => {
                const asset = data.assets.find((item) => item.id === appeal.assetId);
                const client = data.clients.find((item) => item.id === appeal.clientId);
                return (
                  <div className="dashboard-list-item" key={appeal.id}>
                    <div>
                      <span className={statusClass(appeal.status)}>{formatStatusLabel(appeal.status)}</span>
                      <strong>{appeal.title}</strong>
                      <small>{asset?.name || "Unknown asset"} / {client?.companyName || "Unknown company"}</small>
                    </div>
                    <small>{formatTimestamp(appeal.updatedAt)}</small>
                  </div>
                );
              }) : <div className="empty-inline">No appeal activity yet.</div>}
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel eyebrow="Service calendar" title="Priority upcoming service" badge={<span className="badge pending">{serviceDueList.length}</span>}>
            <div className="dashboard-list">
              {serviceDueList.length > 0 ? serviceDueList.map((record) => {
                const asset = data.assets.find((item) => item.id === record.assetId);
                return (
                  <div className="dashboard-list-item" key={record.id}>
                    <div>
                      <span className={statusClass(record.status)}>{formatStatusLabel(record.status)}</span>
                      <strong>{asset?.name || "Unknown asset"}</strong>
                      <small>{record.serviceType} / {record.technicianName || "Technician not assigned"}</small>
                    </div>
                    <small>{record.nextServiceDue || "No due date"}</small>
                  </div>
                );
              }) : <div className="empty-inline">No service due in the current window.</div>}
            </div>
          </CollapsiblePanel>
        </div>

        <div className="dashboard-lower-grid">
          <CollapsiblePanel eyebrow="Company coverage" title="Client asset distribution" badge={<span className="badge active">{data.clients.length}</span>}>
            <div className="company-list compact-company-list">
              {data.clients.map((client) => (
                <div className="company-row" key={client.id}>
                  <CompanyLogo client={client} />
                  <span>
                    <strong>{client.companyName}</strong>
                    <small>{data.assets.filter((asset) => asset.clientId === client.id).length} assets / {client.contactPerson}</small>
                  </span>
                  <span className={statusClass(client.status)}>{client.status}</span>
                </div>
              ))}
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel eyebrow="Asset condition" title="Priority assets" badge={<span className="badge in-service">{attentionAssets.length}</span>}>
            <div className="asset-list compact">
              {attentionAssets.length > 0 ? attentionAssets.map((asset) => (
                <AssetRow key={asset.id} asset={asset} client={data.clients.find((client) => client.id === asset.clientId)} />
              )) : <div className="empty-inline">All assets are currently active.</div>}
            </div>
          </CollapsiblePanel>
        </div>
      </section>
    );
  }

  return (
    <section className="client-dashboard">
      <div className="panel client-dashboard-hero">
        <div>
          <span className="eyebrow">Welcome back</span>
          <h2>{clientBrand?.companyName || "Client dashboard"}</h2>
          <p>
            Hello {clientBrand?.contactPerson || user.name}. Here is the latest view of your managed assets, service work, and issue activity.
          </p>
        </div>
        <div className="client-dashboard-brand">
          {clientBrand ? <CompanyLogo client={clientBrand} /> : <Building2 size={20} />}
          <span>
            <strong>{clientBrand?.companyName || "Client account"}</strong>
            <small>{clientBrand?.email || user.email}</small>
          </span>
        </div>
      </div>
      <div className="stats-grid">
        <Stat label="My assets" value={scopedAssets.length} icon={<Archive />} />
        <Stat label="Open appeals" value={openAppeals.length} icon={<AlertCircle />} />
        <Stat label="Under repair" value={inServiceAssets.length} icon={<Clock />} />
        <Stat label="Service due" value={dueServices.length} icon={<History />} />
      </div>
      <div className="client-dashboard-grid">
        <CollapsiblePanel title="Service history" badge={<span className="badge active">{recentServiceHistory.length}</span>}>
          <div className="timeline">
            {recentServiceHistory.length > 0 ? recentServiceHistory.map((record) => {
              const asset = scopedAssets.find((item) => item.id === record.assetId);
              return (
                <div key={record.id} className="timeline-item">
                  <small>{record.serviceDate || "Not recorded"}</small>
                  <strong>{asset?.name || "Unknown asset"} - {record.serviceType}</strong>
                  <p>{record.description}</p>
                  <small>{formatStatusLabel(record.status)}</small>
                </div>
              );
            }) : <div className="empty-inline">No service history yet.</div>}
          </div>
        </CollapsiblePanel>
        <CollapsiblePanel title="Priority appeal history" badge={<span className="badge open">{recentAppeals.length}</span>}>
          <div className="timeline">
            {recentAppeals.length > 0 ? recentAppeals.map((appeal) => (
              <div key={appeal.id} className="timeline-item">
                <span className={statusClass(appeal.status)}>{formatStatusLabel(appeal.status)}</span>
                <strong>{appeal.title}</strong>
                <p>{appeal.description}</p>
              </div>
            )) : <div className="empty-inline">No appeal history yet.</div>}
          </div>
        </CollapsiblePanel>
        <CollapsiblePanel title="Priority assets" badge={<span className="badge in-service">{attentionAssets.length}</span>}>
          <div className="asset-list compact">
            {attentionAssets.length > 0 ? attentionAssets.map((asset) => (
              <AssetRow key={asset.id} asset={asset} client={data.clients.find((client) => client.id === asset.clientId)} />
            )) : <div className="empty-inline">All assets are currently active.</div>}
          </div>
        </CollapsiblePanel>
      </div>
    </section>
  );
}

function AssetRow({ asset, client, selected, onSelect, onEdit }) {
  const interactive = Boolean(onSelect);

  return (
    <div
      className={selected ? "asset-row active" : "asset-row"}
      onClick={() => onSelect?.(asset.id)}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.(asset.id);
        }
      } : undefined}
    >
      <AssetVisual asset={asset} />
      <span className="asset-row-content">
        <strong>{asset.name}</strong>
        <small>{asset.assetCode} - {client?.companyName}{asset.userName ? ` / ${asset.userName}` : ""}</small>
      </span>
      <div className="asset-row-actions">
        <span className={statusClass(asset.status)}>{formatStatusLabel(asset.status)}</span>
        {onEdit && (
          <button className="asset-row-edit" type="button" onClick={(event) => { event.stopPropagation(); onEdit(asset.id); }}>
            Edit asset
          </button>
        )}
      </div>
    </div>
  );
}

function AssetForm({ clients, categories, existingAssets, onCreate, lockedClientId = "" }) {
  const steps = ["Assign", "Identify", "Lifecycle", "Media"];
  const [step, setStep] = useState(0);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState(0);
  const [form, setForm] = useState({
    name: "",
    assetCode: "",
    clientId: lockedClientId || clients[0]?.id || "",
    category: categories[0] || "",
    userName: "",
    location: "",
    image: "",
    documents: []
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    setForm((current) => {
      const nextClientId = lockedClientId || (clients.some((client) => client.id === current.clientId) ? current.clientId : (clients[0]?.id || ""));
      const nextCategory = categories.includes(current.category) ? current.category : (categories[0] || "");
      return {
        ...current,
        clientId: nextClientId,
        category: nextCategory,
        assetCode: generateAssetCode(clients, existingAssets, nextClientId, nextCategory)
      };
    });
  }, [clients, categories, existingAssets, lockedClientId]);

  function update(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "clientId" || field === "category") {
        const nextClientId = field === "clientId" ? value : next.clientId;
        const nextCategory = field === "category" ? value : next.category;
        next.assetCode = generateAssetCode(clients, existingAssets, nextClientId, nextCategory);
      }
      return next;
    });
  }

  async function uploadAssetImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setUploadError("");
    try {
      const result = await uploadFile(file);
      update("image", result.url);
    } catch (error) {
      setUploadError(uploadErrorMessage(error));
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  }

  async function uploadAssetDocument(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingDocument(true);
    setUploadError("");
    try {
      const result = await uploadFile(file);
      setForm((current) => ({ ...current, documents: [...current.documents, result.url] }));
    } catch (error) {
      setUploadError(uploadErrorMessage(error));
    } finally {
      setUploadingDocument(false);
      event.target.value = "";
    }
  }

  function submit(event) {
    event.preventDefault();
    if (!canContinue() || step !== steps.length - 1) return;
    onCreate(form);
    const defaultClientId = lockedClientId || clients[0]?.id || "";
    const defaultCategory = categories[0] || "";
    setForm({
      clientId: defaultClientId,
      assetCode: generateAssetCode(clients, existingAssets, defaultClientId, defaultCategory),
      category: defaultCategory,
      name: "",
      userName: "",
      location: "",
      image: "",
      documents: []
    });
    setUploadError("");
    setStep(0);
    setMaxUnlockedStep(0);
  }

  function canContinue() {
    if (step === 0) return Boolean(form.clientId);
    if (step === 1) return Boolean(form.category);
    if (step === 2) return Boolean(form.name.trim());
    return Boolean(form.userName.trim());
  }

  function goToStep(index) {
    if (index <= maxUnlockedStep) {
      setStep(index);
    }
  }

  function goForward() {
    const nextStep = Math.min(step + 1, steps.length - 1);
    setMaxUnlockedStep((current) => Math.max(current, nextStep));
    setStep(nextStep);
  }

  return (
    <form className="panel asset-wizard" onSubmit={submit}>
      <div className="panel-head">
        <div>
          <span className="eyebrow">Asset setup</span>
          <h2>Add asset</h2>
        </div>
        <span className="badge active">{steps[step]}</span>
      </div>

      <label className="asset-company-field">
        Company
        <select value={form.clientId} onChange={(event) => update("clientId", event.target.value)}>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.companyName}</option>)}
        </select>
      </label>

      <div className="stepper" aria-label="Asset creation steps">
        {steps.map((label, index) => (
          <button
            className={index === step ? "step active" : index < step ? "step done" : "step"}
            key={label}
            type="button"
            onClick={() => goToStep(index)}
            disabled={index > maxUnlockedStep}
          >
            <span>{index + 1}</span>
            {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="wizard-step">
          <h3>Assign to company</h3>
          <p>Select the client company that owns or uses this asset.</p>
          {lockedClientId ? (
            <div className="review-box">
              <strong>{clients.find((client) => client.id === lockedClientId)?.companyName || "Your company"}</strong>
              <small>New assets are added under your client account.</small>
            </div>
          ) : (
            <label>
              Company
              <select value={form.clientId} onChange={(event) => update("clientId", event.target.value)}>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.companyName}</option>)}
              </select>
            </label>
          )}
          <label>
            Location
            <input placeholder="Office, department, site, or room" value={form.location} onChange={(event) => update("location", event.target.value)} />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="wizard-step">
          <h3>Category</h3>
          <p>Choose the asset category for reporting and service tracking.</p>
          <label>
            Category
            <select value={form.category} onChange={(event) => update("category", event.target.value)} required>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="wizard-step">
          <h3>Asset name</h3>
          <p>Use the asset's working name or label.</p>
          <label>
            Asset name
            <input placeholder="Dell Latitude 5440" value={form.name} onChange={(event) => update("name", event.target.value)} required />
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="wizard-step">
          <h3>User name</h3>
          <p>Record the user or person currently linked to the asset.</p>
          <label>
            User name
            <input placeholder="Assigned user name" value={form.userName} onChange={(event) => update("userName", event.target.value)} required />
          </label>
        </div>
      )}

      <div className="wizard-actions">
        <button className="secondary" type="button" disabled={step === 0} onClick={() => setStep((current) => current - 1)}>Back</button>
        {step < steps.length - 1 ? (
          <button className="primary" type="button" disabled={!canContinue()} onClick={goForward}>Next step</button>
        ) : (
          <button className="primary" type="submit" disabled={!canContinue()}><Plus size={16} /> Add asset</button>
        )}
      </div>
    </form>
  );
}

function AssetEditor({ asset, clients, categories, onUpdate, onDelete, canDelete = false, lockedClientId = "" }) {
  const [form, setForm] = useState(asset);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setUploadError("");
    try {
      const result = await uploadFile(file);
      setForm((current) => ({ ...current, images: [result.url, ...(current.images || []).slice(1)] }));
    } catch (error) {
      setUploadError(uploadErrorMessage(error));
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  }

  function removePrimaryImage() {
    setForm((current) => ({ ...current, images: [] }));
    setUploadError("");
  }

  function submit(event) {
    event.preventDefault();
    onUpdate(form);
  }

  return (
    <form className="panel form-grid" onSubmit={submit}>
      <h2>Edit asset</h2>
      <div className="asset-editor-media">
        <AssetVisual asset={form} className="asset-editor-preview" />
        <div className="asset-editor-media-controls">
          <label className="file-field">
            Change image
            <input type="file" accept=".jpg,.jpeg,.png" onChange={uploadImage} disabled={uploadingImage} />
            <span><Camera size={15} /> {form.images?.[0] ? "Upload replacement image" : `Upload first image (JPG/PNG, max ${MAX_UPLOAD_MB} MB)`}</span>
          </label>
          {uploadingImage && <small className="upload-note">Uploading image...</small>}
          {uploadError && <small className="upload-error">{uploadError}</small>}
          <button className="secondary" type="button" onClick={removePrimaryImage} disabled={!form.images?.length}>Remove image</button>
        </div>
      </div>
      <input placeholder="Asset code" value={form.assetCode} readOnly />
      <input placeholder="Asset name" value={form.name} onChange={(event) => update("name", event.target.value)} required />
      {lockedClientId ? (
        <div className="review-box">
          <strong>{clients.find((client) => client.id === lockedClientId)?.companyName || "Your company"}</strong>
          <small>Company assignment is managed by admin.</small>
        </div>
      ) : (
        <select value={form.clientId} onChange={(event) => update("clientId", event.target.value)}>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.companyName}</option>)}
        </select>
      )}
      <select value={form.category} onChange={(event) => update("category", event.target.value)}>
        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
      </select>
      <input placeholder="Brand" value={form.brand} onChange={(event) => update("brand", event.target.value)} />
      <input placeholder="Model" value={form.model} onChange={(event) => update("model", event.target.value)} />
      <input placeholder="Serial number" value={form.serialNumber} onChange={(event) => update("serialNumber", event.target.value)} />
      <input type="date" value={form.purchaseDate} onChange={(event) => update("purchaseDate", event.target.value)} />
      <input type="date" value={form.warrantyEndDate} onChange={(event) => update("warrantyEndDate", event.target.value)} />
      <input placeholder="Location" value={form.location} onChange={(event) => update("location", event.target.value)} />
      <select value={form.status} onChange={(event) => update("status", event.target.value)}>
        <option value="active">Active</option>
        <option value="in_service">In service</option>
        <option value="repairing">Repairing</option>
        <option value="repaired">Repaired</option>
        <option value="retired">Retired</option>
        <option value="damaged">Damaged</option>
        <option value="lost">Lost</option>
      </select>
      <textarea placeholder="Notes" value={form.notes} onChange={(event) => update("notes", event.target.value)} />
      <button className="primary" type="submit"><Save size={16} /> Save asset</button>
      {canDelete && <button className="danger" type="button" onClick={() => onDelete(asset.id)}><Trash2 size={16} /> Delete asset</button>}
    </form>
  );
}

function AssetMediaPanel({ asset, onAddImage, onAddDocument, onRemoveImage, onRemoveDocument, readOnly = false }) {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setUploadError("");
    try {
      const result = await uploadFile(file);
      onAddImage(result.url);
    } catch (error) {
      setUploadError(uploadErrorMessage(error));
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  }

  async function uploadDocument(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingDocument(true);
    setUploadError("");
    try {
      const result = await uploadFile(file);
      onAddDocument(result.url);
    } catch (error) {
      setUploadError(uploadErrorMessage(error));
    } finally {
      setUploadingDocument(false);
      event.target.value = "";
    }
  }

  return (
    <div className="panel media-panel">
      <h2>Images and documents</h2>
      {asset.images.length > 0 ? (
        <div className="image-grid">
          {asset.images.map((image, index) => (
            <div className="media-tile" key={`${image}-${index}`}>
              <img src={resolveMediaUrl(image)} alt={asset.name} />
              {!readOnly && <button className="secondary inline-remove" type="button" onClick={() => onRemoveImage?.(image)}>Remove</button>}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-inline">No asset images uploaded yet.</div>
      )}
      {!readOnly && (
        <>
          <label className="file-field">
            Upload asset image
            <input type="file" accept=".jpg,.jpeg,.png" onChange={uploadImage} disabled={uploadingImage} />
            <span><Camera size={15} /> Upload asset image (JPG/PNG, max {MAX_UPLOAD_MB} MB)</span>
          </label>
        </>
      )}
      {uploadingImage && <small className="upload-note">Uploading image...</small>}
      {uploadError && <small className="upload-error">{uploadError}</small>}
      <div className="document-list">
        {asset.documents.length > 0 ? asset.documents.map((document, index) => (
          <div className="document-row" key={`${document}-${index}`}>
            <Paperclip size={16} />
            {isDocumentLink(document) ? (
              <a href={resolveMediaUrl(document)} target="_blank" rel="noreferrer">{documentLabel(document)}</a>
            ) : (
              <span>{documentLabel(document)}</span>
            )}
            {!readOnly && <button className="secondary inline-remove" type="button" onClick={() => onRemoveDocument?.(document, index)}>Remove</button>}
          </div>
        )) : <div className="empty-inline">No documents uploaded yet.</div>}
      </div>
      {!readOnly && (
        <>
          <label className="file-field">
            Upload document
            <input type="file" accept=".pdf,.doc" onChange={uploadDocument} disabled={uploadingDocument} />
            <span><Paperclip size={15} /> Upload document (.doc/.pdf, max {MAX_UPLOAD_MB} MB)</span>
          </label>
          {uploadingDocument && <small className="upload-note">Uploading document...</small>}
        </>
      )}
    </div>
  );
}

function LifecycleManager({ asset, onAddLifecycle }) {
  const [form, setForm] = useState({ type: "Inspection", description: "" });

  function submit(event) {
    event.preventDefault();
    if (!form.description.trim()) return;
    onAddLifecycle(form);
    setForm({ type: "Inspection", description: "" });
  }

  return (
    <div className="panel">
      <h2>Lifecycle</h2>
      <div className="timeline">
        {asset.lifecycle.map((item) => (
          <div key={item.id} className="timeline-item">
            <small>{item.createdAt}</small>
            <strong>{item.type}</strong>
            <p>{formatLifecycleDescription(item)}</p>
          </div>
        ))}
      </div>
      <form className="inline-form lifecycle-form" onSubmit={submit}>
        <input placeholder="Event type" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} />
        <input placeholder="Event description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        <button className="primary" type="submit"><Plus size={16} /> Add event</button>
      </form>
    </div>
  );
}

function AssetsPage({ user, data, scopedAssets, setData, notify, onAddEngineer }) {
  const [query, setQuery] = useState("");
  const [filterClientId, setFilterClientId] = useState(user.role === "admin" ? (data.clients[0]?.id || "") : user.clientId);
  const [filterCategory, setFilterCategory] = useState("");
  const [selectedId, setSelectedId] = useState(scopedAssets[0]?.id);
  const [assetView, setAssetView] = useState("details");
  const assetCategories = data.assetCategories || [];
  const editableClients = user.role === "admin" ? data.clients : data.clients.filter((client) => client.id === user.clientId);
  const selectedClient = editableClients.find((client) => client.id === filterClientId) || editableClients[0];
  const selectedCompanyCategories = clientCategories(selectedClient, assetCategories);
  const selected = scopedAssets.find((asset) => asset.id === selectedId) || scopedAssets.find((asset) => asset.clientId === selectedClient?.id);
  const filtered = scopedAssets.filter((asset) =>
    (!filterClientId || asset.clientId === filterClientId) &&
    (!filterCategory || asset.category === filterCategory) &&
    [asset.name, asset.assetCode, asset.category, asset.serialNumber].join(" ").toLowerCase().includes(query.toLowerCase())
  );
  const groupedAssets = user.role === "admin"
    ? data.clients
      .map((client) => ({
        client,
        assets: filtered.filter((asset) => asset.clientId === client.id)
      }))
      .filter((group) => group.assets.length > 0)
    : [{ client: data.clients.find((client) => client.id === user.clientId), assets: filtered }];
  const creationClients = user.role === "client"
    ? data.clients.filter((client) => client.id === user.clientId)
    : data.clients;

  useEffect(() => {
    if (!filterClientId && editableClients[0]?.id) setFilterClientId(editableClients[0].id);
  }, [editableClients, filterClientId]);

  useEffect(() => {
    if (filterCategory && !selectedCompanyCategories.includes(filterCategory)) {
      setFilterCategory("");
    }
  }, [filterCategory, selectedCompanyCategories]);

  useEffect(() => {
    if (filtered.length > 0 && !filtered.some((asset) => asset.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  function createAsset(form) {
    const assetCode = generateAssetCode(data.clients, data.assets, form.clientId, form.category);
    const asset = {
      id: uid("a"),
      assetCode,
      clientId: form.clientId,
      name: form.name,
      userName: form.userName,
      category: form.category,
      brand: form.brand,
      model: form.model,
      serialNumber: form.serialNumber,
      purchaseDate: form.purchaseDate,
      warrantyEndDate: form.warrantyEndDate,
      location: form.location,
      status: form.status,
      notes: form.notes,
      images: form.image ? [form.image] : [],
      documents: form.documents || [],
      lifecycle: [{ id: uid("l"), type: "Created", description: `Asset created by ${user.role}.`, createdAt: today() }]
    };
    setData((current) => withNotification(
      { ...current, assets: [asset, ...current.assets] },
      {
        type: "asset_created",
        title: "Asset added",
        message: `${asset.name} was added by ${user.role}.`,
        clientId: asset.clientId,
        actorRole: user.role,
        actorName: user.name,
        entityType: "asset",
        entityId: asset.id
      }
    ));
    setSelectedId(asset.id);
    setAssetView("details");
    notify(`Added ${asset.name}.`);
  }

  function updateStatus(assetId, status) {
    setData((current) => {
      const changedAsset = current.assets.find((asset) => asset.id === assetId);
      return withNotification(
        {
          ...current,
          assets: current.assets.map((asset) =>
            asset.id === assetId
              ? {
                  ...asset,
                  status,
                  lifecycle: [
                    ...asset.lifecycle,
                    { id: uid("l"), type: "Status", description: `Status changed to ${String(status || "open").replace("_", " ")}.`, createdAt: today() }
                  ]
                }
              : asset
          )
        },
        {
          type: "asset_status",
          title: "Asset status changed",
          message: `${changedAsset?.name || "Asset"} was marked ${formatStatusLabel(status).toLowerCase()} by admin.`,
          clientId: changedAsset?.clientId,
          actorRole: "admin",
          actorName: user.name,
          entityType: "asset",
          entityId: assetId
        }
      );
    });
  }

  function updateAsset(form) {
    setData((current) => {
      let updatedAsset = null;
      const nextState = {
        ...current,
        assets: current.assets.map((asset) => {
        if (asset.id !== form.id) return asset;
        const lifecycle = [...asset.lifecycle];
        if (asset.clientId !== form.clientId) {
          const client = current.clients.find((item) => item.id === form.clientId);
          lifecycle.push({ id: uid("l"), type: "Assigned", description: `Reassigned to ${client?.companyName || "another company"}.`, createdAt: today() });
        }
        if (asset.status !== form.status) {
          lifecycle.push({ id: uid("l"), type: "Status", description: `Status changed to ${String(form.status || "open").replace("_", " ")}.`, createdAt: today() });
        }
        lifecycle.push({ id: uid("l"), type: "Updated", description: `Asset details updated by ${user.role}.`, createdAt: today() });
        updatedAsset = { ...asset, ...form, clientId: user.role === "admin" ? form.clientId : asset.clientId, assetCode: nextAssetCode, lifecycle };
        return updatedAsset;
      })
      };
      return withNotification(nextState, {
        type: "asset_updated",
        title: "Asset updated",
        message: `${updatedAsset?.name || form.name} was updated by ${user.role}.`,
        clientId: updatedAsset?.clientId || form.clientId,
        actorRole: user.role,
        actorName: user.name,
        entityType: "asset",
        entityId: form.id
      });
    });
    setAssetView("details");
    notify(`Updated ${form.name}.`);
  }

  function deleteAsset(assetId) {
    if (user.role !== "admin") {
      notify("Only admin can delete assets.", "error");
      return;
    }
    setData((current) => {
      const remainingAssets = current.assets.filter((asset) => asset.id !== assetId);
      const deletedAppealIds = current.appeals.filter((appeal) => appeal.assetId === assetId).map((appeal) => appeal.id);
      setSelectedId(remainingAssets[0]?.id);
      const deletedAsset = current.assets.find((asset) => asset.id === assetId);
      return withNotification({
        ...current,
        assets: remainingAssets,
        serviceRecords: current.serviceRecords.filter((record) => record.assetId !== assetId),
        appeals: current.appeals.filter((appeal) => appeal.assetId !== assetId),
        appealMessages: current.appealMessages.filter((message) => !deletedAppealIds.includes(message.appealId))
      }, {
        type: "asset_deleted",
        title: "Asset deleted",
        message: `${deletedAsset?.name || "Asset"} was deleted by admin.`,
        clientId: deletedAsset?.clientId,
        actorRole: "admin",
        actorName: user.name,
        entityType: "asset",
        entityId: assetId,
        tone: "warning"
      });
    });
    setAssetView("details");
    notify("Asset deleted.");
  }

  function addImage(assetId, imageUrl) {
    setData((current) => {
      const changedAsset = current.assets.find((asset) => asset.id === assetId);
      return withNotification({
        ...current,
        assets: current.assets.map((asset) =>
          asset.id === assetId
            ? {
                ...asset,
                images: [...asset.images, imageUrl],
                lifecycle: [...asset.lifecycle, { id: uid("l"), type: "Image", description: "Asset image added.", createdAt: today() }]
              }
            : asset
        )
      }, {
        type: "asset_media",
        title: "Asset image added",
        message: `${changedAsset?.name || "Asset"} received a new image from ${user.role}.`,
        clientId: changedAsset?.clientId,
        actorRole: user.role,
        actorName: user.name,
        entityType: "asset",
        entityId: assetId
      });
    });
    notify("Asset image added.");
  }

  function addDocument(assetId, documentName) {
    setData((current) => {
      const changedAsset = current.assets.find((asset) => asset.id === assetId);
      return withNotification({
        ...current,
        assets: current.assets.map((asset) =>
          asset.id === assetId
            ? {
                ...asset,
                documents: [...asset.documents, documentName],
                lifecycle: [...asset.lifecycle, { id: uid("l"), type: "Document", description: `${documentName} added.`, createdAt: today() }]
              }
            : asset
        )
      }, {
        type: "asset_media",
        title: "Asset document added",
        message: `${changedAsset?.name || "Asset"} received a new document from ${user.role}.`,
        clientId: changedAsset?.clientId,
        actorRole: user.role,
        actorName: user.name,
        entityType: "asset",
        entityId: assetId
      });
    });
    notify("Asset document added.");
  }

  function removeImage(assetId, imageUrl) {
    setData((current) => ({
      ...current,
      assets: current.assets.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              images: asset.images.filter((image) => image !== imageUrl),
              lifecycle: [...asset.lifecycle, { id: uid("l"), type: "Image", description: "Asset image removed.", createdAt: today() }]
            }
          : asset
      )
    }));
    notify("Asset image removed.");
  }

  function removeDocument(assetId, documentIndex) {
    setData((current) => ({
      ...current,
      assets: current.assets.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              documents: asset.documents.filter((_, index) => index !== documentIndex),
              lifecycle: [...asset.lifecycle, { id: uid("l"), type: "Document", description: "Asset document removed.", createdAt: today() }]
            }
          : asset
      )
    }));
    notify("Asset document removed.");
  }

  function addLifecycle(assetId, form) {
    setData((current) => ({
      ...current,
      assets: current.assets.map((asset) =>
        asset.id === assetId
          ? { ...asset, lifecycle: [...asset.lifecycle, { id: uid("l"), type: form.type, description: form.description, createdAt: today() }] }
          : asset
      )
    }));
  }

  function openAssetForm() {
    setAssetView("add");
  }

  function createCategory(name) {
    const normalized = name.trim();
    const targetClientId = filterClientId || editableClients[0]?.id;
    if (!normalized || !targetClientId) return;
    const targetClient = data.clients.find((client) => client.id === targetClientId);
    const exists = clientCategories(targetClient, assetCategories).some((category) => category.toLowerCase() === normalized.toLowerCase());
    if (exists) {
      notify("Category already exists.");
      return;
    }
    setData((current) => ({
      ...current,
      clients: current.clients.map((client) =>
        client.id === targetClientId
          ? {
              ...client,
              assetCategories: [...clientCategories(client, current.assetCategories || []), normalized]
                .sort((first, second) => first.localeCompare(second))
            }
          : client
      )
    }));
    notify(`${normalized} category added.`);
  }

  return (
    <section className={user.role === "admin" ? "assets-layout admin-assets-layout" : "assets-layout"}>
      <div className="panel assets-page-toolbar">
        <div>
          <span className="eyebrow">Assets</span>
          <h2>{user.role === "admin" ? "Admin asset library" : "Your assets"}</h2>
        </div>
        <button className="primary" type="button" onClick={openAssetForm}>
          <Plus size={16} /> {user.role === "client" ? "+ Asset" : "Add asset"}
        </button>
      </div>

      <div className="panel assets-rail">
        <div className="toolbar">
          <select value={filterClientId} onChange={(event) => {
            setFilterClientId(event.target.value);
            setFilterCategory("");
          }}>
            {editableClients.map((client) => <option key={client.id} value={client.id}>{client.companyName}</option>)}
          </select>
          <select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}>
            <option value="">All categories</option>
            {selectedCompanyCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <div className="search"><Search size={16} /><input placeholder="Search assets" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        </div>
        <div className="asset-list">
          {groupedAssets.length > 0 ? groupedAssets.map(({ client, assets }) => (
            <section className="asset-client-group" key={client?.id || "ungrouped"}>
              <div className="asset-client-group-head">
                <div>
                  <strong>{client?.companyName || "Unassigned company"}</strong>
                  <small>{assets.length} asset{assets.length === 1 ? "" : "s"}</small>
                </div>
              </div>
              <div className="asset-client-group-list">
                {assets.map((asset) => (
                  <AssetRow
                    key={asset.id}
                    asset={asset}
                    client={client}
                    selected={selected?.id === asset.id}
                    onSelect={setSelectedId}
                    onEdit={user.role === "admin" ? () => {
                      setSelectedId(asset.id);
                      setAssetView("edit");
                    } : null}
                  />
                ))}
              </div>
            </section>
          )) : <div className="empty-inline">No assets match this search.</div>}
        </div>
      </div>
      <div className="asset-workspace">
        <div className="panel asset-subnav">
          <div>
            <span className="eyebrow">Asset workspace</span>
            <h2>{assetView === "add" ? "Add asset" : assetView === "edit" ? "Edit asset" : "Asset details"}</h2>
          </div>
          <div className="segmented-control">
            <button className={assetView === "details" ? "active" : ""} type="button" onClick={() => setAssetView("details")}>Details</button>
            <button className={assetView === "add" ? "active" : ""} type="button" onClick={() => setAssetView("add")}>Add asset</button>
            <button className={assetView === "edit" ? "active" : ""} type="button" onClick={() => setAssetView("edit")} disabled={!selected}>Edit asset</button>
          </div>
          {user.role === "admin" && (
            <button className="secondary" type="button" onClick={onAddEngineer}>
              <Plus size={16} /> Add engineer
            </button>
          )}
        </div>
        {selected || assetView === "add" || user.role === "admin" ? (
          <>
            {assetView === "details" && selected && (
              <>
                <div className="panel asset-detail">
                  <AssetVisual asset={selected} className="asset-hero-image" />
                  <div className="asset-detail-body">
                    <div className="asset-detail-head">
                      <div>
                        <span className={statusClass(selected.status)}>{formatStatusLabel(selected.status)}</span>
                        <h2>{selected.name}</h2>
                        <p>{selected.assetCode} / {selected.category || "Uncategorized"} / {selected.serialNumber || "No serial"}</p>
                      </div>
                      {user.role === "admin" && (
                        <label className="status-control">
                          Status
                          <select value={selected.status} onChange={(event) => updateStatus(selected.id, event.target.value)}>
                            <option value="active">Active</option>
                            <option value="in_service">In service</option>
                            <option value="repairing">Repairing</option>
                            <option value="repaired">Repaired</option>
                            <option value="retired">Retired</option>
                            <option value="damaged">Damaged</option>
                          </select>
                        </label>
                      )}
                    </div>
                    <dl className="asset-facts">
                      <div><dt>Client</dt><dd>{data.clients.find((client) => client.id === selected.clientId)?.companyName || "Not assigned"}</dd></div>
                      <div><dt>Brand / model</dt><dd>{selected.brand || "Not recorded"} / {selected.model || "Not recorded"}</dd></div>
                      <div><dt>Location</dt><dd>{selected.location || "Not recorded"}</dd></div>
                      <div><dt>Warranty ends</dt><dd>{selected.warrantyEndDate || "Not recorded"}</dd></div>
                      <div className="wide"><dt>Notes</dt><dd>{selected.notes || "No notes"}</dd></div>
                    </dl>
                  </div>
                </div>
                {user.role === "admin" && (
                  <>
                    <AssetMediaPanel
                      asset={selected}
                      onAddImage={(imageUrl) => addImage(selected.id, imageUrl)}
                      onAddDocument={(documentName) => addDocument(selected.id, documentName)}
                      onRemoveImage={(imageUrl) => removeImage(selected.id, imageUrl)}
                      onRemoveDocument={(_document, index) => removeDocument(selected.id, index)}
                    />
                    <LifecycleManager asset={selected} onAddLifecycle={(form) => addLifecycle(selected.id, form)} />
                  </>
            )}
              </>
            )}
            {assetView === "add" && (
              <div className="asset-subpage">
                <div className="panel asset-subpage-intro">
                  <span className="eyebrow">New asset</span>
                  <h2>Create a new managed asset</h2>
                  <p>Use the guided wizard to assign the company, record identity details, and upload starting media before saving.</p>
                </div>
                {user.role === "admin" && <AssetCategoryManager categories={selectedCompanyCategories} onCreateCategory={createCategory} />}
                <AssetForm clients={editableClients} categories={selectedCompanyCategories} existingAssets={data.assets} onCreate={createAsset} lockedClientId={filterClientId || (user.role === "client" ? user.clientId : "")} />
              </div>
            )}
            {assetView === "edit" && (
              selected ? (
                <div className="asset-subpage">
                  <div className="panel asset-subpage-intro">
                    <span className="eyebrow">Editing</span>
                    <h2>{selected.name}</h2>
                    <p>Update asset details, media, and lifecycle information from this dedicated edit workspace.</p>
                  </div>
                  {user.role === "admin" && <AssetCategoryManager categories={selectedCompanyCategories} onCreateCategory={createCategory} />}
                  <AssetEditor key={selected.id} asset={selected} clients={editableClients} categories={selectedCompanyCategories} onUpdate={updateAsset} onDelete={deleteAsset} canDelete={user.role === "admin"} lockedClientId={user.role === "client" ? user.clientId : ""} />
                  <AssetMediaPanel
                    asset={selected}
                    onAddImage={(imageUrl) => addImage(selected.id, imageUrl)}
                    onAddDocument={(documentName) => addDocument(selected.id, documentName)}
                    onRemoveImage={(imageUrl) => removeImage(selected.id, imageUrl)}
                    onRemoveDocument={(_document, index) => removeDocument(selected.id, index)}
                  />
                  <LifecycleManager asset={selected} onAddLifecycle={(form) => addLifecycle(selected.id, form)} />
                </div>
              ) : (
                <div className="panel empty-state">
                  <Archive size={28} />
                  <h2>Select an asset to edit</h2>
                  <p>Choose an asset from the list to open its edit page.</p>
                </div>
              )
            )}
          </>
        ) : (
          <div className="panel empty-state asset-empty-state">
            <Archive size={28} />
            <h2>{user.role === "admin" ? "No assets yet" : "No assets available"}</h2>
            <p>{user.role === "admin" ? "Create the first asset to start tracking lifecycle, service, and media records." : "No assets are available for this account right now."}</p>
            {user.role === "admin" && (
              <button className="primary" type="button" onClick={openAssetForm}>
                <Plus size={16} /> Add asset
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function HistoryPanel({ title, items }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <div className="timeline">
        {items.map((item) => (
          <div key={item.id} className="timeline-item">
            <small>{item.createdAt || item.serviceDate}</small>
            <strong>{item.type || item.serviceType}</strong>
            <p>{formatLifecycleDescription(item)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppealsPage({ user, data, scopedAppeals, scopedAssets, setData, notify }) {
  const [selectedId, setSelectedId] = useState(scopedAppeals[0]?.id);
  const [newIssue, setNewIssue] = useState({ assetId: scopedAssets[0]?.id || "", title: "", description: "", priority: "medium" });
  const [newIssueFile, setNewIssueFile] = useState(null);
  const [uploadingAppeal, setUploadingAppeal] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const selected = scopedAppeals.find((appeal) => appeal.id === selectedId) || scopedAppeals[0];
  const selectedMessages = selected ? data.appealMessages.filter((message) => message.appealId === selected.id) : [];
  const selectedAttachments = selectedMessages.flatMap((message) => message.attachments || []);
  const selectedEngineer = selected?.assignedEngineerId ? data.engineers.find((engineer) => engineer.id === selected.assignedEngineerId) : null;
  const activeStatuses = ["open", "in_review", "awaiting_client"];
  const sortedAppeals = [...scopedAppeals].sort((first, second) => new Date(second.updatedAt) - new Date(first.updatedAt));
  const activeAppeals = sortedAppeals.filter((appeal) => activeStatuses.includes(appeal.status));
  const pastAppeals = sortedAppeals.filter((appeal) => ["resolved", "approved", "closed"].includes(appeal.status));

  useEffect(() => {
    if (!scopedAppeals.length) {
      setSelectedId(undefined);
      return;
    }
    if (!scopedAppeals.some((appeal) => appeal.id === selectedId)) {
      setSelectedId(scopedAppeals[0].id);
    }
  }, [scopedAppeals, selectedId]);

  function getAsset(assetId) {
    return data.assets.find((asset) => asset.id === assetId);
  }

  function getClient(clientId) {
    return data.clients.find((client) => client.id === clientId);
  }

  function renderAppealCard(appeal) {
    const asset = getAsset(appeal.assetId);
    const client = getClient(appeal.clientId);
    return (
      <button key={appeal.id} className={selected?.id === appeal.id ? "appeal-card active" : "appeal-card"} onClick={() => setSelectedId(appeal.id)}>
        <div className="appeal-card-main">
          <div className="appeal-card-badges">
            <span className={statusClass(appeal.priority)}>{appeal.priority}</span>
            <span className={statusClass(appeal.status)}>{formatStatusLabel(appeal.status)}</span>
          </div>
          <strong>{appeal.title}</strong>
          <small>{asset?.name || "Unknown asset"}</small>
          <small>{client?.companyName || "Unknown company"}</small>
        </div>
        <div className="appeal-card-meta">
          <small><span>Updated</span>{formatTimestamp(appeal.updatedAt)}</small>
          <small><span>Raised</span>{formatTimestamp(appeal.createdAt)}</small>
        </div>
      </button>
    );
  }

  async function createAppeal(event) {
    event.preventDefault();
    setUploadingAppeal(true);
    setUploadError("");
    const asset = data.assets.find((item) => item.id === newIssue.assetId);
    if (!asset) {
      setUploadError("Select a valid asset before submitting the issue.");
      setUploadingAppeal(false);
      return;
    }
    let attachments = [];
    try {
      if (newIssueFile) {
        attachments = [await uploadFile(newIssueFile)];
      }
    } catch (error) {
      setUploadError(uploadErrorMessage(error));
      setUploadingAppeal(false);
      return;
    }
    const appeal = {
      id: uid("ap"),
      assetId: newIssue.assetId,
      clientId: asset.clientId,
      assignedEngineerId: null,
      raisedBy: user.id,
      title: newIssue.title,
      description: newIssue.description,
      priority: newIssue.priority,
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const initialMessage = attachments.length > 0
      ? {
          id: uid("m"),
          appealId: appeal.id,
          senderId: user.id,
          message: newIssue.description,
          attachments,
          createdAt: appeal.createdAt
        }
      : null;
    setData((current) => withNotification(
      {
        ...current,
        appeals: [appeal, ...current.appeals],
        appealMessages: initialMessage ? [initialMessage, ...current.appealMessages] : current.appealMessages
      },
      {
        type: "appeal_created",
        title: "Issue raised",
        message: `${appeal.title} was raised by ${user.name}.`,
        clientId: appeal.clientId,
        actorRole: user.role,
        actorName: user.name,
        entityType: "appeal",
        entityId: appeal.id,
        tone: "warning"
      }
    ));
    setSelectedId(appeal.id);
    setNewIssue({ assetId: scopedAssets[0]?.id || "", title: "", description: "", priority: "medium" });
    setNewIssueFile(null);
    setUploadingAppeal(false);
    notify("Issue submitted successfully.");
  }

  function updateSelectedAppeal(updater, message) {
    if (!selected) return;
    setData((current) => {
      const target = current.appeals.find((appeal) => appeal.id === selected.id);
      const patch = typeof updater === "function" ? updater(target) : updater;
      return withNotification({
        ...current,
        appeals: current.appeals.map((appeal) =>
          appeal.id === selected.id
            ? { ...appeal, ...patch, updatedAt: new Date().toISOString() }
            : appeal
        )
      }, {
        type: "appeal_updated",
        title: "Issue updated",
        message: message || `${target?.title || "Issue"} was updated by ${user.role}.`,
        clientId: target?.clientId,
        actorRole: user.role,
        actorName: user.name,
        entityType: "appeal",
        entityId: selected.id
      });
    });
    if (message) notify(message);
  }

  function setStatus(status) {
    const nextSelectedId = status === "closed"
      ? sortedAppeals.find((appeal) => appeal.id !== selected.id && appeal.status !== "closed")?.id
      : selected.id;
    updateSelectedAppeal({ status }, `Appeal marked ${formatStatusLabel(status).toLowerCase()}.`);
    if (status === "closed") {
      setSelectedId(nextSelectedId);
    }
  }

  const assignmentLocked = ["resolved", "approved", "closed"].includes(selected?.status);

  return (
    <section className={user.role === "admin" ? "appeals-layout" : "appeals-layout client-appeals-layout"}>
      <div className="appeals-board">
        <div className="panel appeal-section">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Needs attention</span>
              <h2>New and active appeals</h2>
            </div>
            <span className="badge open">{activeAppeals.length}</span>
          </div>
          <div className="appeal-list redesigned">
            {activeAppeals.length > 0 ? activeAppeals.map(renderAppealCard) : <div className="empty-inline">No active appeals.</div>}
          </div>
        </div>
          <div className="panel appeal-section">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Past records</span>
              <h2>Resolved and closed appeals</h2>
              </div>
              <span className="badge resolved">{pastAppeals.length}</span>
            </div>
          <div className="appeal-list redesigned compact-appeals">
            {pastAppeals.length > 0 ? pastAppeals.map(renderAppealCard) : <div className="empty-inline">No past appeals yet.</div>}
          </div>
        </div>
      </div>
      {selected && (
        <div className="panel conversation">
          <div className="conversation-head">
            <div>
              <span className={statusClass(selected.priority)}>{selected.priority}</span>
              <h2>{selected.title}</h2>
              <p>{getAsset(selected.assetId)?.name} - {getClient(selected.clientId)?.companyName}</p>
              <div className="appeal-timestamps">
                <span>Raised {formatTimestamp(selected.createdAt)}</span>
                <span>Last updated {formatTimestamp(selected.updatedAt)}</span>
              </div>
            </div>
            {user.role === "admin" && (
              selected.status === "resolved" ? (
                <button className="secondary" type="button" onClick={() => updateSelectedAppeal({ status: "open" }, "Appeal moved back to open.")}>Undo resolve</button>
              ) : selected.status === "approved" ? (
                <span className="badge approved">Approved</span>
              ) : (
                <select value={selected.status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="open">Open</option>
                  <option value="in_review">In review</option>
                  <option value="awaiting_client">Waiting to Client&apos;s approval</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed/Cancelled</option>
                </select>
              )
            )}
          </div>
          <div className="issue-record">
            <div>
              <span className="eyebrow">Issue details</span>
              <p>{selected.description}</p>
            </div>
            <div className="issue-record-grid">
              <span><strong>Status</strong>{formatStatusLabel(selected.status)}</span>
              <span><strong>Priority</strong>{selected.priority}</span>
              <span><strong>Raised</strong>{formatTimestamp(selected.createdAt)}</span>
              <span><strong>Updated</strong>{formatTimestamp(selected.updatedAt)}</span>
              <span><strong>Assigned engineer</strong>{selectedEngineer?.name || "Not assigned"}</span>
              <span><strong>Engineer contact</strong>{selectedEngineer?.email || selectedEngineer?.phone || "Not shared yet"}</span>
            </div>
            {user.role === "admin" && (
              <label className="engineer-assign">
                Assign engineer
                {assignmentLocked ? (
                  <div className="locked-field">
                    <span>{selectedEngineer?.name || "Unassigned"}</span>
                    <small>Engineer assignment is locked after the appeal is resolved.</small>
                  </div>
                ) : (
                  <select
                    value={selected.assignedEngineerId || ""}
                    onChange={(event) => updateSelectedAppeal({ assignedEngineerId: event.target.value || null }, event.target.value ? "Engineer assigned to appeal." : "Engineer assignment cleared.")}
                  >
                    <option value="">Unassigned</option>
                    {data.engineers.map((engineer) => (
                      <option key={engineer.id} value={engineer.id}>{engineer.name} {engineer.specialization ? `- ${engineer.specialization}` : ""}</option>
                    ))}
                  </select>
                )}
              </label>
            )}
            {user.role === "client" && selected.status === "awaiting_client" && (
              <button className="primary inline-action" type="button" onClick={() => updateSelectedAppeal({ status: "approved" }, "Appeal approved and sent to admin.")}>
                <CheckCircle2 size={16} /> Approve
              </button>
            )}
            {selectedAttachments.length > 0 && (
              <div className="appeal-attachments">
                <span className="eyebrow">Attachments</span>
                <div className="attachment-gallery">
                  {selectedAttachments.map((attachment, index) => {
                    const url = typeof attachment === "string" ? attachment : attachment?.url;
                    if (!url) return null;
                    const label = typeof attachment === "string"
                      ? fileNameFromUrl(attachment)
                      : attachment.fileName || attachment.originalName || fileNameFromUrl(url);
                    const mimeType = typeof attachment === "string" ? "" : attachment.mimeType || "";
                    return (
                      <a key={`${url}-${index}`} className="attachment-preview" href={url} target="_blank" rel="noreferrer">
                        {mimeType.startsWith("image/") ? (
                          <img src={resolveMediaUrl(url)} alt={label} />
                        ) : (
                          <div className="attachment-file">
                            <Paperclip size={16} />
                            <span>{label}</span>
                          </div>
                        )}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {uploadError && <small className="upload-error">{uploadError}</small>}
        </div>
      )}
      {user.role === "client" && (
        <form className="panel issue-form" onSubmit={createAppeal}>
          <div className="panel-head">
            <div>
              <span className="eyebrow">Client action</span>
              <h2>Raise issue</h2>
            </div>
            <span className="badge open">New</span>
          </div>
          <label>
            Asset
            <select
              value={newIssue.assetId}
              onChange={(event) => setNewIssue((current) => ({ ...current, assetId: event.target.value }))}
              disabled={scopedAssets.length === 0}
              required
            >
              {scopedAssets.length === 0 ? <option value="">No assets available</option> : scopedAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
          </label>
          <label>
            Issue title
            <input placeholder="Short issue title" value={newIssue.title} onChange={(event) => setNewIssue((current) => ({ ...current, title: event.target.value }))} required />
          </label>
          <label>
            Priority
            <select value={newIssue.priority} onChange={(event) => setNewIssue((current) => ({ ...current, priority: event.target.value }))}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label>
            Problem details
            <textarea placeholder="Describe what is happening, when it started, and any impact." value={newIssue.description} onChange={(event) => setNewIssue((current) => ({ ...current, description: event.target.value }))} required />
          </label>
          <label className="file-field">
            Supporting file
            <input id="new-issue-file" type="file" accept=".jpg,.jpeg,.png,.pdf,.doc" onChange={(event) => setNewIssueFile(event.target.files?.[0] || null)} />
            <span><Paperclip size={15} /> {newIssueFile?.name || "Attach image or document"}</span>
          </label>
          <button className="primary" type="submit" disabled={uploadingAppeal}><AlertCircle size={16} /> Submit issue</button>
        </form>
      )}
    </section>
  );
}

function ServicePage({ user, data, setData, notify }) {
  const availableEngineers = (data.engineers || []).filter((engineer) => engineer.status !== "inactive");
  const [selectedRecordId, setSelectedRecordId] = useState(data.serviceRecords[0]?.id || "");
  const selectedRecord = data.serviceRecords.find((record) => record.id === selectedRecordId);
  const selectedRecordAsset = selectedRecord ? data.assets.find((asset) => asset.id === selectedRecord.assetId) : null;
  const [statusDraft, setStatusDraft] = useState(selectedRecord?.status || "repairing");
  const [form, setForm] = useState({
    clientId: data.assets[0]?.clientId || data.clients[0]?.id || "",
    assetId: data.assets[0]?.id || "",
    serviceType: "Repair",
    technicianName: data.engineers?.find((engineer) => engineer.status !== "inactive")?.name || "",
    description: "",
    nextServiceDue: addMonths(today(), 1),
    nextServiceTerm: "1M",
    status: "repairing"
  });
  const availableAssets = data.assets.filter((asset) => asset.clientId === form.clientId);
  const sortedRecords = sortByNewestDate(data.serviceRecords, "serviceDate");
  const pendingRecords = data.serviceRecords.filter((record) => ["repairing", "pending"].includes(record.status));
  const completedRecords = data.serviceRecords.filter((record) => ["repaired", "completed"].includes(record.status));
  const dueSoonRecords = data.serviceRecords.filter((record) => record.nextServiceDue && record.nextServiceDue <= "2026-06-30");

  useEffect(() => {
    setStatusDraft(selectedRecord?.status || "repairing");
  }, [selectedRecord?.id, selectedRecord?.status]);

  function updateForm(field, value) {
    setForm((current) => {
      if (field === "clientId") {
        const nextAssets = data.assets.filter((asset) => asset.clientId === value);
        return { ...current, clientId: value, assetId: nextAssets[0]?.id || "" };
      }
      if (field === "nextServiceTerm") {
        return { ...current, nextServiceTerm: value, nextServiceDue: addMonths(today(), monthsForTerm(value, SERVICE_DUE_TERMS)) };
      }
      return { ...current, [field]: value };
    });
  }

  function updateSelectedRecordStatus(event) {
    event.preventDefault();
    if (!selectedRecord) return;
    setData((current) => {
      const asset = current.assets.find((item) => item.id === selectedRecord.assetId);
      const nextAssetStatus = statusDraft === "repaired" || statusDraft === "completed" ? "repaired" : statusDraft;
      return withNotification({
        ...current,
        assets: current.assets.map((item) =>
          item.id === selectedRecord.assetId
            ? {
                ...item,
                status: nextAssetStatus,
                lifecycle: [
                  ...item.lifecycle,
                  { id: uid("l"), type: "Service", description: `Service status changed to ${formatStatusLabel(statusDraft)}.`, createdAt: today() }
                ]
              }
            : item
        ),
        serviceRecords: current.serviceRecords.map((record) =>
          record.id === selectedRecord.id ? { ...record, status: statusDraft } : record
        )
      }, {
        type: "service_status_updated",
        title: "Service status updated",
        message: `${asset?.name || "Asset"} service status changed to ${formatStatusLabel(statusDraft)}.`,
        clientId: asset?.clientId,
        actorRole: "admin",
        actorName: user.name,
        entityType: "service",
        entityId: selectedRecord.id
      });
    });
    notify("Service status updated.");
  }

  function submit(event) {
    event.preventDefault();
    const assetName = availableAssets.find((asset) => asset.id === form.assetId)?.name || "Asset";
    setData((current) => {
      const latestRecord = getLatestServiceRecord(current.serviceRecords, form.assetId);
      const asset = current.assets.find((item) => item.id === form.assetId);
      const nextAssetStatus = form.status === "repairing" ? "repairing" : "repaired";
      const lifecycleNote = form.status === "repairing"
        ? "Asset assigned for repair by admin."
        : "Asset marked repaired by admin.";
      const updatedAssets = current.assets.map((item) =>
        item.id === form.assetId
          ? {
              ...item,
              status: nextAssetStatus,
              lifecycle: [
                ...item.lifecycle,
                { id: uid("l"), type: "Service", description: lifecycleNote, createdAt: today() }
              ]
            }
          : item
      );

      if (latestRecord && ["repairing", "pending"].includes(latestRecord.status)) {
        const updatedRecord = {
          ...latestRecord,
          ...form,
          serviceDate: today()
        };
        return withNotification({
          ...current,
          assets: updatedAssets,
          serviceRecords: current.serviceRecords.map((record) => record.id === latestRecord.id ? updatedRecord : record)
        }, {
          type: "service_updated",
          title: "Service updated",
          message: `${asset?.name || "Asset"} was marked ${formatStatusLabel(form.status).toLowerCase()} by admin.`,
          clientId: asset?.clientId,
          actorRole: "admin",
          actorName: user.name,
          entityType: "service",
          entityId: latestRecord.id
        });
      }

      const record = {
        id: uid("s"),
        ...form,
        serviceDate: today(),
        description: form.description || `${asset?.name || "Asset"} marked ${formatStatusLabel(form.status).toLowerCase()}.`
      };
      return withNotification(
        { ...current, assets: updatedAssets, serviceRecords: [record, ...current.serviceRecords] },
        {
          type: "service_created",
          title: "Service record added",
          message: `${asset?.name || "Asset"} was marked ${formatStatusLabel(form.status).toLowerCase()} by admin.`,
          clientId: asset?.clientId,
          actorRole: "admin",
          actorName: user.name,
          entityType: "service",
          entityId: record.id
        }
      );
    });
    setForm((current) => ({
      ...current,
      assetId: data.assets.filter((asset) => asset.clientId === current.clientId)[0]?.id || "",
      technicianName: availableEngineers[0]?.name || "",
      description: "",
      nextServiceDue: addMonths(today(), 1),
      nextServiceTerm: "1M",
      status: "repairing"
    }));
    notify(`${assetName} marked ${formatStatusLabel(form.status).toLowerCase()}.`);
  }

  return (
    <section className="service-page">
      <div className="service-summary">
        <div className="stat">
          <div><History size={22} /></div>
          <strong>{data.serviceRecords.length}</strong>
          <span>Total records</span>
        </div>
        <div className="stat">
          <div><Clock size={22} /></div>
          <strong>{pendingRecords.length}</strong>
          <span>Repairing</span>
        </div>
        <div className="stat">
          <div><CheckCircle2 size={22} /></div>
          <strong>{completedRecords.length}</strong>
          <span>Repaired</span>
        </div>
        <div className="stat">
          <div><AlertCircle size={22} /></div>
          <strong>{dueSoonRecords.length}</strong>
          <span>Due soon</span>
        </div>
      </div>

      <div className="service-layout">
        <div className="panel service-history-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Maintenance log</span>
              <h2>Service records</h2>
            </div>
            <span className="badge active">{sortedRecords.length}</span>
          </div>
          <div className="service-record-list">
            {sortedRecords.length > 0 ? sortedRecords.map((record) => {
              const asset = data.assets.find((item) => item.id === record.assetId);
              return (
                <button key={record.id} type="button" className={selectedRecordId === record.id ? "service-record-card active selectable" : "service-record-card selectable"} onClick={() => setSelectedRecordId(record.id)}>
                  <div className="service-record-main">
                    <span className={statusClass(record.status)}>{formatStatusLabel(record.status)}</span>
                    <strong>{record.serviceType}</strong>
                    <p>{record.description || "No service description recorded."}</p>
                  </div>
                  <div className="service-record-meta">
                    <span><strong>Asset</strong>{asset?.name || "Unknown asset"}</span>
                    <span><strong>Client</strong>{data.clients.find((item) => item.id === asset?.clientId)?.companyName || "Unknown client"}</span>
                    <span><strong>Serviced</strong>{record.serviceDate || "Not recorded"}</span>
                    <span><strong>Technician</strong>{record.technicianName || "Not assigned"}</span>
                    <span><strong>Next due</strong>{record.nextServiceDue || "Not scheduled"}</span>
                  </div>
                </button>
              );
            }) : <div className="empty-inline">No service records yet.</div>}
          </div>
        </div>

        <div className="service-side-stack">
        {selectedRecord && (
          <form className="panel service-form" onSubmit={updateSelectedRecordStatus}>
            <div className="panel-head">
              <div>
                <span className="eyebrow">Edit status only</span>
                <h2>{selectedRecordAsset?.name || "Service record"}</h2>
              </div>
              <span className={statusClass(selectedRecord.status)}>{formatStatusLabel(selectedRecord.status)}</span>
            </div>
            <label>
              Status
              <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
                <option value="repairing">Repairing</option>
                <option value="pending">Pending</option>
                <option value="repaired">Repaired</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <button className="primary" type="submit"><Save size={16} /> Update status</button>
          </form>
        )}

        <form className="panel service-form" onSubmit={submit}>
          <div className="panel-head">
            <div>
              <span className="eyebrow">New entry</span>
              <h2>Add service record</h2>
            </div>
            <span className="badge active">Service</span>
          </div>
          <label>
            Client
            <select value={form.clientId} onChange={(event) => updateForm("clientId", event.target.value)}>
              {data.clients.map((client) => <option key={client.id} value={client.id}>{client.companyName}</option>)}
            </select>
          </label>
          <label>
            Asset
            <select value={form.assetId} onChange={(event) => updateForm("assetId", event.target.value)}>
              {availableAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
          </label>
          <div className="field-grid">
            <label>
              Service type
              <input placeholder="Inspection, repair, replacement" value={form.serviceType} onChange={(event) => updateForm("serviceType", event.target.value)} />
            </label>
            <label>
              Status
              <select value={form.status} onChange={(event) => updateForm("status", event.target.value)}>
                <option value="repairing">Repairing</option>
                <option value="repaired">Repaired</option>
              </select>
            </label>
          </div>
          <label>
            Engineer
            <select value={form.technicianName} onChange={(event) => updateForm("technicianName", event.target.value)}>
              <option value="">Select engineer</option>
              {availableEngineers.map((engineer) => (
                <option key={engineer.id} value={engineer.name}>
                  {engineer.name}{engineer.specialization ? ` - ${engineer.specialization}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Next service due
            <select value={form.nextServiceTerm} onChange={(event) => updateForm("nextServiceTerm", event.target.value)}>
              {SERVICE_DUE_TERMS.map((term) => <option key={term.label} value={term.label}>{term.label}</option>)}
            </select>
            <input type="date" value={form.nextServiceDue} onChange={(event) => updateForm("nextServiceDue", event.target.value)} />
          </label>
          <label>
            Service description
            <textarea placeholder="Work completed, parts replaced, test result, or next action" value={form.description} onChange={(event) => updateForm("description", event.target.value)} required />
          </label>
          <button className="primary" type="submit"><CheckCircle2 size={16} /> Save service</button>
        </form>
        </div>
      </div>
    </section>
  );
}

function ClientServiceHistoryPage({ scopedAssets, data }) {
  const scopedServiceRecords = sortByNewestDate(getScopedServiceRecords(data.serviceRecords, scopedAssets), "serviceDate");

  return (
    <section className="page-grid">
      <div className="stats-grid">
        <Stat label="Service records" value={scopedServiceRecords.length} icon={<History />} />
        <Stat label="Repairing" value={scopedServiceRecords.filter((record) => ["repairing", "pending"].includes(record.status)).length} icon={<Clock />} />
        <Stat label="Repaired" value={scopedServiceRecords.filter((record) => ["repaired", "completed"].includes(record.status)).length} icon={<CheckCircle2 />} />
        <Stat label="Due soon" value={scopedServiceRecords.filter((record) => record.nextServiceDue && record.nextServiceDue <= "2026-06-30").length} icon={<AlertCircle />} />
      </div>
      <div className="panel service-history-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Client view</span>
            <h2>Service history</h2>
          </div>
          <span className="badge active">{scopedServiceRecords.length}</span>
        </div>
        <div className="timeline">
          {scopedServiceRecords.length > 0 ? scopedServiceRecords.map((record) => {
            const asset = scopedAssets.find((item) => item.id === record.assetId);
            return (
              <div key={record.id} className="timeline-item">
                <small>{record.serviceDate || "Not recorded"}</small>
                <strong>{asset?.name || "Unknown asset"} - {record.serviceType}</strong>
                <p>{record.description}</p>
                <small>{record.technicianName || "Engineer not assigned"} / {formatStatusLabel(record.status)}</small>
              </div>
            );
          }) : <div className="empty-inline">No service history yet.</div>}
        </div>
      </div>
    </section>
  );
}

function InactiveCompanyPage({ clientBrand }) {
  return (
    <section className="page-grid">
      <div className="panel inactive-warning">
        <span className="eyebrow">Access restricted</span>
        <h2>{clientBrand?.companyName || "This company"} is inactive</h2>
        <p>This client portal is unavailable because the company has been marked inactive. Please contact HAAK INFOTECH admin for reactivation.</p>
      </div>
    </section>
  );
}

function AdminSettingsPage({ data, notify, onUpdateClientCredentials, onResolveCredentialRequest, onChangeAdminPassword, onUpdateAdminAlertEmail, onSendAdminAlertTest }) {
  const clientUsers = data.users.filter((user) => user.role === "client");
  const adminUser = data.users.find((item) => item.role === "admin");
  const pendingRequests = (data.credentialRequests || []).filter((request) => request.status === "pending");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [adminAlertEmail, setAdminAlertEmail] = useState(data.settings?.adminAlertEmail || DEFAULT_ADMIN_ALERT_EMAIL);
  const [adminEmailStatus, setAdminEmailStatus] = useState(null);
  const [credentialSaveState, setCredentialSaveState] = useState({});
  const [credentialDrafts, setCredentialDrafts] = useState(() =>
    Object.fromEntries(clientUsers.map((user) => [user.id, { email: user.email, password: "" }]))
  );

  useEffect(() => {
    setCredentialDrafts(Object.fromEntries(clientUsers.map((user) => [user.id, { email: user.email, password: "" }])));
  }, [data.users]);

  useEffect(() => {
    setAdminAlertEmail(data.settings?.adminAlertEmail || DEFAULT_ADMIN_ALERT_EMAIL);
  }, [data.settings?.adminAlertEmail]);

  function updateDraft(userId, field, value) {
    setCredentialDrafts((current) => ({
      ...current,
      [userId]: { ...(current[userId] || { email: "", password: "" }), [field]: value }
    }));
  }

  async function submitPasswordChange(event) {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      notify("New password and confirmation do not match.", "error");
      return;
    }
    const changed = await onChangeAdminPassword(passwordForm.currentPassword, passwordForm.newPassword);
    if (changed) setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
  }

  function submitAdminAlertEmail(event) {
    event.preventDefault();
    const updated = onUpdateAdminAlertEmail(adminAlertEmail);
    setAdminEmailStatus(updated
      ? { status: "success", message: "Alert email saved." }
      : { status: "error", message: "Enter a valid admin alert email address." });
  }

  async function submitAdminAlertTest() {
    setAdminEmailStatus({ status: "saving", message: "Sending test email..." });
    const sent = await onSendAdminAlertTest(adminAlertEmail);
    setAdminEmailStatus(sent
      ? { status: "success", message: `Test email sent to ${adminAlertEmail.trim()}.` }
      : { status: "error", message: "Test email was not sent. Check SMTP settings and Railway logs." });
  }

  async function submitClientCredentials(userId, clientId, nextEmail, nextPassword) {
    setCredentialSaveState((current) => ({ ...current, [userId]: { status: "saving", message: "Saving..." } }));
    const updated = await onUpdateClientCredentials(clientId, nextEmail, nextPassword);
    if (updated) {
      setCredentialSaveState((current) => ({ ...current, [userId]: { status: "success", message: "Credentials updated." } }));
      updateDraft(userId, "password", "");
      window.setTimeout(() => {
        setCredentialSaveState((current) => {
          if (current[userId]?.status !== "success") return current;
          const { [userId]: _removed, ...rest } = current;
          return rest;
        });
      }, 3200);
    } else {
      setCredentialSaveState((current) => ({ ...current, [userId]: { status: "error", message: "Could not update. Check the message above and try again." } }));
    }
  }

  return (
    <section className="page-grid">
      <div className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Mail alerts</span>
            <h2>Admin alert email</h2>
          </div>
        </div>
        <form className="form-grid" onSubmit={submitAdminAlertEmail}>
          <input type="email" placeholder="admin@example.com" value={adminAlertEmail} onChange={(event) => setAdminAlertEmail(event.target.value)} required />
          <div className="field-grid">
            <button className="primary inline-action" type="submit"><Save size={16} /> Save alert email</button>
            <button className="secondary inline-action" type="button" disabled={adminEmailStatus?.status === "saving"} onClick={submitAdminAlertTest}>
              <Mail size={16} /> {adminEmailStatus?.status === "saving" ? "Sending..." : "Send test email"}
            </button>
          </div>
          {adminEmailStatus?.message && <small className={`settings-save-status ${adminEmailStatus.status}`}>{adminEmailStatus.message}</small>}
        </form>
      </div>
      <div className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Admin security</span>
            <h2>Change your password</h2>
          </div>
        </div>
        <PasswordRotationNotice user={adminUser} />
        <form className="form-grid settings-password-form" onSubmit={submitPasswordChange}>
          <input type="password" autoComplete="current-password" placeholder="Current password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} required />
          <div className="field-grid">
            <input type="password" autoComplete="new-password" placeholder="New password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} required />
            <input type="password" autoComplete="new-password" placeholder="Confirm new password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} required />
          </div>
          <PasswordPolicyHint password={passwordForm.newPassword} />
          <button className="primary inline-action" type="submit"><Save size={16} /> Update password</button>
        </form>
      </div>
      <div className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Admin settings</span>
            <h2>Client login credentials</h2>
          </div>
        </div>
        <div className="settings-list">
          {clientUsers.map((user) => {
            const client = data.clients.find((item) => item.id === user.clientId);
            const draft = credentialDrafts[user.id] || { email: user.email, password: "" };
            const saveState = credentialSaveState[user.id];
            const isSaving = saveState?.status === "saving";
            return (
              <div key={user.id} className="settings-row">
                <div>
                  <strong>{client?.companyName || "Unknown company"}</strong>
                  <small>{client?.contactPerson || "No contact"}</small>
                </div>
                <input type="email" placeholder="Login email" value={draft.email} onChange={(event) => updateDraft(user.id, "email", event.target.value)} />
                <input type="password" placeholder="New password" value={draft.password} onChange={(event) => updateDraft(user.id, "password", event.target.value)} />
                <button className="primary" type="button" disabled={isSaving} onClick={() => submitClientCredentials(user.id, user.clientId, draft.email, draft.password)}>
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <PasswordRotationNotice user={user} />
                {saveState?.message && <small className={`settings-save-status ${saveState.status}`}>{saveState.message}</small>}
                {draft.password && <PasswordPolicyHint password={draft.password} />}
              </div>
            );
          })}
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Client requests</span>
            <h2>Credential change requests</h2>
          </div>
          <span className="badge open">{pendingRequests.length}</span>
        </div>
        <div className="settings-list">
          {pendingRequests.length > 0 ? pendingRequests.map((request) => {
            const client = data.clients.find((item) => item.id === request.clientId);
            return (
              <div key={request.id} className="settings-request">
                <div>
                  <strong>{client?.companyName || "Unknown company"}</strong>
                  <small>Requested {formatTimestamp(request.createdAt)}</small>
                </div>
                <span><strong>Email</strong>{request.requestedEmail || "No change requested"}</span>
                <span><strong>Password</strong>{request.requestedPassword ? "Requested" : "No change requested"}</span>
                <span><strong>Note</strong>{request.note || "No note provided"}</span>
                <div className="settings-actions">
                  <button className="primary" type="button" onClick={() => onResolveCredentialRequest(request.id, "approved")}>Approve</button>
                  <button className="secondary" type="button" onClick={() => onResolveCredentialRequest(request.id, "rejected")}>Reject</button>
                </div>
              </div>
            );
          }) : <div className="empty-inline">No pending credential requests.</div>}
        </div>
      </div>
    </section>
  );
}

function ClientSettingsPage({ user, data, notify, onSubmitCredentialRequest }) {
  const existingPending = (data.credentialRequests || []).find((request) => request.clientId === user.clientId && request.status === "pending");
  const [form, setForm] = useState({ requestedEmail: "", requestedPassword: "", note: "" });

  function submit(event) {
    event.preventDefault();
    onSubmitCredentialRequest(form);
    setForm({ requestedEmail: "", requestedPassword: "", note: "" });
  }

  return (
    <section className="page-grid">
      <div className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Client settings</span>
            <h2>Request credential change</h2>
          </div>
        </div>
        {existingPending ? (
          <div className="inactive-warning compact-warning">
            <h2>Request pending</h2>
            <p>Your previous credential change request is waiting for admin review.</p>
          </div>
        ) : (
          <form className="form-grid" onSubmit={submit}>
            <input type="email" placeholder="Requested login email" value={form.requestedEmail} onChange={(event) => setForm((current) => ({ ...current, requestedEmail: event.target.value }))} />
            <input type="password" placeholder="Requested new password" value={form.requestedPassword} onChange={(event) => setForm((current) => ({ ...current, requestedPassword: event.target.value }))} />
            <PasswordRotationNotice user={user} />
            {form.requestedPassword && <PasswordPolicyHint password={form.requestedPassword} />}
            <textarea placeholder="Reason for change" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
            <button className="primary" type="submit">Send request</button>
          </form>
        )}
      </div>
    </section>
  );
}

export default function App() {
  const [data, setDataState] = useState(loadState);
  const [user, setUser] = useState(loadStoredUser);
  const [view, setViewState] = useState(() => loadStoredView(loadStoredUser()));
  const [apiStatus, setApiStatus] = useState(navigator.onLine ? "loading" : "offline");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(Boolean(loadPendingState()));
  const [notice, setNotice] = useState(null);
  const [showEngineerModal, setShowEngineerModal] = useState(false);
  const [theme, setTheme] = useState(loadStoredTheme);
  const seenNotificationIds = useRef({ initialized: false, ids: new Set() });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      checkApiHealth()
        .then(() => {
          if (!cancelled) setApiStatus("connected");
        })
        .catch(() => {
          if (!cancelled) setApiStatus("offline");
        });
      return () => {
        cancelled = true;
      };
    }

    const pending = loadPendingState();
    if (pending?.state) {
      apiRequest("/state", {
        method: "PUT",
        body: JSON.stringify(pending.state)
      })
        .then(() => {
          if (cancelled) return;
          setDataState(pending.state);
          saveState(pending.state);
          clearPendingState();
          setPendingSync(false);
          setApiStatus("connected");
        })
        .catch((error) => {
          if (cancelled) return;
          setApiStatus(error?.isApiError ? "connected" : "offline");
          setPendingSync(true);
          if (isConflictError(error)) {
            notify(error.message || "Sync conflict. Resolve duplicate records and save again.", "error");
          }
        });
      return () => {
        cancelled = true;
      };
    }

    apiRequest("/state")
      .then((serverState) => {
        if (cancelled) return;
        setDataState(serverState);
        saveState(serverState);
        setApiStatus("connected");
      })
      .catch((error) => {
        if (cancelled) return;
        setApiStatus(error?.isApiError ? "connected" : "offline");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function markOnline() {
      setIsOnline(true);
    }

    function markOffline() {
      setIsOnline(false);
      setApiStatus("offline");
    }

    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOnline || !user || !localStorage.getItem(TOKEN_KEY) || !loadPendingState()) return;
    syncPendingState();
  }, [isOnline, user]);

  useEffect(() => {
    if (!user) return;
    const nextView = normalizeView(view, user);
    if (nextView !== view) {
      setViewState(nextView);
      saveStoredView(nextView);
    }
  }, [user, view]);

  useEffect(() => {
    if (!user) {
      seenNotificationIds.current = { initialized: false, ids: new Set() };
      return;
    }
    const visibleNotifications = scopedNotifications(data.notifications || [], user);
    const currentIds = seenNotificationIds.current.ids;
    const freshNotifications = visibleNotifications.filter((notification) => !currentIds.has(notification.id));
    if (seenNotificationIds.current.initialized) {
      freshNotifications
        .filter((notification) => notification.actorName !== user.name)
        .reverse()
        .forEach((notification) => {
          toast(notification.title, {
            description: notification.message
          });
        });
    }
    visibleNotifications.forEach((notification) => currentIds.add(notification.id));
    seenNotificationIds.current.initialized = true;
  }, [data.notifications, user]);

  useEffect(() => {
    if (!user || !localStorage.getItem(TOKEN_KEY)) return undefined;
    const timer = window.setInterval(() => {
      if (!navigator.onLine || loadPendingState()) return;
      apiRequest("/state")
        .then((serverState) => {
          setDataState(serverState);
          saveState(serverState);
          setApiStatus("connected");
        })
        .catch((error) => setApiStatus(error?.isApiError ? "connected" : "offline"));
    }, 30000);
    return () => window.clearInterval(timer);
  }, [user]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    const todayDate = new Date(`${today()}T00:00:00`);
    const expiringClients = (data.clients || []).filter((client) => {
      if (!client.amcEndDate || client.amcRenewalNoticeSentAt) return false;
      const endDate = new Date(`${client.amcEndDate}T00:00:00`);
      if (Number.isNaN(endDate.getTime())) return false;
      const daysLeft = Math.ceil((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysLeft >= 0 && daysLeft <= 30;
    });
    if (expiringClients.length === 0) return;
    setData((current) => {
      let nextState = current;
      for (const client of expiringClients) {
        nextState = withNotification({
          ...nextState,
          clients: nextState.clients.map((item) =>
            item.id === client.id ? { ...item, amcRenewalNoticeSentAt: new Date().toISOString() } : item
          )
        }, {
          type: "amc_expiring",
          title: "AMC renewal due",
          message: `${client.companyName} AMC ends on ${client.amcEndDate}. Please renew the contract.`,
          clientId: client.id,
          actorRole: "system",
          actorName: "System",
          entityType: "amc",
          entityId: client.id,
          tone: "warning"
        });
      }
      return nextState;
    });
  }, [data.clients, user]);

  async function syncPendingState() {
    const pending = loadPendingState();
    if (!pending?.state || !localStorage.getItem(TOKEN_KEY) || !navigator.onLine) return false;
    try {
      await apiRequest("/state", {
        method: "PUT",
        body: JSON.stringify(pending.state)
      });
      setDataState(pending.state);
      saveState(pending.state);
      clearPendingState();
      setPendingSync(false);
      setApiStatus("connected");
      return true;
    } catch (error) {
      setApiStatus(error?.isApiError ? "connected" : "offline");
      setPendingSync(true);
      if (isConflictError(error)) {
        notify(error.message || "Sync conflict. Resolve duplicate records and save again.", "error");
      }
      return false;
    }
  }

  async function persistState(nextState) {
    saveState(nextState);
    if (!localStorage.getItem(TOKEN_KEY) || !navigator.onLine) {
      queuePendingState(nextState);
      setPendingSync(true);
      setApiStatus("offline");
      return;
    }

    try {
      await apiRequest("/state", {
        method: "PUT",
        body: JSON.stringify(nextState)
      });
      setDataState(nextState);
      saveState(nextState);
      setApiStatus("connected");
      clearPendingState();
      setPendingSync(false);
    } catch (error) {
      queuePendingState(nextState);
      setPendingSync(true);
      setApiStatus(error?.isApiError ? "connected" : "offline");
    }
  }

  function setData(updater) {
    setDataState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      persistState(next);
      return next;
    });
  }

  function setView(nextView, nextUser = user) {
    const normalizedView = normalizeView(nextView, nextUser);
    setViewState(normalizedView);
    saveStoredView(normalizedView);
  }

  function notify(message, tone = "success") {
    setNotice({ id: Date.now(), message, tone });
    const toastMethod = tone === "error" ? toast.error : tone === "warning" ? toast.warning : toast.success;
    toastMethod(message);
  }

  function markNotificationsRead() {
    if (!user) return;
    setData((current) => ({
      ...current,
      notifications: (current.notifications || []).map((notification) => {
        const isVisible = user.role === "admin" || notification.clientId === user.clientId;
        if (!isVisible || (notification.readBy || []).includes(user.id)) return notification;
        return { ...notification, readBy: [...(notification.readBy || []), user.id] };
      })
    }));
    notify("Notifications marked as read.");
  }

  function clearNotifications() {
    if (!user) return;
    setData((current) => ({
      ...current,
      notifications: (current.notifications || []).filter((notification) =>
        user.role === "admin" ? false : notification.clientId !== user.clientId
      )
    }));
    notify("Notifications cleared.");
  }

  function createEngineer(form) {
    const engineer = {
      id: uid("eng"),
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: "",
      specialization: "",
      status: form.status || "active"
    };
    setData((current) => ({
      ...current,
      engineers: [engineer, ...(current.engineers || [])]
    }));
    setShowEngineerModal(false);
    notify(`${engineer.name} added to engineers.`);
  }

  function updateEngineerStatus(engineerId, status) {
    setData((current) => ({
      ...current,
      engineers: (current.engineers || []).map((engineer) =>
        engineer.id === engineerId ? { ...engineer, status } : engineer
      )
    }));
    notify(`Engineer marked ${formatStatusLabel(status).toLowerCase()}.`);
  }

  function updateAdminAlertEmail(email) {
    const nextEmail = email.trim();
    if (!isValidEmail(nextEmail)) {
      notify("Enter a valid admin alert email address.", "error");
      return false;
    }
    setData((current) => ({
      ...current,
      settings: {
        ...(current.settings || {}),
        adminAlertEmail: nextEmail
      }
    }));
    notify("Admin alert email updated.");
    return true;
  }

  async function sendAdminAlertTest(email) {
    const nextEmail = email.trim();
    if (!isValidEmail(nextEmail)) {
      notify("Enter a valid admin alert email address.", "error");
      return false;
    }
    try {
      const result = await apiRequest("/email/admin-alert/test", {
        method: "POST",
        body: JSON.stringify({ email: nextEmail })
      });
      if (result.result?.sent > 0) {
        notify(`Test email sent to ${nextEmail}.`);
        return true;
      } else {
        notify("Test email was not sent. Check SMTP settings.", "warning");
        return false;
      }
    } catch (error) {
      if (error?.status === 404) {
        notify("Email test is not available on the running backend. Restart the backend and try again.", "error");
      } else {
        notify(friendlyErrorMessage(error), "error");
      }
      return false;
    }
  }

  async function updateClientCredentials(clientId, nextEmail, nextPassword) {
    if (!isValidEmail(nextEmail)) {
      notify("Enter a valid login email address.", "error");
      return;
    }
    if (nextPassword && nextPassword.length < 8) {
      notify("Password must be at least 8 characters.", "error");
      return;
    }
    if (!localStorage.getItem(TOKEN_KEY)) {
      notify("Sign in again before changing client login credentials.", "error");
      return;
    }

    try {
      const result = await apiRequest(`/clients/${clientId}/credentials`, {
        method: "PUT",
        body: JSON.stringify({ email: nextEmail.trim(), password: nextPassword || "" })
      });
      const nextState = withNotification(result.state, {
        type: "credentials_updated",
        title: "Client login updated",
        message: "Client login credentials were updated by admin.",
        clientId,
        actorRole: "admin",
        actorName: user.name,
        entityType: "credentials",
        entityId: clientId
      });
      await persistState(nextState);
      setDataState(nextState);
      saveState(nextState);
      setApiStatus("connected");
      clearPendingState();
      setPendingSync(false);
      notify("Client login credentials updated.");
      return true;
    } catch (error) {
      notify(friendlyErrorMessage(error), "error");
      return false;
    }
  }

  async function changeAdminPassword(currentPassword, newPassword) {
    if (newPassword.length < 8) {
      notify("Password must be at least 8 characters.", "error");
      return false;
    }
    if (!localStorage.getItem(TOKEN_KEY)) {
      notify("Sign in again before changing your password.", "error");
      return false;
    }

    try {
      const result = await apiRequest("/users/me/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const nextState = withNotification(result.state, {
        type: "admin_password_changed",
        title: "Admin password changed",
        message: `${result.user.name || "Admin"} changed their password.`,
        actorRole: "admin",
        actorName: result.user.name || user.name,
        entityType: "security",
        entityId: result.user.id
      });
      await persistState(nextState);
      setDataState(nextState);
      saveState(nextState);
      saveStoredUser(result.user);
      setUser(result.user);
      setApiStatus("connected");
      clearPendingState();
      setPendingSync(false);
      notify("Admin password updated.");
      return true;
    } catch (error) {
      notify(error?.status === 401 ? "Current password is incorrect." : friendlyErrorMessage(error), "error");
      return false;
    }
  }

  function submitCredentialRequest(form) {
    if (form.requestedEmail && !isValidEmail(form.requestedEmail)) {
      notify("Enter a valid requested email address.", "error");
      return;
    }
    if (form.requestedPassword && form.requestedPassword.length < 8) {
      notify("Requested password must be at least 8 characters.", "error");
      return;
    }
    setData((current) => {
      const request = {
        id: uid("cred"),
        clientId: user.clientId,
        requestedBy: user.id,
        requestedEmail: form.requestedEmail.trim(),
        requestedPassword: form.requestedPassword,
        note: form.note.trim(),
        status: "pending",
        createdAt: new Date().toISOString(),
        resolvedAt: null
      };
      return withNotification({
        ...current,
        credentialRequests: [
          request,
          ...(current.credentialRequests || [])
        ]
      }, {
        type: "credential_request",
        title: "Credential change requested",
        message: `${user.name} requested a login credential change.`,
        clientId: user.clientId,
        actorRole: "client",
        actorName: user.name,
        entityType: "credentials",
        entityId: request.id,
        tone: "warning"
      });
    });
    notify("Credential change request sent.");
  }

  async function resolveCredentialRequest(requestId, status) {
    const request = (data.credentialRequests || []).find((item) => item.id === requestId);
    if (!request) return;

    if (status === "approved" && (request.requestedEmail || request.requestedPassword)) {
      const currentUser = data.users.find((item) => item.role === "client" && item.clientId === request.clientId);
      if (!currentUser) {
        notify("Client login user not found.", "error");
        return;
      }

      const approved = await apiRequest(`/clients/${request.clientId}/credentials`, {
        method: "PUT",
        body: JSON.stringify({
          email: request.requestedEmail || currentUser.email,
          password: request.requestedPassword || ""
        })
      }).catch((error) => {
        notify(friendlyErrorMessage(error), "error");
        return null;
      });

      if (!approved) return;

      const nextState = withNotification({
        ...approved.state,
        credentialRequests: (approved.state.credentialRequests || []).map((item) =>
          item.id === requestId ? { ...item, status, resolvedAt: new Date().toISOString() } : item
        )
      }, {
        type: "credential_request_resolved",
        title: "Credential request approved",
        message: "Admin approved the credential change request.",
        clientId: request.clientId,
        actorRole: "admin",
        actorName: user.name,
        entityType: "credentials",
        entityId: requestId
      });
      setData(nextState);
      notify(`Credential request ${status}.`);
      return;
    }

    setData((current) => withNotification({
      ...current,
      credentialRequests: current.credentialRequests.map((item) =>
        item.id === requestId ? { ...item, status, resolvedAt: new Date().toISOString() } : item
      )
    }, {
      type: "credential_request_resolved",
      title: `Credential request ${status}`,
      message: `Admin ${status} the credential change request.`,
      clientId: request.clientId,
      actorRole: "admin",
      actorName: user.name,
      entityType: "credentials",
      entityId: requestId,
      tone: status === "rejected" ? "warning" : "info"
    }));
    notify(`Credential request ${status}.`);
  }

  async function login(email, password) {
    try {
      const result = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      if (result.user.role === "client") {
        const client = result.state.clients.find((item) => item.id === result.user.clientId);
        if (client?.status === "inactive") {
          return false;
        }
      }
      localStorage.setItem(TOKEN_KEY, result.token);
      saveStoredUser(result.user);
      setDataState(result.state);
      saveState(result.state);
      setUser(result.user);
      setView(loadStoredView(result.user), result.user);
      setApiStatus("connected");
      return true;
    } catch (error) {
      if (error?.isApiError) {
        setApiStatus("connected");
        return error.status === 401 ? "Invalid email or password." : friendlyErrorMessage(error);
      }
      const nextUser = data.users.find(
        (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password
      );
      if (nextUser?.role === "client") {
        const client = data.clients.find((item) => item.id === nextUser.clientId);
        if (client?.status === "inactive") return "This company is inactive. Access has been disabled.";
      }
      if (!nextUser) return "Invalid email or password.";
      saveStoredUser(nextUser);
      setUser(nextUser);
      setView(loadStoredView(nextUser), nextUser);
      setApiStatus("offline");
      return true;
    }
  }

  const scopedAssets = useMemo(() => {
    if (!user) return [];
    return user.role === "admin" ? data.assets : data.assets.filter((asset) => asset.clientId === user.clientId);
  }, [data.assets, user]);

  const scopedAppeals = useMemo(() => {
    if (!user) return [];
    return user.role === "admin" ? data.appeals : data.appeals.filter((appeal) => appeal.clientId === user.clientId);
  }, [data.appeals, user]);
  const clientBrand = useMemo(() => {
    if (!user || user.role !== "client") return null;
    return data.clients.find((client) => client.id === user.clientId) || null;
  }, [data.clients, user]);
  const visibleNotifications = useMemo(() => {
    if (!user) return [];
    return scopedNotifications(data.notifications || [], user)
      .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
  }, [data.notifications, user]);
  const notificationUnreadCount = useMemo(() => unreadNotificationCount(data.notifications || [], user), [data.notifications, user]);

  if (!user) return <LoginScreen onLogin={login} />;
  if (user.role === "client" && clientBrand?.status === "inactive") {
    return (
      <Shell
        user={user}
        clientBrand={clientBrand}
        view={view}
        setView={setView}
        notice={notice}
        theme={theme}
        onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")}
        headerAction={null}
        notifications={visibleNotifications}
        unreadCount={notificationUnreadCount}
        onMarkNotificationsRead={markNotificationsRead}
        onClearNotifications={clearNotifications}
        onLogout={() => {
        clearStoredSession();
        setViewState("dashboard");
        setUser(null);
      }}>
        <InactiveCompanyPage clientBrand={clientBrand} />
      </Shell>
    );
  }

  return (
    <Shell
      user={user}
      clientBrand={clientBrand}
      view={view}
      setView={setView}
      notice={notice}
      apiStatus={apiStatus}
      theme={theme}
      onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")}
      notifications={visibleNotifications}
      unreadCount={notificationUnreadCount}
      onMarkNotificationsRead={markNotificationsRead}
      onClearNotifications={clearNotifications}
      headerAction={null}
      onLogout={() => {
      clearStoredSession();
      setViewState("dashboard");
      setUser(null);
    }}
    >
      {(apiStatus === "offline" || apiStatus === "conflict") && (
        <div className="api-banner">
          {pendingSync ? "Connection issue: changes are queued and will sync when service is available." : "Something went wrong. You can keep viewing cached data."}
          {pendingSync && <button type="button" onClick={syncPendingState}>Retry sync</button>}
        </div>
      )}
      {view === "dashboard" && <Dashboard user={user} data={data} scopedAssets={scopedAssets} scopedAppeals={scopedAppeals} clientBrand={clientBrand} setData={setData} />}
      {view === "companies" && user.role === "admin" && <CompaniesPage user={user} data={data} setData={setData} notify={notify} />}
      {view === "assets" && <AssetsPage user={user} data={data} scopedAssets={scopedAssets} setData={setData} notify={notify} onAddEngineer={() => setShowEngineerModal(true)} />}
      {view === "appeals" && <AppealsPage user={user} data={data} scopedAppeals={scopedAppeals} scopedAssets={scopedAssets} setData={setData} notify={notify} />}
      {view === "service" && user.role === "admin" && <ServicePage user={user} data={data} setData={setData} notify={notify} />}
      {view === "service" && user.role === "client" && <ClientServiceHistoryPage scopedAssets={scopedAssets} data={data} />}
      {view === "settings" && user.role === "admin" && <AdminSettingsPage data={data} notify={notify} onUpdateClientCredentials={updateClientCredentials} onResolveCredentialRequest={resolveCredentialRequest} onChangeAdminPassword={changeAdminPassword} onUpdateAdminAlertEmail={updateAdminAlertEmail} onSendAdminAlertTest={sendAdminAlertTest} />}
      {view === "settings" && user.role === "client" && <ClientSettingsPage user={user} data={data} notify={notify} onSubmitCredentialRequest={submitCredentialRequest} />}
      {showEngineerModal && user.role === "admin" && <EngineerModal engineers={data.engineers || []} onClose={() => setShowEngineerModal(false)} onCreate={createEngineer} onUpdateStatus={updateEngineerStatus} />}
    </Shell>
  );
}
