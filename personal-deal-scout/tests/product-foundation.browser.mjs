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

  await page.goto(`${baseUrl}/properties`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Find the next deal worth pursuing" }).waitFor();
  for (const label of ["Street address", "City", "ZIP code"]) {
    await page.getByLabel(label, { exact: true }).waitFor();
  }
  await page.getByRole("textbox", { name: "State", exact: true }).waitFor();
  await page.getByRole("button", { name: /^All leads/ }).waitFor();
  await page.getByRole("button", { name: /^Contact ready/ }).waitFor();
  await page.getByRole("button", { name: /^Needs action/ }).waitFor();
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  await page.screenshot({ path: "artifacts/pr2-leads-desktop.png", fullPage: true });

  await page.goto(`${baseUrl}/pipeline`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Move the right deals toward closing" }).waitFor();
  for (const label of ["New lead", "Qualified", "Contacting", "Offer", "Under contract", "Closed"]) {
    await page.getByRole("heading", { name: label, exact: true }).waitFor();
  }
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByRole("button", { name: "Board", exact: true }).click();
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  await page.screenshot({ path: "artifacts/pr3-deals-desktop.png", fullPage: true });

  await page.goto(`${baseUrl}/developers`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Buyer relationships and matching deals" }).waitFor();
  await page.getByRole("link", { name: "Add a buyer" }).waitFor();
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  await page.screenshot({ path: "artifacts/pr4-buyers-desktop.png", fullPage: true });

  await page.goto(`${baseUrl}/disposition`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Match active deals with the right buyers" }).waitFor();
  const dispositionOverlay = page.locator("[data-nextjs-dialog]");
  if (await dispositionOverlay.count()) {
    throw new Error(`Disposition error overlay: ${(await dispositionOverlay.textContent())?.slice(0, 1000)}`);
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${baseUrl}/developers`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Buyer relationships and matching deals" }).waitFor();
  assert.equal(await primary.getByRole("link").count(), 5);
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  await page.screenshot({ path: "artifacts/pr4-buyers-mobile.png", fullPage: true });
  await context.close();
} finally {
  await browser.close();
}

console.log("Product foundation, Leads, Deals, and Buyers browser smoke tests passed at 1440px and 375px.");
