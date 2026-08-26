import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "playwright";

test("source photos display without approval, recover from broken images, and retain empty states", { timeout: 60_000 }, async () => {
  // Isolated fixture: no application database, paid API, or customer communication.
  const bundle = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {PropertyPhoto} from './src/app/properties/property-photo';
      const image=(url, rightsStatus='UNKNOWN')=>({url,altText:'Sourced property photo',rightsStatus,sendApproved:false});
      createRoot(document.getElementById('root')).render(<main>
        <section id="fallback"><PropertyPhoto eager photos={[image('https://photos.example.test/broken.jpg'),image('https://photos.example.test/real.jpg')]}/></section>
        <section id="empty"><PropertyPhoto photos={[]}/></section>
        <section id="restricted"><PropertyPhoto photos={[image('https://photos.example.test/private.jpg','RESTRICTED')]}/></section>
      </main>);`, resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, write: false, platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    banner: { js: 'window.process = { env: { NODE_ENV: "production" } };' },
  });
  const server = createServer((request, response) => {
    if (request.url === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(bundle.outputFiles[0].text); }
    else { response.setHeader("Content-Type", "text/html"); response.end('<html><head><style>.relative{position:relative}.h-40{height:160px}.w-full{width:100%}section{max-width:480px}img{object-fit:cover}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("https://photos.example.test/**", (route) => route.request().url().endsWith("real.jpg")
      ? route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aI1cAAAAASUVORK5CYII=", "base64") })
      : route.fulfill({ status: 404, body: "Not found" }));
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 850 });
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      try {
        await page.waitForFunction(() => document.querySelector("#fallback img")?.getAttribute("src")?.endsWith("real.jpg") && document.querySelector("#fallback img").naturalWidth > 0, undefined, { timeout: 10_000 });
      } catch (error) {
        throw new Error(`${error.message}; browser errors: ${JSON.stringify(errors)}; content: ${await page.locator('body').innerText()}`);
      }
      assert.equal(await page.locator("#empty").innerText(), "No source photo available yet");
      assert.equal(await page.locator("#restricted img").count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
