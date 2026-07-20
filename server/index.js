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
import nodemailer from "nodemailer";
import { v2 as cloudinary } from "cloudinary";
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

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

const app = express();
const port = Number(process.env.PORT || process.env.API_PORT || 4000);
const origin = process.env.CORS_ORIGIN || "http://127.0.0.1:5174,http://127.0.1:5174,http://localhost:5174";
const jwtSecret = process.env.JWT_SECRET || "dev-only-change-this-secret";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadRoot = path.resolve(__dirname, "..", process.env.UPLOAD_DIR || "uploads");
const distRoot = path.resolve(__dirname, "..", "dist");
const emailLogoPath = fs.existsSync(path.resolve(__dirname, "..", "dist", "email-logo.png"))
  ? path.resolve(__dirname, "..", "dist", "email-logo.png")
  : path.resolve(__dirname, "..", "public", "email-logo.png");
const mailFrom = process.env.MAIL_FROM || process.env.SMTP_USER || "HAAK Asset Management <no-reply@haak.local>";
const emailLogoCid = "haak-email-logo@haak-assets";
const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024);
const maxUploadMb = Math.max(1, Math.round(maxUploadBytes / (1024 * 1024)));
const smtpTimeoutMs = Number(process.env.SMTP_TIMEOUT_MS || 15000);

fs.mkdirSync(uploadRoot, { recursive: true });

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      "img-src": ["'self'", "data:", "https:"],
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
    fileSize: maxUploadBytes
  },
  fileFilter: (_request, file, callback) => {
    const allowedTypes = new Set([
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]);
    if (!allowedTypes.has(file.mimetype)) {
      return callback(new Error("Unsupported file type. Images must be JPG, PNG, WEBP or GIF, and documents must be PDF, DOC or DOCX."));
    }
    callback(null, true);
  }
});

function publicUser(user) {
  if (!user) return null;
  const { password, passwordHash, ...safeUser } = user;
  return safeUser;
}

function publicState(state, auth = null) {
  return {
    ...state,
    softwareAssets: auth?.role === "client"
      ? (state.softwareAssets || []).filter((software) => software.clientId === auth.clientId)
      : (state.softwareAssets || []),
    settings: {
      adminAlertEmail: state.settings?.adminAlertEmail || "huzefarampurawala9@gmail.com"
    },
    users: state.users.map(publicUser)
  };
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values.filter(Boolean)) {
    const normalized = String(value).trim().toLowerCase();
    if (seen.has(normalized)) duplicates.add(value);
    seen.add(normalized);
  }
  return [...duplicates];
}

function hasDuplicateAssetCode(assets, assetCode, excludeId = null) {
  const normalizedCode = String(assetCode || "").trim().toLowerCase();
  if (!normalizedCode) return false;
  return assets.some((asset) => asset.id !== excludeId && String(asset.assetCode || "").trim().toLowerCase() === normalizedCode);
}

function sendApiError(response, error) {
  if (error?.code === "23505") {
    return response.status(409).json({ error: "Duplicate record detected. Check unique fields such as asset code, email, or stored file name." });
  }
  console.error(error);
  return response.status(500).json({ error: "Server error. Please try again." });
}

function isEmailEnabled() {
  return Boolean(process.env.BREVO_API_KEY || process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS));
}

function smtpConfigStatus() {
  if (process.env.BREVO_API_KEY) {
    return { configured: true, mode: "brevo", missing: [] };
  }
  if (process.env.RESEND_API_KEY) {
    return { configured: true, mode: "resend", missing: [] };
  }
  const missing = [];
  if (!process.env.SMTP_HOST) missing.push("SMTP_HOST");
  if (!process.env.SMTP_USER) missing.push("SMTP_USER");
  if (!process.env.SMTP_PASS) missing.push("SMTP_PASS");
  return {
    configured: missing.length === 0,
    mode: "smtp",
    missing
  };
}

function smtpErrorDetail(error) {
  return error?.response || error?.message || error?.code || error?.responseCode || "EMAIL_ERROR";
}

let mailTransporter = null;

function emailLogoAttachments() {
  return fs.existsSync(emailLogoPath)
    ? [{ filename: "haak-infotech.png", path: emailLogoPath, cid: emailLogoCid }]
    : [];
}

function getMailTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!mailTransporter) {
    mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      connectionTimeout: smtpTimeoutMs,
      greetingTimeout: smtpTimeoutMs,
      socketTimeout: smtpTimeoutMs,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return mailTransporter;
}

async function sendMailUnified(options) {
  if (process.env.BREVO_API_KEY) {
    const fromEmail = process.env.MAIL_FROM || 'no-reply@haak.local';
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    // Replace CID references with absolute URLs for Brevo as it doesn't support CIDs
    const logoUrl = `${getAppUrl()}/email-logo.png`;
    let htmlContent = options.html;
    if (htmlContent && typeof htmlContent === "string") {
      htmlContent = htmlContent.replaceAll(`cid:${emailLogoCid}`, logoUrl);
    }

    const brevoAttachments = [];
    if (options.attachments && Array.isArray(options.attachments)) {
      for (const att of options.attachments) {
        // Skip attaching the inline logo to save bandwidth since it is served from the app URL
        if (att.cid === emailLogoCid) continue;

        if (att.path && fs.existsSync(att.path)) {
          const content = fs.readFileSync(att.path).toString("base64");
          brevoAttachments.push({
            content,
            name: att.filename
          });
        }
      }
    }

    const payload = {
      sender: { email: fromEmail, name: "HAAK Asset Management" },
      to: recipients.map(email => ({ email })),
      subject: options.subject,
      textContent: options.text,
      htmlContent: htmlContent
    };
    if (brevoAttachments.length > 0) {
      payload.attachment = brevoAttachments;
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.message || `Brevo API failed with status ${response.status}`);
    }
    return { sent: recipients.length, failed: 0, skipped: false, messageId: body.messageId };
  }

  if (process.env.RESEND_API_KEY) {
    const fromEmail = process.env.MAIL_FROM || 'onboarding@resend.dev';
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    const resendAttachments = [];
    if (options.attachments && Array.isArray(options.attachments)) {
      for (const att of options.attachments) {
        if (att.path && fs.existsSync(att.path)) {
          const content = fs.readFileSync(att.path).toString("base64");
          resendAttachments.push({
            content,
            filename: att.filename,
            contentId: att.cid
          });
        }
      }
    }

    const payload = {
      from: fromEmail,
      to: recipients,
      subject: options.subject,
      text: options.text,
      html: options.html
    };
    if (resendAttachments.length > 0) {
      payload.attachments = resendAttachments;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.message || `Resend API failed with status ${response.status}`);
    }
    return { sent: recipients.length, failed: 0, skipped: false, id: body.id };
  }

  const transporter = getMailTransporter();
  if (!transporter) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const mailFrom = process.env.MAIL_FROM || process.env.SMTP_USER || "HAAK Asset Management <no-reply@haak.local>";
  
  const tasks = recipients.map((to) => 
    transporter.sendMail({
      from: mailFrom,
      to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments || []
    })
  );

  const results = await Promise.allSettled(tasks);
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.warn(`SMTP email failed for ${failed.length} recipient(s).`);
    failed.forEach((result) => console.warn(result.reason?.message || result.reason));
  }
  return { sent: recipients.length - failed.length, failed: failed.length, skipped: false };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function notificationToneColor(tone = "info") {
  if (tone === "warning") return "#f59e0b";
  if (tone === "error" || tone === "danger") return "#ef1f24";
  if (tone === "success") return "#16a34a";
  return "#ef1f24";
}

