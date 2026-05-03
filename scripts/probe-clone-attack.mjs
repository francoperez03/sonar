import { chromium } from "/Users/francoperez/repos/x402/foja-all/sonar/node_modules/.pnpm/playwright@1.48.0/node_modules/playwright/index.mjs";

const url = process.argv[2] ?? "http://localhost:5174/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(`E ${m.text().slice(0,150)}`); });

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);

// Click the suggestion
const sims = await page.locator(".chat-suggestion", { hasText: "Simulate clone attack" }).count();
console.log("simulate-clone-attack chip exists:", sims === 1);
await page.locator(".chat-suggestion", { hasText: "Simulate clone attack" }).click();

// Watch gamma-clone for the clone-rejected class
let captured = "";
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(400);
  const cls = (await page.locator('[data-testid="runtime-node-gamma-clone"]').getAttribute("class").catch(() => "")) ?? "";
  if (cls.includes("clone-rejected") && !captured.includes("clone-rejected")) {
    console.log(`t+${(i + 1) * 400}ms: gamma-clone class = ${cls}`);
    captured = cls;
  }
}
const final = (await page.locator('[data-testid="runtime-node-gamma-clone"]').getAttribute("class")) ?? "";
console.log("FINAL class:", final);
console.log("flash visible:", final.includes("clone-rejected"));

const ss = await page.screenshot({ path: "/tmp/clone-attack.png" });
console.log("screenshot saved /tmp/clone-attack.png", ss.length, "bytes");

await browser.close();
