import { test, expect } from "@playwright/test";

const APP_URL = "http://127.0.0.1:5174";

async function signIn(page, email, password) {
  await page.route("**/api/**", (route) => route.abort());
  await page.goto(APP_URL);
  await page.getByLabel("Email address").fill(email);
  await page.getByPlaceholder("Enter password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

test("admin can add an asset with only the essential fields", async ({ page }) => {
  await signIn(page, "admin@haakinfotech.com", "admin123");
  await page.getByRole("button", { name: "Assets" }).click();
  await page.getByRole("button", { name: "Add asset", exact: true }).first().click();
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByLabel("Asset name *").fill("Minimal Test Asset");
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByRole("button", { name: /Add asset/ }).last().click();
  await expect(page.getByText("Minimal Test Asset", { exact: true }).first()).toBeVisible();
});

test("admin can bulk add an asset from the spreadsheet editor", async ({ page }) => {
  await signIn(page, "admin@haakinfotech.com", "admin123");
  await page.getByRole("button", { name: "Assets" }).click();
  await page.getByRole("button", { name: /Bulk Add Assets/ }).first().click();
  await page.getByPlaceholder("e.g. Dell Latitude 5440").fill("Bulk Test Asset");
  const category = page.getByPlaceholder("e.g. Laptop");
  if (!(await category.inputValue())) await category.fill("Laptop");
  await page.getByRole("button", { name: /Save & Add Assets/ }).click();
  await expect(page.getByText("Bulk Test Asset", { exact: true }).first()).toBeVisible();
});

test("client sidebar opens branded standard terms", async ({ page }) => {
  await signIn(page, "client@example.com", "client123");
  await page.getByRole("button", { name: "Terms & Conditions" }).click();
  await expect(page.getByRole("heading", { name: "Standard Terms & Conditions" })).toBeVisible();
  await expect(page.locator(".terms-list li")).toHaveCount(20);
  await expect(page.getByText("Document Revision Date", { exact: false })).toHaveCount(0);
});