function buildEmailTemplate(subject, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:#f4f5f7;padding:30px 15px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:600px;background:#111315;border-radius:12px;overflow:hidden;">
        <tr><td align="center" style="background:#071321;padding:32px 25px;border-bottom:3px solid #e31e24;">
          <img src="cid:${emailLogoCid}" alt="HAAK INFOTECH" width="250" style="display:block;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;">
        </td></tr>
        <tr><td style="padding:40px 45px;color:#ffffff;min-height:250px;">${content}</td></tr>
        <tr><td style="background:#071321;padding:28px 45px;border-top:1px solid #252b33;">
          <p style="margin:0 0 6px;color:#ffffff;font-size:14px;font-weight:bold;">HAAK INFOTECH</p>
          <p style="margin:0 0 14px;color:#9ca3af;font-size:12px;">Innovate | Build | Empower</p>
          <p style="margin:0;color:#687080;font-size:11px;line-height:1.6;">This is an automated notification from HAAK Asset Management. Please do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function emailBadge(label, color = "#e31e24") {
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td style="background:${color};color:#ffffff;padding:7px 14px;border-radius:20px;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">${escapeHtml(label)}</td></tr></table>`;
}

function emailHeading(title, message) {
  return `<h1 style="margin:25px 0 10px;color:#ffffff;font-size:30px;line-height:1.3;font-weight:600;">${escapeHtml(title)}</h1>
    <p style="margin:0 0 30px;color:#9ca3af;font-size:16px;line-height:1.6;">${escapeHtml(message)}</p>`;
}

function emailDetails(rows) {
  const content = rows.filter((row) => row?.value).map((row) => `<tr>
    <td width="35%" style="padding:10px 0;color:#7f8797;font-size:14px;vertical-align:top;">${escapeHtml(row.label)}</td>
    <td style="padding:10px 0;color:#ffffff;font-size:14px;overflow-wrap:anywhere;">${row.html || escapeHtml(row.value)}</td>
  </tr>`).join("");
  return `<div style="border-top:1px solid #30343b;margin:0 0 25px;"></div><table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">${content}</table>`;
}

function emailCta(appUrl, label = "Open Asset Portal") {
  if (!appUrl) return "";
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top:35px;"><tr><td align="center" bgcolor="#e31e24" style="border-radius:7px;"><a href="${escapeHtml(appUrl)}" target="_blank" style="display:inline-block;padding:15px 28px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;">${escapeHtml(label)} &rarr;</a></td></tr></table>`;
}

function emailTaskSummary(notification) {
  if (!notification.issueTitle) return "";
  return `<p style="margin:0 0 5px;color:#6b7280;font-size:12px;font-weight:bold;letter-spacing:1px;">ISSUE</p>
    <p style="margin:0 0 8px;color:#ffffff;font-size:20px;font-weight:bold;">${escapeHtml(notification.issueTitle)}</p>
    ${notification.assetName ? `<p style="margin:0 0 25px;color:#9ca3af;font-size:15px;">${escapeHtml(notification.assetName)}</p>` : ""}
    ${notification.description ? `<p style="margin:0 0 30px;color:#c4c9d4;font-size:15px;line-height:1.7;">${escapeHtml(notification.description)}</p>` : ""}`;
}

function buildNotificationEmail(notification, appUrl) {
  const accent = notificationToneColor(notification.tone);
  const createdAt = new Date(notification.createdAt || Date.now()).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  });
  const badgeLabel = notification.priority ? `${notification.priority} priority` : (notification.tone || "notification");
  const content = emailBadge(badgeLabel, accent)
    + emailHeading(notification.title || "HAAK Notification", notification.message || "There is a new update in your asset portal.")
    + emailTaskSummary(notification)
    + emailDetails([
      { label: "Company", value: notification.companyName || "HAAK Asset Management" },
      { label: "Record type", value: notification.entityType || "Activity" },
      { label: "Asset", value: notification.assetName || "" },
      { label: "Time", value: createdAt }
    ])
    + emailCta(appUrl, notification.entityType === "appeal" ? "View Task" : "Open Asset Portal");
  return buildEmailTemplate(notification.title || "HAAK Notification", content);
}

function notificationRecipients(notification, state) {
  const adminAlertEmail = state.settings?.adminAlertEmail || "huzefarampurawala9@gmail.com";
  const admins = adminAlertEmail
    ? [{ id: "admin-alert", name: "Admin", email: adminAlertEmail }]
    : state.users.filter((user) => user.role === "admin" && validateEmail(user.email));
  const company = notification.clientId
    ? (state.clients || []).find((item) => item.id === notification.clientId)
    : null;
  const clientUsers = notification.clientId
    ? [
        ...state.users.filter((user) => user.role === "client" && user.clientId === notification.clientId && validateEmail(user.email)),
        ...(validateEmail(company?.email) ? [{ id: `company-${company.id}`, name: company.companyName, email: company.email }] : [])
      ]
    : [];
  const recipients = notification.actorRole === "client"
    ? admins
    : notification.actorRole === "admin"
      ? clientUsers
      : [...admins, ...clientUsers];
  return [...new Map(recipients.map((user) => [user.email.toLowerCase(), user])).values()];
}

const emailNotificationTypes = new Set([
  "amc_expiring",
  "appeal_created",
  "appeal_updated",
  "appeal_assigned",
  "software_created",
  "software_updated",
  "software_expiring",
  "credentials_updated",
  "credential_request",
  "credential_request_resolved",
  "admin_password_changed"
]);

function shouldEmailNotification(notification) {
  return emailNotificationTypes.has(notification?.type);
}

function getAppUrl() {
  if (process.env.PUBLIC_APP_URL) return process.env.PUBLIC_APP_URL;
  if (process.env.CORS_ORIGIN) {
    const origins = process.env.CORS_ORIGIN.split(",");
    if (origins.length > 0) return origins[0].trim();
  }
  return "http://localhost:5174";
}

