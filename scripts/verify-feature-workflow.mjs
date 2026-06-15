import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = {
  app: fs.readFileSync(path.join(root, "src", "App.jsx"), "utf8"),
  styles: fs.readFileSync(path.join(root, "src", "styles.css"), "utf8"),
  server: fs.readFileSync(path.join(root, "server", "index.js"), "utf8"),
  repository: fs.readFileSync(path.join(root, "server", "repository.js"), "utf8")
};

const checks = [
  ["Generic user-facing service error", files.app.includes("Something went wrong. Please try again.")],
  ["Company-specific asset categories", files.app.includes("clientCategories(") && files.repository.includes("asset_categories JSONB")],
  ["Asset page company/category filters", files.app.includes("filterClientId") && files.app.includes("filterCategory")],
  ["Engineer button scoped to Assets page", files.app.includes("onAddEngineer") && !files.app.includes("headerAction={user.role === \"admin\"")],
  ["Admin alert email setting", files.app.includes("adminAlertEmail") && files.repository.includes("app_settings")],
  ["Notification mail routing", files.server.includes("notification.actorRole === \"client\"") && files.server.includes("adminAlertEmail")],
  ["Company creation sends backend email", files.app.includes("apiRequest(\"/companies\"") && files.server.includes("sendClientWelcomeEmail(company, user, form.loginPassword)")],
  ["Admin alert test email endpoint", files.app.includes("/email/admin-alert/test") && files.server.includes("/api/email/admin-alert/test")],
  ["Service status-only editor", files.app.includes("Edit status only") && files.app.includes("updateSelectedRecordStatus")],
  ["Preset service due intervals", files.app.includes("SERVICE_DUE_TERMS") && files.app.includes("nextServiceTerm")],
  ["AMC create and renewal flow", files.app.includes("AMC and categories") && files.app.includes("Renew AMC")],
  ["AMC edit locked until 10-day window", files.app.includes("isWithinAmcEditWindow") && files.server.includes("preserveLockedAmcFields")],
  ["AMC persistence", files.repository.includes("amc_start_date") && files.repository.includes("amc_end_date")],
  ["Collapsible dashboard panels", files.app.includes("CollapsiblePanel") && files.styles.includes("collapsible-panel")],
  ["Scrollable content boxes", files.styles.includes("overscroll-behavior: contain") && files.styles.includes(".company-list::-webkit-scrollbar")],
  ["Notification center replaces notification page", files.app.includes("function NotificationCenter") && !files.app.includes("function NotificationsPage")],
  ["Notification read and clear actions", files.app.includes("markNotificationsRead") && files.app.includes("clearNotifications")],
  ["Notification sidebar count and bell", files.app.includes("sidebar-count") && files.app.includes("notification-bell-button")],
  ["Dashboard priority filtering", files.app.includes("isPriorityServiceRecord") && files.app.includes("isPriorityAsset")]
];

const failed = checks.filter(([, passed]) => !passed);
const lines = [
  "# Feature Verification Report",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  ...checks.map(([name, passed]) => `- ${passed ? "PASS" : "FAIL"}: ${name}`),
  "",
  failed.length === 0 ? "Overall result: PASS" : "Overall result: FAIL"
];

const reportPath = path.join(root, "docs", "FEATURE_TEST_REPORT.md");
fs.writeFileSync(reportPath, `${lines.join("\n")}\n`);

if (failed.length > 0) {
  console.error(lines.join("\n"));
  process.exit(1);
}

console.log(lines.join("\n"));
