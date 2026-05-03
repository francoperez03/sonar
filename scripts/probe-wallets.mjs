import { chromium } from "/Users/francoperez/repos/x402/foja-all/sonar/node_modules/.pnpm/playwright@1.48.0/node_modules/playwright/index.mjs";

const url = process.argv[2] ?? "http://localhost:5174/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);

const ss = await page.screenshot({ path: "/tmp/wallets.png" });
console.log("screenshot saved /tmp/wallets.png", ss.length, "bytes");

const wallets = await page.locator('[data-testid^="runtime-wallet-"]').all();
console.log("wallet blocks:", wallets.length);
for (const w of wallets) {
  const id = await w.getAttribute("data-testid");
  const text = (await w.textContent()) ?? "";
  console.log(`  ${id}: ${text.replace(/\s+/g, " ").trim()}`);
}

const allCards = await page.locator('[data-testid^="runtime-node-"]').all();
console.log("---");
for (const c of allCards) {
  const id = await c.getAttribute("data-testid");
  const text = (await c.textContent()) ?? "";
  console.log(`  ${id}: ${text.replace(/\s+/g, " ").slice(0, 200)}`);
}
await browser.close();