function buildWelcomeEmailHtml(client, user, plainPassword, appUrl) {
  const safeName = escapeHtml(client?.contactPerson || user.name || "Client");
  const safeCompanyName = escapeHtml(client?.companyName || "Client Company");
  const safeEmail = escapeHtml(user.email);
  const safePassword = escapeHtml(plainPassword);
  const safeUrl = escapeHtml(appUrl);

  const content = emailBadge("Welcome", "#16a34a")
    + emailHeading("Welcome to HAAK Asset Management", `Hello ${client?.contactPerson || user.name || "Client"}, your company ${client?.companyName || "Client Company"} has been registered. You can now access assets, issues, software licenses, and service history.`)
    + emailDetails([
      { label: "Company", value: client?.companyName || "Client Company" },
      { label: "Username", value: user.email, html: `<code style="color:#ffffff;">${safeEmail}</code>` },
      { label: "Password", value: plainPassword, html: `<code style="color:#ffffff;">${safePassword}</code>` },
      { label: "Portal", value: appUrl, html: `<a href="${safeUrl}" style="color:#f87171;text-decoration:none;">${safeUrl}</a>` }
    ])
    + `<p style="margin:25px 0 0;color:#c4c9d4;font-size:13px;line-height:1.7;">Please change your password immediately after your first login.</p>`
    + emailCta(appUrl, "Log In to Portal");
  return buildEmailTemplate("Welcome to HAAK Asset Management - Account Created", content);

  /* Legacy markup retained below for reference; the shared HAAK template above is used. */
  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f8;margin:0;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 16px 42px rgba(2,11,24,0.12);">
            <tr>
              <td style="background:#020b18;padding:28px 32px 24px;border-bottom:4px solid #ef1f24;">
                <img src="cid:${emailLogoCid}" alt="HAAK INFOTECH" width="360" style="display:block;width:100%;max-width:360px;height:auto;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px 10px;">
                <div style="display:inline-block;background:#16a34a;color:#ffffff;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:6px 10px;border-radius:999px;">Welcome</div>
                <h1 style="margin:16px 0 10px;font-size:26px;line-height:1.22;color:#07111f;">Welcome to HAAK Asset Management</h1>
                <p style="margin:0;font-size:16px;line-height:1.65;color:#475569;">Hello <strong>${safeName}</strong>,<br><br>Your company <strong>"${safeCompanyName}"</strong> has been registered in the HAAK Asset Management portal. You can now access your assets, track issues, and view service history.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;">
                  <tr>
                    <td style="padding:16px;border-bottom:1px solid #e5e7eb;">
                      <div style="font-size:11px;text-transform:uppercase;font-weight:800;color:#64748b;">Portal Link</div>
                      <div style="font-size:15px;font-weight:800;color:#2563eb;margin-top:4px;"><a href="${safeUrl}" style="color:#2563eb;text-decoration:none;">${safeUrl}</a></div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px;border-bottom:1px solid #e5e7eb;">
                      <div style="font-size:11px;text-transform:uppercase;font-weight:800;color:#64748b;">Username (Email)</div>
                      <div style="font-size:15px;font-weight:800;color:#111827;margin-top:4px;"><code>${safeEmail}</code></div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px;">
                      <div style="font-size:11px;text-transform:uppercase;font-weight:800;color:#64748b;">Password</div>
                      <div style="font-size:15px;font-weight:800;color:#111827;margin-top:4px;"><code>${safePassword}</code></div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 32px 34px;">
                <a href="${safeUrl}" style="display:inline-block;background:#ef1f24;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:13px 20px;border-radius:6px;">Log In to Portal</a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background:#07111f;color:#94a3b8;font-size:12px;line-height:1.6;">
                <strong style="color:#ffffff;">HAAK INFOTECH</strong><br>
                Innovate | Build | Empower<br>
                Please change your password immediately after logging in for the first time.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildCredentialsUpdatedEmailHtml(client, user, newEmail, newPassword, appUrl) {
  const safeName = escapeHtml(client?.contactPerson || user.name || "Client");
  const safeEmail = escapeHtml(newEmail);
  const safePassword = newPassword ? escapeHtml(newPassword) : "";
  const safeUrl = escapeHtml(appUrl);

  const content = emailBadge("Account Update", "#f59e0b")
    + emailHeading("Login Credentials Updated", `Hello ${client?.contactPerson || user.name || "Client"}, your HAAK Asset Management login credentials were updated by the administrator.`)
    + emailDetails([
      { label: "Username", value: newEmail, html: `<code style="color:#ffffff;">${safeEmail}</code>` },
      { label: newPassword ? "New Password" : "Password", value: newPassword || "Unchanged", html: newPassword ? `<code style="color:#ffffff;">${safePassword}</code>` : "<span style=\"color:#9ca3af;font-style:italic;\">Unchanged</span>" },
      { label: "Portal", value: appUrl, html: `<a href="${safeUrl}" style="color:#f87171;text-decoration:none;">${safeUrl}</a>` }
    ])
    + `<p style="margin:25px 0 0;color:#c4c9d4;font-size:13px;line-height:1.7;">If you did not request this update, contact the administrator immediately.</p>`
    + emailCta(appUrl, "Log In to Portal");
  return buildEmailTemplate("HAAK Asset Management - Account Login Updated", content);

  /* Legacy markup retained below for reference; the shared HAAK template above is used. */
  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f8;margin:0;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 16px 42px rgba(2,11,24,0.12);">
            <tr>
              <td style="background:#020b18;padding:28px 32px 24px;border-bottom:4px solid #ef1f24;">
                <img src="cid:${emailLogoCid}" alt="HAAK INFOTECH" width="360" style="display:block;width:100%;max-width:360px;height:auto;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px 10px;">
                <div style="display:inline-block;background:#f59e0b;color:#ffffff;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:6px 10px;border-radius:999px;">Account Update</div>
                <h1 style="margin:16px 0 10px;font-size:26px;line-height:1.22;color:#07111f;">Login Credentials Updated</h1>
                <p style="margin:0;font-size:16px;line-height:1.65;color:#475569;">Hello <strong>${safeName}</strong>,<br><br>Your login credentials for the HAAK Asset Management portal have been updated by the administrator. Please find your updated login details below.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;">
                  <tr>
                    <td style="padding:16px;border-bottom:1px solid #e5e7eb;">
                      <div style="font-size:11px;text-transform:uppercase;font-weight:800;color:#64748b;">Portal Link</div>
                      <div style="font-size:15px;font-weight:800;color:#2563eb;margin-top:4px;"><a href="${safeUrl}" style="color:#2563eb;text-decoration:none;">${safeUrl}</a></div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px;${safePassword ? "border-bottom:1px solid #e5e7eb;" : ""}">
                      <div style="font-size:11px;text-transform:uppercase;font-weight:800;color:#64748b;">Username (Email)</div>
                      <div style="font-size:15px;font-weight:800;color:#111827;margin-top:4px;"><code>${safeEmail}</code></div>
                    </td>
                  </tr>
                  ${safePassword ? `
                  <tr>
                    <td style="padding:16px;">
                      <div style="font-size:11px;text-transform:uppercase;font-weight:800;color:#64748b;">New Password</div>
                      <div style="font-size:15px;font-weight:800;color:#111827;margin-top:4px;"><code>${safePassword}</code></div>
                    </td>
                  </tr>
                  ` : `
                  <tr>
                    <td style="padding:16px;">
                      <div style="font-size:11px;text-transform:uppercase;font-weight:800;color:#64748b;">Password</div>
                      <div style="font-size:15px;font-style:italic;color:#64748b;margin-top:4px;">Unchanged</div>
                    </td>
                  </tr>
                  `}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 32px 34px;">
                <a href="${safeUrl}" style="display:inline-block;background:#ef1f24;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:13px 20px;border-radius:6px;">Log In to Portal</a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background:#07111f;color:#94a3b8;font-size:12px;line-height:1.6;">
                <strong style="color:#ffffff;">HAAK INFOTECH</strong><br>
                Innovate | Build | Empower<br>
                If you did not request this update, please contact the administrator immediately.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendClientWelcomeEmail(client, user, plainPassword) {
  if (!isEmailEnabled()) {
    console.warn("Welcome email skipped because SMTP/Resend is not configured.");
    return { sent: 0, failed: 0, skipped: true };
  }

  const appUrl = getAppUrl();
  const subject = `Welcome to HAAK Asset Management - Account Created`;
  const text = [
    `Hello ${client?.contactPerson || user.name || "Client"},`,
    "",
    `Your company "${client?.companyName || "Client Company"}" has been registered in the HAAK Asset Management portal.`,
    "",
    `You can log in to your dashboard using the following credentials:`,
    `Login URL: ${appUrl}`,
    `Username / Email: ${user.email}`,
    `Password: ${plainPassword}`,
    "",
    "Please log in and change your password immediately to secure your account.",
    "",
    "Best regards,",
    "HAAK Asset Management Team"
  ].join("\n");

  const html = buildWelcomeEmailHtml(client, user, plainPassword, appUrl);

  const recipients = new Set([user.email.toLowerCase()]);
  if (client?.email) {
    recipients.add(client.email.toLowerCase());
  }

  const tasks = [];
  for (const recipient of recipients) {
    tasks.push(
      sendMailUnified({
        to: recipient,
        subject,
        text,
        html,
        attachments: emailLogoAttachments()
      })
    );
  }

  const results = await Promise.allSettled(tasks);
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.warn(`Welcome email failed for ${failed.length} recipient(s).`);
    failed.forEach((result) => console.warn(result.reason?.message || result.reason));
  }
  return { sent: results.length - failed.length, failed: failed.length, skipped: false };
}

async function sendClientCredentialsUpdatedEmail(client, user, newEmail, newPassword) {
  if (!isEmailEnabled()) return { sent: 0, failed: 0, skipped: true };

  const appUrl = getAppUrl();
  const subject = `HAAK Asset Management - Account Login Updated`;
  const text = [
    `Hello ${client?.contactPerson || user?.name || "Client"},`,
    "",
    `Your login credentials for the HAAK Asset Management portal have been updated by the administrator.`,
    "",
    `Here are your updated login details:`,
    `Login URL: ${appUrl}`,
    `Username / Email: ${newEmail}`,
    newPassword ? `New Password: ${newPassword}` : "Password: (unchanged)",
    "",
    "If you did not request this update, please contact the administrator immediately.",
    "",
    "Best regards,",
    "HAAK Asset Management Team"
  ].join("\n");

  const html = buildCredentialsUpdatedEmailHtml(client, user, newEmail, newPassword, appUrl);

  const recipients = new Set([newEmail.toLowerCase()]);
  if (user?.email) {
    recipients.add(user.email.toLowerCase());
  }
  if (client?.email) {
    recipients.add(client.email.toLowerCase());
  }

  const tasks = [];
  for (const recipient of recipients) {
    tasks.push(
      sendMailUnified({
        to: recipient,
        subject,
        text,
        html,
        attachments: emailLogoAttachments()
      })
    );
  }

  const results = await Promise.allSettled(tasks);
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.warn(`Credential update email failed for ${failed.length} recipient(s).`);
  }
  return { sent: results.length - failed.length, failed: failed.length, skipped: false };
}

