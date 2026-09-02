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
    if (message.type() === "error") consoleErrors.push(`${message.text()} ${message.location().url ?? ""}`.trim());
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
  const applicationErrors = consoleErrors.filter(
    (message) =>
      !message.includes("status of 403") &&
      !message.includes("/_next/hmr"),
  );
  assert.deepEqual(applicationErrors, []);
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
  await page.getByRole("button", { name: "Show map" }).click();
  const mapCard = page.locator(".map-card").first();
  const mapViewport = mapCard.locator(".map-viewport");
  await mapViewport.waitFor();
  const [cardBox, viewportBox] = await Promise.all([mapCard.boundingBox(), mapViewport.boundingBox()]);
  assert.ok(cardBox && viewportBox);
  assert.ok(viewportBox.x >= cardBox.x && viewportBox.y >= cardBox.y);
  assert.ok(viewportBox.x + viewportBox.width <= cardBox.x + cardBox.width + 1);
  assert.ok(viewportBox.y + viewportBox.height <= cardBox.y + cardBox.height + 1);
  await page.screenshot({ path: "artifacts/pr7-contained-map-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Hide map" }).click();
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  await page.screenshot({ path: "artifacts/pr2-leads-desktop.png", fullPage: true });

  await page.goto(`${baseUrl}/pipeline`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Move the right deals toward closing" }).waitFor();
  await page.getByLabel("Search address, city, or ZIP").waitFor();
  for (const label of ["New lead", "Qualified", "Contacting", "Offer", "Under contract", "Closed"]) {
    await page.getByRole("heading", { name: label, exact: true }).waitFor();
  }
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByRole("button", { name: "Board", exact: true }).click();
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  await page.screenshot({ path: "artifacts/pr3-deals-desktop.png", fullPage: true });

  const firstDeal = page.getByRole("link", { name: "Open deal" }).first();
  await firstDeal.click();
  await page.getByText("Deal Desk", { exact: true }).waitFor();
  await page.getByRole("region", { name: "Property photos" }).waitFor();
  await page.getByRole("region", { name: "Price and seller information" }).waitFor();
  await page.getByRole("region", { name: "Buyer and projected profit" }).waitFor();
  await page.getByRole("region", { name: "Deal location and additional photos" }).waitFor();
  const dealUrl = page.url();
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  await page.screenshot({ path: "artifacts/pr5-property-detail-desktop.png", fullPage: true });
  await page.screenshot({ path: "artifacts/pr8-deal-layout-desktop.png", fullPage: true });

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

  await page.goto(`${baseUrl}/executive`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Know what is working and where deals are getting stuck" }).waitFor();
  await page.getByRole("heading", { name: "Lead-to-close progress" }).waitFor();
  await page.getByRole("heading", { name: "Best markets and lead sources" }).waitFor();
  assert.ok((await page.getByRole("region", { name: "At a glance" }).locator("[data-metric-key]").count()) <= 6);
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  const removedDemo = await page.request.get(`${baseUrl}/demo`);
  assert.equal(removedDemo.status(), 404);
  await page.screenshot({ path: "artifacts/pr6-reports-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto(`${baseUrl}/executive`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Lead-to-close progress" }).waitFor();
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);

  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto(`${baseUrl}/executive`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Lead-to-close progress" }).waitFor();
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${baseUrl}/properties`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("button", { name: "Show map" }).click();
  await page.locator(".map-viewport").waitFor();
  const mobileCardBox = await page.locator(".map-card").first().boundingBox();
  const mobileMapBox = await page.locator(".map-viewport").first().boundingBox();
  assert.ok(mobileCardBox && mobileMapBox);
  assert.ok(mobileMapBox.x + mobileMapBox.width <= mobileCardBox.x + mobileCardBox.width + 1);
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  await page.screenshot({ path: "artifacts/pr7-contained-map-mobile.png", fullPage: true });
  await page.goto(dealUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("region", { name: "Price and seller information" }).waitFor();
  await page.getByRole("region", { name: "Buyer and projected profit" }).waitFor();
  await page.getByRole("region", { name: "Deal location and additional photos" }).waitFor();
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  await page.screenshot({ path: "artifacts/pr8-deal-layout-mobile.png", fullPage: true });
  await page.goto(`${baseUrl}/developers`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Buyer relationships and matching deals" }).waitFor();
  assert.equal(await primary.getByRole("link").count(), 5);
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0);
  await page.screenshot({ path: "artifacts/pr4-buyers-mobile.png", fullPage: true });
  await page.goto(`${baseUrl}/executive`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Know what is working and where deals are getting stuck" }).waitFor();
  await page.screenshot({ path: "artifacts/pr6-reports-mobile.png", fullPage: true });
  await context.close();
} finally {
  await browser.close();
}

console.log("Primary workflows, contained maps, deal layout, and Reports browser smoke tests passed at 375px, 768px, 1024px, and 1440px.");
