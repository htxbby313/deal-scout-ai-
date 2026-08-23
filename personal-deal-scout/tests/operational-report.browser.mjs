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
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith("/login")),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
}

test(
  "operational report preserves metrics, filter disclosure, and sidebar access",
  { timeout: 120_000 },
  async (t) => {
    assert.ok(
      process.env.OWNER_USERNAME && process.env.OWNER_PASSWORD,
      "Owner credentials are required for the browser regression.",
    );
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: viewports[0] });
      const page = await context.newPage();
      await signIn(page);

      await page.goto(`${baseUrl}/`);
      await page.waitForURL(/\/owner-queue$/);
      await assert.doesNotReject(() => page.getByRole("heading", { name: "Dashboard", exact: true }).waitFor());
      assert.equal(await page.getByRole("link", { name: "Skip to main content" }).count(), 1);

      await page.goto(`${baseUrl}/properties`);
      await page.getByText("Add one property for automatic research", { exact: true }).click();
      for (const name of ["address", "city", "state", "zipCode"]) assert.equal(await page.locator(`input[name="${name}"]`).isVisible(), true, `${name} must be visible in the compact property form.`);
      await assert.doesNotReject(() => page.getByRole("button", { name: "Start property research", exact: true }).waitFor());
      assert.equal(await page.getByText("Add known details (optional)", { exact: true }).locator("..").getAttribute("open"), null);
      const propertyCard = page.getByRole("button").filter({ hasText: "Open dossier" }).first();
      if (await propertyCard.count()) {
        await propertyCard.click();
        await assert.doesNotReject(() => page.getByRole("dialog").waitFor());
        await page.keyboard.press("Escape");
        await assert.doesNotReject(() => page.getByRole("dialog").waitFor({ state: "detached" }));
      }

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${baseUrl}/properties`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "390x844: Properties must not create page-level horizontal overflow.");
      await assert.doesNotReject(() => page.getByRole("link", { name: "Dashboard" }).waitFor());
      await page.setViewportSize(viewports[0]);

      await page.goto(`${baseUrl}/seller-crm`);
      await assert.doesNotReject(() =>
        page
          .getByRole("heading", { name: "Conversations", exact: true })
          .waitFor(),
      );
      await assert.doesNotReject(() =>
        page
          .getByRole("navigation", { name: "Conversation filters" })
          .waitFor(),
      );
      assert.equal((await page.locator("main").count()) > 0, true);
      const channelSelect = page.locator('select[name="channel"]').first();
      assert.equal(
        await channelSelect
          .locator('option:has-text("Email")')
          .getAttribute("value"),
        "EMAIL",
      );
      if (await page.locator('input[name="engagementId"]').count()) {
        await assert.doesNotReject(() =>
          page.getByText("Seller objections", { exact: true }).waitFor(),
        );
        await assert.doesNotReject(() =>
          page.getByText("Seller questions", { exact: true }).waitFor(),
        );
        if (await page.locator("#seller-intake").count())
          t.diagnostic(
            "Seller-facts intake is reachable from the selected conversation",
          );
      }
      await page.goto(
        `${baseUrl}/seller-crm?view=open&q=__no_matching_seller__`,
      );
      await assert.doesNotReject(() =>
        page.getByRole("heading", { name: "No seller selected" }).waitFor(),
      );
      assert.equal(await page.locator('input[name="engagementId"]').count(), 0);
      await page.getByRole("link", { name: "Clear filters" }).click();
      await page.waitForURL(/view=open/);

      await page.goto(`${baseUrl}/executive`);
      assert.equal(await page.locator("[data-metric-key]").count(), 48);
      assert.equal(
        await page.getByText("Clear filters", { exact: true }).count(),
        0,
      );
      assert.equal(
        await page
          .getByText("Filter this report")
          .locator("..")
          .getAttribute("open"),
        null,
      );

      const cost = page.locator('[data-metric-key="cost_per_offer"]');
      await cost.getByText("How this is calculated").click();
      await assert.doesNotReject(() =>
        cost.getByText("Attributed costs", { exact: true }).waitFor(),
      );
      await assert.doesNotReject(() =>
        cost.getByText("Offers prepared", { exact: true }).waitFor(),
      );
      const duration = page.locator('[data-metric-key="average_stage_hours"]');
      await duration.getByText("How this is calculated").click();
      await assert.doesNotReject(() =>
        duration
          .getByText("Total duration ÷ completed observations", { exact: true })
          .waitFor(),
      );
      assert.equal(
        await duration.getByText("Numerator", { exact: true }).count(),
        0,
      );

      await page.goto(
        `${baseUrl}/executive?state=TX&stage=CONTRACTED&buyerId=buyer-1&agentId=agent-1&propertyType=LAND&leadSource=county_record&transactionStructure=assignment_contract`,
      );
      assert.equal(
        await page
          .getByText("Filter this report — active", { exact: true })
          .locator("..")
          .getAttribute("open"),
        "",
      );
      await assert.doesNotReject(() =>
        page
          .getByLabel("Active report scope")
          .getByText("Market: TX", { exact: true })
          .waitFor(),
      );
      await assert.doesNotReject(() =>
        page
          .getByLabel("Active report scope")
          .getByText("Property type: Land", { exact: true })
          .waitFor(),
      );
      await assert.doesNotReject(() =>
        page
          .getByLabel("Active report scope")
          .getByText("Lead source: County Record", { exact: true })
          .waitFor(),
      );
      await assert.doesNotReject(() =>
        page
          .getByLabel("Active report scope")
          .getByText("Transaction structure: Assignment Contract", {
            exact: true,
          })
          .waitFor(),
      );
      await assert.doesNotReject(() =>
        page.getByRole("link", { name: "Clear filters" }).waitFor(),
      );

      await page.goto(`${baseUrl}/executive`);
      await page.getByText("Filter this report", { exact: true }).click();
      await page.getByPlaceholder("State").fill("TX");
      await Promise.all([
        page.waitForURL(/state=TX/),
        page.getByRole("button", { name: "Update report" }).click(),
      ]);
      await assert.doesNotReject(() =>
        page
          .getByText("Filter this report — active", { exact: true })
          .waitFor(),
      );

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto(`${baseUrl}/owner-queue`);
        const ownerSummary = page
          .locator("aside details > summary")
          .filter({ hasText: "Owner" });
        await ownerSummary.click();
        const profitLink = page.getByRole("link", { name: "Profit & Reports" });
        await profitLink.scrollIntoViewIfNeeded();
        assert.equal(
          await profitLink.isVisible(),
          true,
          `${viewport.width}x${viewport.height}: Profit & Reports must remain visible.`,
        );
        assert.equal(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
          true,
          `${viewport.width}x${viewport.height}: page must not scroll horizontally.`,
        );
        const receivesPointer = await profitLink.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const target = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          return (
            target === element || Boolean(target && element.contains(target))
          );
        });
        assert.equal(
          receivesPointer,
          true,
          `${viewport.width}x${viewport.height}: Profit & Reports must not be overlapped.`,
        );
        await profitLink.focus();
        assert.equal(
          await profitLink.evaluate(
            (element) => document.activeElement === element,
          ),
          true,
          `${viewport.width}x${viewport.height}: Profit & Reports must remain keyboard focusable.`,
        );
        t.diagnostic(
          `${viewport.width}x${viewport.height}: expanded menu, visible/clickable Profit & Reports, no horizontal overflow, keyboard focus passed`,
        );
        await profitLink.click();
        await page.waitForURL(/\/executive/);
      }
    } finally {
      await browser.close();
    }
  },
);
