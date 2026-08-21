import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const baseUrl = process.env.BROWSER_TEST_BASE_URL || "http://localhost:3010";
const viewports = [
  { width: 1280, height: 720 },
  { width: 1440, height: 800 },
  { width: 1440, height: 850 },
  { width: 1920, height: 1080 },
];

async function signIn(page) {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Username").fill(process.env.OWNER_USERNAME || "");
  await page.getByLabel("Password").fill(process.env.OWNER_PASSWORD || "");
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith("/login")), page.getByRole("button", { name: "Sign in" }).click()]);
}

test("operational report preserves metrics, filter disclosure, and sidebar access", { timeout: 120_000 }, async (t) => {
  assert.ok(process.env.OWNER_USERNAME && process.env.OWNER_PASSWORD, "Owner credentials are required for the browser regression.");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: viewports[0] });
    const page = await context.newPage();
    await signIn(page);

    await page.goto(`${baseUrl}/seller-crm`);
    await assert.doesNotReject(() => page.getByRole("heading", { name: "Conversations", exact: true }).waitFor());
    await assert.doesNotReject(() => page.getByRole("navigation", { name: "Conversation filters" }).waitFor());
    assert.equal(await page.locator("main").count() > 0, true);

    await page.goto(`${baseUrl}/executive`);
    assert.equal(await page.locator("[data-metric-key]").count(), 48);
    assert.equal(await page.getByText("Clear filters", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Filter this report").locator("..").getAttribute("open"), null);

    const cost = page.locator('[data-metric-key="cost_per_offer"]');
    await cost.getByText("How this is calculated").click();
    await assert.doesNotReject(() => cost.getByText("Attributed costs", { exact: true }).waitFor());
    await assert.doesNotReject(() => cost.getByText("Offers prepared", { exact: true }).waitFor());

    await page.goto(`${baseUrl}/executive?state=TX&stage=CONTRACTED&buyerId=buyer-1&agentId=agent-1`);
    assert.equal(await page.getByText("Filter this report — active", { exact: true }).locator("..").getAttribute("open"), "");
    await assert.doesNotReject(() => page.getByLabel("Active report scope").getByText("Market: TX", { exact: true }).waitFor());
    await assert.doesNotReject(() => page.getByRole("link", { name: "Clear filters" }).waitFor());

    await page.goto(`${baseUrl}/executive`);
    await page.getByText("Filter this report", { exact: true }).click();
    await page.getByPlaceholder("State").fill("TX");
    await Promise.all([page.waitForURL(/state=TX/), page.getByRole("button", { name: "Update report" }).click()]);
    await assert.doesNotReject(() => page.getByText("Filter this report — active", { exact: true }).waitFor());

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto(`${baseUrl}/owner-queue`);
      const ownerSummary = page.locator("aside details > summary").filter({ hasText: "Owner" });
      await ownerSummary.click();
      const profitLink = page.getByRole("link", { name: "Profit & Reports" });
      await profitLink.scrollIntoViewIfNeeded();
      assert.equal(await profitLink.isVisible(), true, `${viewport.width}x${viewport.height}: Profit & Reports must remain visible.`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, `${viewport.width}x${viewport.height}: page must not scroll horizontally.`);
      const receivesPointer = await profitLink.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return target === element || Boolean(target && element.contains(target));
      });
      assert.equal(receivesPointer, true, `${viewport.width}x${viewport.height}: Profit & Reports must not be overlapped.`);
      await profitLink.focus();
      assert.equal(await profitLink.evaluate((element) => document.activeElement === element), true, `${viewport.width}x${viewport.height}: Profit & Reports must remain keyboard focusable.`);
      t.diagnostic(`${viewport.width}x${viewport.height}: expanded menu, visible/clickable Profit & Reports, no horizontal overflow, keyboard focus passed`);
      await profitLink.click();
      await page.waitForURL(/\/executive/);
    }
  } finally {
    await browser.close();
  }
});