async function emailNewNotifications(newNotifications, state) {
  const emailableNotifications = (newNotifications || []).filter(shouldEmailNotification);
  if (!isEmailEnabled() || emailableNotifications.length === 0) {
    if (!isEmailEnabled() && emailableNotifications.length > 0) console.warn("Notification email skipped because SMTP/Resend is not configured.");
    return { sent: 0, failed: 0, skipped: true };
  }

  const appUrl = getAppUrl();
  const tasks = [];
  for (const notification of emailableNotifications) {
    const recipients = notificationRecipients(notification, state);
    for (const recipient of recipients) {
      tasks.push(
        sendMailUnified({
          to: recipient.email,
          subject: `[HAAK Assets] ${notification.title}`,
          text: [
            notification.title,
            "",
            notification.message,
            notification.companyName ? `Company: ${notification.companyName}` : "",
            notification.actorRole ? `By: ${notification.actorName || notification.actorRole}` : "",
            appUrl ? `Open: ${appUrl}` : ""
          ].filter(Boolean).join("\n"),
          html: buildNotificationEmail(notification, appUrl),
          attachments: emailLogoAttachments()
        })
      );
    }
  }

  const results = await Promise.allSettled(tasks);
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length > 0) {
    console.warn(`Notification email failed for ${failed.length} recipient(s).`);
    failed.forEach((result) => console.warn(result.reason?.message || result.reason));
  }
  return { sent: results.length - failed.length, failed: failed.length, skipped: false };
}

async function sendAdminAlertTestEmail(email) {
  if (!isEmailEnabled()) return { sent: 0, failed: 0, skipped: true };
  const appUrl = getAppUrl();
  const sampleExpiryDate = new Date();
  sampleExpiryDate.setDate(sampleExpiryDate.getDate() + 30);
  const formattedExpiryDate = sampleExpiryDate.toISOString().slice(0, 10);
  const notification = {
    type: "amc_expiring",
    title: "AMC expiration alert",
    message: `Sample Company AMC expires in 30 days on ${formattedExpiryDate}. Please renew the contract.`,
    companyName: "Sample Company",
    actorRole: "system",
    actorName: "System",
    entityType: "AMC",
    tone: "warning",
    createdAt: new Date().toISOString()
  };
  const result = await sendMailUnified({
    to: email,
    subject: "[TEST] [HAAK Assets] AMC expiration alert",
    text: [
      notification.title,
      "",
      notification.message,
      appUrl ? `Open: ${appUrl}` : ""
    ].filter(Boolean).join("\n"),
    html: buildNotificationEmail(notification, appUrl),
    attachments: emailLogoAttachments()
  });
  return result;
}

function newNotificationsFromState(nextState, currentState) {
  const currentIds = new Set((currentState.notifications || []).map((notification) => notification.id));
  return (nextState.notifications || []).filter((notification) => !currentIds.has(notification.id));
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
        return { ...withoutPassword, passwordHash: await bcrypt.hash(password, 12), passwordChangedAt: user.passwordChangedAt || new Date().toISOString() };
      }
      return { ...user, passwordChangedAt: user.passwordChangedAt || new Date().toISOString() };
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

async function sendEngineerAssignmentEmail({ engineer, appeal, client, asset, assignedBy }) {
  if (!isEmailEnabled() || !validateEmail(engineer?.email)) {
    return { sent: 0, failed: 0, skipped: true };
  }
  const appUrl = getAppUrl();
  const notification = {
    title: "You have been assigned a task",
    message: "A new task has been assigned to you and requires your attention.",
    priority: appeal.priority,
    issueTitle: appeal.title,
    assetName: asset?.name || "Not specified",
    description: appeal.description,
    companyName: client?.companyName || "HAAK Asset Management",
    actorName: assignedBy,
    actorRole: "admin",
    entityType: "issue assignment",
    tone: "warning",
    createdAt: appeal.assignedAt
  };
  return sendMailUnified({
    to: engineer.email,
    subject: `[HAAK Assets] Task assigned: ${appeal.title}`,
    text: [
      `Hello ${engineer.name},`,
      "",
      "You have been assigned this task:",
      `Issue: ${appeal.title}`,
      `Description: ${appeal.description}`,
      `Priority: ${appeal.priority}`,
      `Company: ${client?.companyName || "Not specified"}`,
      `Asset: ${asset?.name || "Not specified"}`,
      `Assigned by: ${assignedBy}`,
      appUrl ? `Open portal: ${appUrl}` : ""
    ].filter(Boolean).join("\n"),
    html: buildNotificationEmail(notification, appUrl),
    attachments: emailLogoAttachments()
  });
}

