import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.DEAL_SCOUT_BROWSER_BASE_URL ?? "http://127.0.0.1:3000";
const username = process.env.OWNER_USERNAME;
const password = process.env.OWNER_PASSWORD;

assert.ok(username && password, "Owner credentials are required for the browser smoke test");

await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/owner-queue"),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
  await page.waitForLoadState("networkidle");

  await page.getByRole("heading", { name: "What needs attention today" }).waitFor();
  const primary = page.getByRole("navigation", { name: "Primary" });
  for (const label of ["Today", "Leads", "Deals", "Buyers", "Reports"]) {
    await primary.getByRole("link", { name: label, exact: true }).waitFor();
  }
  assert.equal(await primary.getByRole("link").count(), 5);
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  assert.deepEqual(consoleErrors, []);
  await page.screenshot({ path: "artifacts/pr1-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "What needs attention today" }).waitFor();
  assert.equal(await primary.getByRole("link").count(), 5);
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  await page.screenshot({ path: "artifacts/pr1-mobile.png", fullPage: true });
  await context.close();
} finally {
  await browser.close();
}

console.log("Product foundation browser smoke test passed at 1440px and 375px.");
