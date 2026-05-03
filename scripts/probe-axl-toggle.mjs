import { chromium } from "/Users/francoperez/repos/x402/foja-all/sonar/node_modules/.pnpm/playwright@1.48.0/node_modules/playwright/index.mjs";

const url = process.argv[2] ?? "http://localhost:5174/";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const consoleErrs = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => consoleErrs.push(`page-err: ${e.message}`));

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const grab = async () => {
  const badge = (await page.locator('[data-testid="connection-badge"]').textContent().catch(() => "")) ?? "";
  const transportChip = (await page.locator('[data-testid="connection-badge-transport"]').textContent().catch(() => "")) ?? "";
  const toggle = (await page.locator('[data-testid="transport-toggle"]').textContent().catch(() => "(missing)")) ?? "(missing)";
  const wsBtn = await page.locator('[data-testid="transport-toggle-ws"]').getAttribute("aria-checked").catch(() => null);
  const axlBtn = await page.locator('[data-testid="transport-toggle-axl"]').getAttribute("aria-checked").catch(() => null);
  return { badge: badge.replace(/\s+/g, " ").trim(), chip: transportChip.trim(), toggle: toggle.replace(/\s+/g, " ").trim(), wsBtn, axlBtn };
};

console.log("--- initial ---");
console.log(JSON.stringify(await grab(), null, 2));

await page.waitForTimeout(2000);
console.log("--- click AXL ---");
await page.locator('[data-testid="transport-toggle-axl"]').click();
await page.waitForTimeout(2500);
console.log(JSON.stringify(await grab(), null, 2));

await page.waitForTimeout(3000);
console.log("--- after 3s of AXL (should have last_event ticking) ---");
console.log(JSON.stringify(await grab(), null, 2));

console.log("--- click WS ---");
await page.locator('[data-testid="transport-toggle-ws"]').click();
await page.waitForTimeout(2500);
console.log(JSON.stringify(await grab(), null, 2));

console.log("--- console errors ---");
for (const e of consoleErrs) console.log(e);
await browser.close();