async function sendEngineerUnassignmentEmail({ engineer, appeal, replacementEngineer }) {
  if (!isEmailEnabled() || !validateEmail(engineer?.email)) {
    return { sent: 0, failed: 0, skipped: true };
  }
  const replacementText = replacementEngineer ? ` It has been reassigned to ${replacementEngineer.name}.` : "";
  const notification = {
    title: "Task assignment removed",
    message: `You are no longer assigned to the issue "${appeal.title}".${replacementText}`,
    companyName: "HAAK Asset Management",
    actorName: "Admin",
    actorRole: "admin",
    entityType: "issue assignment",
    tone: "info",
    createdAt: new Date().toISOString()
  };
  return sendMailUnified({
    to: engineer.email,
    subject: `[HAAK Assets] Assignment removed: ${appeal.title}`,
    text: notification.message,
    html: buildNotificationEmail(notification, getAppUrl()),
    attachments: emailLogoAttachments()
  });
}

async function sendAssignmentPreviewEmails(email) {
  if (!isEmailEnabled()) return { sent: 0, failed: 0, skipped: true };
  const appUrl = getAppUrl();
  const createdAt = new Date().toISOString();
  const clientPreview = {
    title: "Engineer assigned to your task",
    message: "Rahul Sharma has been assigned to your task \"Laptop is not starting\". You will be notified when there is an update.",
    priority: "high",
    issueTitle: "Laptop is not starting",
    assetName: "Dell Latitude 5420",
    description: "The laptop does not power on after pressing the power button.",
    companyName: "Sample Client Company",
    actorName: "HAAK Admin",
    actorRole: "admin",
    entityType: "issue",
    tone: "success",
    createdAt
  };
  const engineerPreview = {
    title: "You have been assigned a task",
    message: "A new task has been assigned to you and requires your attention.",
    priority: "high",
    issueTitle: "Laptop is not starting",
    assetName: "Dell Latitude 5420",
    description: "The laptop does not power on after pressing the power button.",
    companyName: "Sample Client Company",
    actorName: "HAAK Admin",
    actorRole: "admin",
    entityType: "issue assignment",
    tone: "warning",
    createdAt
  };
  const results = await Promise.allSettled([
    sendMailUnified({
      to: email,
      subject: "[PREVIEW - CLIENT] Engineer assigned to your task",
      text: `${clientPreview.title}\n\n${clientPreview.message}\n\nOpen: ${appUrl}`,
      html: buildNotificationEmail(clientPreview, appUrl),
      attachments: emailLogoAttachments()
    }),
    sendMailUnified({
      to: email,
      subject: "[PREVIEW - ENGINEER] You have been assigned a task",
      text: `${engineerPreview.title}\n\n${engineerPreview.message}\n\nOpen: ${appUrl}`,
      html: buildNotificationEmail(engineerPreview, appUrl),
      attachments: emailLogoAttachments()
    })
  ]);
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length) failed.forEach((result) => console.warn("Assignment preview email failed:", smtpErrorDetail(result.reason)));
  return { sent: results.length - failed.length, failed: failed.length, skipped: false };
}

const AMC_ALERT_MILESTONES = [0, 10, 20, 30];
let amcAlertRun = null;

async function runAmcExpiryAlerts(now = new Date()) {
  if (amcAlertRun) return amcAlertRun;
  amcAlertRun = (async () => {
    const state = await readState();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const existingKeys = new Set((state.notifications || [])
      .filter((item) => item.type === "amc_expiring" || item.type === "software_expiring")
      .map((item) => item.entityId));
    const notifications = [];

    for (const client of state.clients || []) {
      if (!client.amcEndDate || client.status === "inactive") continue;
      const endDate = new Date(`${client.amcEndDate}T00:00:00`);
      if (Number.isNaN(endDate.getTime())) continue;
      const daysLeft = Math.ceil((endDate.getTime() - dayStart.getTime()) / 86400000);
      const milestone = AMC_ALERT_MILESTONES.find((days) => daysLeft <= days);
      if (milestone === undefined || daysLeft < 0) continue;
      const entityId = `${client.id}:amc:${milestone}`;
      if (existingKeys.has(entityId)) continue;
      const timing = daysLeft === 0 ? "expires today" : `expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
      notifications.push({
        id: `notification-${randomUUID()}`,
        type: "amc_expiring",
        title: "AMC expiration alert",
        message: `${client.companyName} AMC ${timing} on ${client.amcEndDate}. Please renew the contract.`,
        clientId: client.id,
        companyName: client.companyName,
        actorRole: "system",
        actorName: "System",
        entityType: "amc",
        entityId,
        tone: "warning",
        createdAt: now.toISOString(),
        readBy: []
      });
    }

    for (const software of state.softwareAssets || []) {
      if (!software.validityDate || software.status === "inactive") continue;
      const validityDate = new Date(`${software.validityDate}T00:00:00`);
      if (Number.isNaN(validityDate.getTime())) continue;
      const daysLeft = Math.ceil((validityDate.getTime() - dayStart.getTime()) / 86400000);
      const milestone = AMC_ALERT_MILESTONES.find((days) => daysLeft <= days);
      if (milestone === undefined || daysLeft < 0) continue;
      const entityId = `${software.id}:software:${software.validityDate}:${milestone}`;
      if (existingKeys.has(entityId)) continue;
      const client = (state.clients || []).find((item) => item.id === software.clientId);
      const timing = daysLeft === 0 ? "expires today" : `expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
      notifications.push({
        id: `notification-${randomUUID()}`,
        type: "software_expiring",
        title: "Software validity expiration alert",
        message: `${software.softwareName} ${timing} on ${software.validityDate}. Please renew the license.`,
        clientId: software.clientId,
        companyName: client?.companyName || "",
        actorRole: "system",
        actorName: "System",
        entityType: "software_asset",
        entityId,
        tone: "warning",
        createdAt: now.toISOString(),
        readBy: []
      });
    }

    if (notifications.length === 0) return { created: 0, email: { sent: 0, failed: 0, skipped: true } };
    const notifiedClientIds = new Set(notifications.filter((item) => item.type === "amc_expiring").map((item) => item.clientId));
    const nextState = {
      ...state,
      clients: state.clients.map((client) => notifiedClientIds.has(client.id) ? { ...client, amcRenewalNoticeSentAt: now.toISOString() } : client),
      notifications: [...notifications, ...(state.notifications || [])]
    };
    await writeState(nextState);
    const email = await emailNewNotifications(notifications, nextState);
    return { created: notifications.length, email };
  })().finally(() => { amcAlertRun = null; });
  return amcAlertRun;
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

function mergeClientState(nextState, currentState, auth) {
  const ownClientId = auth.clientId;
  const submittedOwnAssets = new Map(
    (nextState.assets || [])
      .filter((asset) => !asset.clientId || asset.clientId === ownClientId || currentState.assets.some((current) => current.id === asset.id && current.clientId === ownClientId))
      .map((asset) => [asset.id, asset])
  );

  const existingAssetIds = new Set(currentState.assets.map((asset) => asset.id));
  const preservedAndEditedAssets = currentState.assets.map((asset) => {
    if (asset.clientId !== ownClientId) return asset;
    const submitted = submittedOwnAssets.get(asset.id);
    return submitted ? { ...asset, ...submitted, id: asset.id, clientId: ownClientId } : asset;
  });
  const addedAssets = (nextState.assets || [])
    .filter((asset) => !existingAssetIds.has(asset.id))
    .map((asset) => ({ ...asset, clientId: ownClientId }));
  const currentNotificationIds = new Set((currentState.notifications || []).map((notification) => notification.id));
  const addedNotifications = (nextState.notifications || [])
    .filter((notification) => !currentNotificationIds.has(notification.id) && notification.clientId === ownClientId)
    .map((notification) => ({ ...notification, clientId: ownClientId }));
  const submittedNotifications = new Map((nextState.notifications || []).map((notification) => [notification.id, notification]));
  const mergedNotifications = (currentState.notifications || [])
    .filter((notification) => notification.clientId !== ownClientId || submittedNotifications.has(notification.id))
    .map((notification) => {
      if (notification.clientId !== ownClientId) return notification;
      const submitted = submittedNotifications.get(notification.id);
      return submitted
        ? { ...notification, readBy: submitted.readBy || notification.readBy || [] }
        : notification;
    });

  const currentAppeals = new Map((currentState.appeals || []).map((appeal) => [appeal.id, appeal]));
  const mergedAppeals = (nextState.appeals || currentState.appeals || []).map((appeal) => {
    const currentAppeal = currentAppeals.get(appeal.id);
    if (!currentAppeal) {
      return { ...appeal, clientId: ownClientId, assignedEngineerId: null, assignedAt: null, assignedBy: null };
    }
    return {
      ...appeal,
      clientId: currentAppeal.clientId,
      assignedEngineerId: currentAppeal.assignedEngineerId || null,
      assignedAt: currentAppeal.assignedAt || null,
      assignedBy: currentAppeal.assignedBy || null
    };
  });

  return {
    ...currentState,
    assets: [...addedAssets, ...preservedAndEditedAssets],
    credentialRequests: nextState.credentialRequests || currentState.credentialRequests,
    appeals: mergedAppeals,
    appealMessages: nextState.appealMessages || currentState.appealMessages,
    notifications: [...addedNotifications, ...mergedNotifications]
  };
}

function isWithinAmcEditWindow(company) {
  if (!company?.amcEndDate) return true;
  const endDate = new Date(`${company.amcEndDate}T00:00:00`);
  if (Number.isNaN(endDate.getTime())) return true;
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysLeft >= 0 && daysLeft <= 10;
}

function preserveLockedAmcFields(nextState, currentState) {
  const currentCompanies = new Map((currentState.clients || []).map((client) => [client.id, client]));
  return {
    ...nextState,
    clients: (nextState.clients || []).map((client) => {
      const current = currentCompanies.get(client.id);
      if (!current || isWithinAmcEditWindow(current)) return client;
      return {
        ...client,
        amcStartDate: current.amcStartDate || "",
        amcEndDate: current.amcEndDate || "",
        amcTerm: current.amcTerm || "",
        amcRenewalNoticeSentAt: current.amcRenewalNoticeSentAt || ""
      };
    })
  };
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
  return String(phone || "").replace(/\D+/g, "").slice(0, 10);
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

  response.json({ token: signToken(normalizedUser), user: publicUser(normalizedUser), state: publicState(normalizedState, normalizedUser) });
});

app.get("/api/state", requireAuth, async (request, response) => {
  const state = await readState();
  response.json(publicState(state, request.auth));
});

app.put("/api/state", requireAuth, async (request, response) => {
  try {
    const nextState = request.body;
    if (!nextState || !Array.isArray(nextState.users) || !Array.isArray(nextState.clients) || !Array.isArray(nextState.assets)) {
      return response.status(400).json({ error: "Invalid app state payload." });
    }

    const duplicateAssetCodes = duplicateValues(nextState.assets.map((asset) => asset.assetCode));
    if (duplicateAssetCodes.length > 0) {
      return response.status(409).json({ error: `Duplicate asset code found: ${duplicateAssetCodes.join(", ")}.` });
    }

    const currentState = await readState();
    const scopedState = request.auth.role === "admin" ? nextState : mergeClientState(nextState, currentState, request.auth);
    const lockedState = preserveLockedAmcFields(scopedState, currentState);

    // Detect newly created clients with plain text passwords before they get merged/hashed.
    const currentUsersMap = new Map(currentState.users.map((u) => [u.id, u]));
    const newClientsToWelcome = [];
    if (lockedState && Array.isArray(lockedState.users)) {
      for (const user of lockedState.users) {
        if (user.role === "client" && user.password && !currentUsersMap.has(user.id)) {
          const client = (lockedState.clients || []).find((c) => c.id === user.clientId);
          newClientsToWelcome.push({ client, user, plainPassword: user.password });
        }
      }
    }

    const mergedState = await mergePasswords(lockedState, currentState);
    await writeState(mergedState);

    response.json(publicState(mergedState, request.auth));

    // Email delivery should not hold the state sync response open.
    Promise.resolve().then(async () => {
      for (const item of newClientsToWelcome) {
        try {
          await sendClientWelcomeEmail(item.client, item.user, item.plainPassword);
        } catch (error) {
          console.warn("Welcome email delivery failed for client:", item.user.email, error);
        }
      }

      try {
        await emailNewNotifications(newNotificationsFromState(mergedState, currentState), mergedState);
      } catch (error) {
        console.warn("Notification email delivery failed.");
        console.warn(error);
      }
    });
  } catch (error) {
    sendApiError(response, error);
  }
});

app.post("/api/engineers", requireAuth, requireAdmin, async (request, response) => {
  try {
    const state = await readState();
    const email = String(request.body?.email || "").trim().toLowerCase();
    const name = String(request.body?.name || "").trim();
    const phone = normalizePhone(request.body?.phone);
    if (!name || !phone || !validateEmail(email)) {
      return response.status(400).json({ error: "Engineer name, contact number, and a valid email are required." });
    }
    if ((state.engineers || []).some((item) => item.email.toLowerCase() === email)) {
      return response.status(409).json({ error: "An engineer with this email already exists." });
    }
    const engineer = {
      id: uid("eng"),
      name,
      email,
      phone,
      photoUrl: String(request.body?.photoUrl || ""),
      specialization: String(request.body?.specialization || "").trim(),
      status: request.body?.status === "inactive" ? "inactive" : "active"
    };
    const nextState = { ...state, engineers: [engineer, ...(state.engineers || [])] };
    await writeState(nextState);
    response.status(201).json({ engineer, state: publicState(nextState) });
  } catch (error) {
    sendApiError(response, error);
  }
});

app.put("/api/engineers/:engineerId", requireAuth, requireAdmin, async (request, response) => {
  try {
    const state = await readState();
    const existing = (state.engineers || []).find((item) => item.id === request.params.engineerId);
    if (!existing) return response.status(404).json({ error: "Engineer not found." });
    const email = String(request.body?.email ?? existing.email).trim().toLowerCase();
    const name = String(request.body?.name ?? existing.name).trim();
    const phone = normalizePhone(request.body?.phone ?? existing.phone);
    if (!name || !phone || !validateEmail(email)) {
      return response.status(400).json({ error: "Engineer name, contact number, and a valid email are required." });
    }
    if ((state.engineers || []).some((item) => item.id !== existing.id && item.email.toLowerCase() === email)) {
      return response.status(409).json({ error: "An engineer with this email already exists." });
    }
    const engineer = {
      ...existing,
      name,
      email,
      phone,
      photoUrl: String(request.body?.photoUrl ?? existing.photoUrl ?? ""),
      specialization: String(request.body?.specialization ?? existing.specialization ?? "").trim(),
      status: request.body?.status === "inactive" ? "inactive" : "active"
    };
    const nextState = { ...state, engineers: state.engineers.map((item) => item.id === existing.id ? engineer : item) };
    await writeState(nextState);
    response.json({ engineer, state: publicState(nextState) });
  } catch (error) {
    sendApiError(response, error);
  }
});

app.patch("/api/appeals/:appealId/assignment", requireAuth, requireAdmin, async (request, response) => {
  try {
    const state = await readState();
    const appeal = (state.appeals || []).find((item) => item.id === request.params.appealId);
    if (!appeal) return response.status(404).json({ error: "Issue not found." });
    if (["resolved", "approved", "closed"].includes(appeal.status)) {
      return response.status(409).json({ error: "Engineer assignment is locked for resolved or closed issues." });
    }

    const engineerId = request.body?.engineerId ? String(request.body.engineerId) : null;
    const engineer = engineerId ? (state.engineers || []).find((item) => item.id === engineerId) : null;
    if (engineerId && !engineer) return response.status(404).json({ error: "Engineer not found." });
    if (engineer && engineer.status === "inactive") {
      return response.status(409).json({ error: "Inactive engineers cannot be assigned to issues." });
    }
    if (engineer && !validateEmail(engineer.email)) {
      return response.status(422).json({ error: "The engineer needs a valid email address before assignment." });
    }
    if ((appeal.assignedEngineerId || null) === engineerId) {
      return response.json({ state: publicState(state), unchanged: true, email: { client: { skipped: true }, engineer: { skipped: true } } });
    }

    const previousEngineer = appeal.assignedEngineerId
      ? (state.engineers || []).find((item) => item.id === appeal.assignedEngineerId)
      : null;
    const admin = (state.users || []).find((item) => item.id === request.auth.sub);
    const client = (state.clients || []).find((item) => item.id === appeal.clientId);
    const asset = (state.assets || []).find((item) => item.id === appeal.assetId);
    const now = new Date().toISOString();
    const updatedAppeal = {
      ...appeal,
      assignedEngineerId: engineerId,
      assignedAt: engineer ? now : null,
      assignedBy: engineer ? request.auth.sub : null,
      status: engineer && appeal.status === "open" ? "in_review" : (!engineer && appeal.status === "in_review" ? "open" : appeal.status),
      updatedAt: now
    };
    const notification = {
      id: uid("notification"),
      type: "appeal_assigned",
      title: engineer ? "Engineer assigned to your task" : "Engineer assignment removed",
      message: engineer
        ? `${engineer.name} has been assigned to your task "${appeal.title}". You will be notified when there is an update.`
        : `The engineer assignment for your task "${appeal.title}" has been removed.`,
      priority: appeal.priority,
      issueTitle: appeal.title,
      assetName: asset?.name || "",
      description: appeal.description,
      clientId: appeal.clientId,
      companyName: client?.companyName || "",
      actorRole: "admin",
      actorName: admin?.name || "Admin",
      entityType: "appeal",
      entityId: appeal.id,
      tone: engineer ? "success" : "warning",
      readBy: [],
      createdAt: now
    };
    const nextState = {
      ...state,
      appeals: state.appeals.map((item) => item.id === appeal.id ? updatedAppeal : item),
      notifications: [notification, ...(state.notifications || [])].slice(0, 500)
    };
    await writeState(nextState);

    const emailTasks = [emailNewNotifications([notification], nextState)];
    emailTasks.push(engineer
      ? sendEngineerAssignmentEmail({ engineer, appeal: updatedAppeal, client, asset, assignedBy: admin?.name || "Admin" })
      : Promise.resolve({ sent: 0, failed: 0, skipped: true }));
    if (previousEngineer && previousEngineer.id !== engineerId) {
      emailTasks.push(sendEngineerUnassignmentEmail({ engineer: previousEngineer, appeal, replacementEngineer: engineer }));
    }
    const emailResults = await Promise.allSettled(emailTasks);
    const emailValue = (index) => emailResults[index]?.status === "fulfilled"
      ? emailResults[index].value
      : { sent: 0, failed: 1, skipped: false, error: smtpErrorDetail(emailResults[index]?.reason) };

    response.json({
      state: publicState(nextState),
      appeal: updatedAppeal,
      email: {
        client: emailValue(0),
        engineer: emailValue(1),
        previousEngineer: emailResults[2] ? emailValue(2) : { sent: 0, failed: 0, skipped: true }
      }
    });
  } catch (error) {
    sendApiError(response, error);
  }
});

app.get("/api/users/me", requireAuth, async (request, response) => {
  const state = await readState();
  const user = state.users.find((item) => item.id === request.auth.sub);
  if (!user) return response.status(404).json({ error: "User not found." });
  response.json(publicUser(user));
});

app.post("/api/email/admin-alert/test", requireAuth, requireAdmin, async (request, response) => {
  const state = await readState();
  const email = String(request.body?.email || state.settings?.adminAlertEmail || "").trim();
  if (!validateEmail(email)) {
    return response.status(400).json({ error: "Enter a valid admin alert email address." });
  }
  const smtp = smtpConfigStatus();
  if (!smtp.configured) {
    return response.status(503).json({
      error: "Email delivery is not configured on the server.",
      detail: "Set BREVO_API_KEY for Brevo, RESEND_API_KEY for Resend, or SMTP_HOST, SMTP_USER, SMTP_PASS in the environment."
    });
  }
  try {
    const result = await sendAdminAlertTestEmail(email);
    response.json({ ok: result.sent > 0, email, result });
  } catch (error) {
    console.warn("Admin alert test email failed:", error);
    response.status(502).json({ error: "Unable to send test email.", detail: smtpErrorDetail(error) });
  }
});

app.post("/api/email/assignment-preview", requireAuth, requireAdmin, async (request, response) => {
  const state = await readState();
  const email = String(request.body?.email || state.settings?.adminAlertEmail || "").trim();
  if (!validateEmail(email)) return response.status(400).json({ error: "Enter a valid preview email address." });
  if (!isEmailEnabled()) return response.status(503).json({ error: "Email delivery is not configured on the server." });
  try {
    const result = await sendAssignmentPreviewEmails(email);
    response.json({ ok: result.sent === 2, email, result });
  } catch (error) {
    response.status(502).json({ error: "Unable to send assignment previews.", detail: smtpErrorDetail(error) });
  }
});

app.post("/api/amc-alerts/run", requireAuth, requireAdmin, async (_request, response) => {
  try {
    response.json({ ok: true, ...(await runAmcExpiryAlerts()) });
  } catch (error) {
    sendApiError(response, error);
  }
});

app.put("/api/users/me/password", requireAuth, requireAdmin, async (request, response) => {
  const { currentPassword, newPassword } = request.body || {};
  if (!currentPassword || !newPassword) {
    return response.status(400).json({ error: "Current password and new password are required." });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) return response.status(400).json({ error: passwordError });

  const state = await readState();
  const user = state.users.find((item) => item.id === request.auth.sub);
  if (!user) return response.status(404).json({ error: "User not found." });
  if (!(await verifyPassword(user, currentPassword))) {
    return response.status(401).json({ error: "Current password is incorrect." });
  }

  const updatedUser = { ...user, passwordHash: await bcrypt.hash(newPassword, 12), passwordChangedAt: new Date().toISOString() };
  delete updatedUser.password;
  const nextState = {
    ...state,
    users: state.users.map((item) => (item.id === user.id ? updatedUser : item))
  };
  await writeState(nextState);
  response.json({ user: publicUser(updatedUser), state: publicState(nextState) });
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

  const companyEmail = String(form.email || "").trim().toLowerCase();
  const loginEmail = String(form.loginEmail || "").trim().toLowerCase();
  const duplicateCompany = state.clients.find((client) => String(client.email || "").trim().toLowerCase() === companyEmail);
  if (duplicateCompany) {
    return response.status(409).json({ error: "A company with this client email already exists." });
  }
  if (loginEmail) {
    const duplicateLogin = state.users.find((user) => String(user.email || "").trim().toLowerCase() === loginEmail);
    if (duplicateLogin) {
      return response.status(409).json({ error: "That login email is already in use." });
    }
  }

  const clientId = form.id || uid("c");
  const company = {
    id: clientId,
    companyName: form.companyName,
    contactPerson: form.contactPerson,
    email: form.email,
    phone: normalizePhone(form.phone),
    address: String(form.address || "").slice(0, 150),
    logoUrl: form.logoUrl || "",
    assetCategories: Array.isArray(form.assetCategories) ? form.assetCategories : [],
    branches: Array.isArray(form.branches) ? form.branches : [],
    amcStartDate: form.amcStartDate || "",
    amcEndDate: form.amcEndDate || "",
    amcTerm: form.amcTerm || "",
    amcRenewalNoticeSentAt: "",
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
      passwordHash: await bcrypt.hash(form.loginPassword, 12),
      passwordChangedAt: new Date().toISOString()
    };
    users.push(user);
  }

  const notification = {
    id: uid("note"),
    type: "company_created",
    title: "Company added",
    message: `${company.companyName} was added by admin.`,
    clientId,
    companyName: company.companyName,
    actorRole: "admin",
    actorName: request.auth?.name || "Admin",
    entityType: "company",
    entityId: clientId,
    tone: "info",
    readBy: [],
    createdAt: new Date().toISOString()
  };
  const nextState = { ...state, clients: [company, ...state.clients], users, notifications: [notification, ...(state.notifications || [])] };
  await writeState(nextState);

  let welcomeEmail = { sent: 0, failed: 0, skipped: true };
  if (user && form.loginPassword) {
    try {
      welcomeEmail = await sendClientWelcomeEmail(company, user, form.loginPassword);
    } catch (error) {
      console.warn("Failed to send welcome email in POST /api/companies:", error);
      welcomeEmail = { sent: 0, failed: 1, skipped: false };
    }
  }

  let notificationEmail = { sent: 0, failed: 0, skipped: true };
  try {
    notificationEmail = await emailNewNotifications([notification], nextState);
  } catch (error) {
    console.warn("Failed to send company notification email:", error);
    notificationEmail = { sent: 0, failed: 1, skipped: false };
  }

  response.status(201).json({ company, user: publicUser(user), state: publicState(nextState), email: { welcome: welcomeEmail, notification: notificationEmail } });
});

app.put("/api/companies/:id", requireAuth, requireAdmin, async (request, response) => {
  const state = await readState();
  const existing = state.clients.find((client) => client.id === request.params.id);
  if (!existing) return response.status(404).json({ error: "Company not found." });
  if (request.body?.email && !validateEmail(request.body.email)) {
    return response.status(400).json({ error: "Enter a valid email address." });
  }

  const requestedCompany = {
    ...existing,
    ...request.body,
    id: existing.id,
    assetCategories: Array.isArray(request.body?.assetCategories) ? request.body.assetCategories : existing.assetCategories,
    ...(request.body?.phone !== undefined ? { phone: normalizePhone(request.body.phone) } : {}),
    ...(request.body?.address !== undefined ? { address: String(request.body.address || "").slice(0, 150) } : {})
  };
  const company = isWithinAmcEditWindow(existing)
    ? requestedCompany
    : {
        ...requestedCompany,
        amcStartDate: existing.amcStartDate || "",
        amcEndDate: existing.amcEndDate || "",
        amcTerm: existing.amcTerm || "",
        amcRenewalNoticeSentAt: existing.amcRenewalNoticeSentAt || ""
      };
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
    ...(password ? { passwordHash: await bcrypt.hash(password, 12), passwordChangedAt: new Date().toISOString() } : {})
  };
  delete updatedUser.password;

  const nextState = {
    ...state,
    users: state.users.map((user) => (user.id === targetUser.id ? updatedUser : user))
  };
  await writeState(nextState);

  // Send update email notification
  const client = state.clients.find((c) => c.id === clientId);
  try {
    await sendClientCredentialsUpdatedEmail(client, targetUser, String(email).trim(), password);
  } catch (error) {
    console.warn("Failed to send credentials update email:", error);
  }

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

app.post("/api/assets", requireAuth, async (request, response) => {
  const state = await readState();
  const form = request.body || {};
  const clientId = request.auth.role === "admin" ? form.clientId : request.auth.clientId;
  if (!form.assetCode || !form.name || !clientId) {
    return response.status(400).json({ error: "Asset code, name, and company are required." });
  }
  if (!state.clients.some((client) => client.id === clientId)) {
    return response.status(400).json({ error: "Company does not exist." });
  }

  const asset = {
    id: form.id || uid("a"),
    assetCode: form.assetCode,
    clientId,
    name: form.name,
    category: form.category || "",
    brand: form.brand || "",
    model: form.model || "",
    serialNumber: form.serialNumber || "",
    purchaseDate: form.purchaseDate || "",
    warrantyEndDate: form.warrantyEndDate || "",
    location: form.location || "",
    branchId: form.branchId || "",
    department: form.department || "",
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

app.put("/api/assets/:id", requireAuth, async (request, response) => {
  const state = await readState();
  const existing = state.assets.find((asset) => asset.id === request.params.id);
  if (!existing) return response.status(404).json({ error: "Asset not found." });
  if (!canAccessClient(request.auth, existing.clientId)) {
    return response.status(403).json({ error: "Asset access denied." });
  }
  const asset = {
    ...existing,
    ...request.body,
    id: existing.id,
    clientId: request.auth.role === "admin" ? (request.body?.clientId || existing.clientId) : existing.clientId
  };
  if (hasDuplicateAssetCode(state.assets, asset.assetCode, existing.id)) {
    return response.status(409).json({ error: `Asset code ${asset.assetCode} already exists.` });
  }
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
    try {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return response.status(400).json({ error: `File must be ${maxUploadMb} MB or smaller.` });
      }
      if (error) {
        return response.status(400).json({ error: error.message || "A valid file is required." });
      }
      if (!request.file) {
        return response.status(400).json({ error: "A valid file is required." });
      }

      let url = `/uploads/${request.file.filename}`;

      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
        try {
          const result = await cloudinary.uploader.upload(request.file.path, {
            folder: "haak-assets",
            resource_type: "auto"
          });
          url = result.secure_url;
          try {
            fs.unlinkSync(request.file.path);
          } catch (unlinkError) {
            console.error("Failed to delete local temporary upload file:", unlinkError);
          }
        } catch (cloudinaryError) {
          console.error("Cloudinary upload failed:", cloudinaryError);
          return response.status(502).json({ error: "Cloudinary upload failed. Check the Cloudinary environment variables on the server." });
        }
      }

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
    } catch (uploadError) {
      console.error(uploadError);
      response.status(500).json({ error: "Upload failed while saving file details. Please try again." });
    }
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
      runAmcExpiryAlerts().then((result) => {
        if (result.created > 0) console.log(`Created ${result.created} AMC expiration alert(s).`);
      }).catch((error) => console.error("AMC expiration alert check failed", error));
    });
    const amcAlertInterval = setInterval(() => {
      runAmcExpiryAlerts().catch((error) => console.error("AMC expiration alert check failed", error));
    }, Number(process.env.AMC_ALERT_CHECK_INTERVAL_MS || 6 * 60 * 60 * 1000));
    amcAlertInterval.unref();
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
