import { chromium } from "/Users/francoperez/repos/x402/foja-all/sonar/node_modules/.pnpm/playwright@1.48.0/node_modules/playwright/index.mjs";

const url = process.argv[2] ?? "http://localhost:5174/";
const prompt = process.argv[3] ?? "list runtimes";

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const events = [];
page.on("console", (m) => events.push(`CONSOLE-${m.type().toUpperCase()} ${m.text().slice(0, 200)}`));
page.on("pageerror", (e) => events.push(`PAGE-ERR ${e.message}`));

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

await page.fill('[data-testid="chat-input"]', prompt);
await page.click('[data-testid="chat-input-send"]');

// Watch for ~12s
let lastDraft = "";
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(500);
  const bubbles = await page.locator(".chat-bubble").allTextContents();
  const draft = bubbles[bubbles.length - 1] ?? "";
  if (draft !== lastDraft) {
    console.log(`t+${(i + 1) * 500}ms  bubble[-1] = ${JSON.stringify(draft.slice(0, 120))}`);
    lastDraft = draft;
  }
}

const finalBubbles = await page.locator(".chat-bubble").allTextContents();
const badge = (await page.locator('[data-testid="connection-badge"]').textContent({ timeout: 2000 }).catch(() => "")) ?? "";
console.log("---");
console.log("BADGE:", badge.replace(/\s+/g, " ").trim());
console.log("FINAL bubbles:", finalBubbles.length);
finalBubbles.forEach((b, i) => console.log(`  [${i}]`, b.slice(0, 200)));
console.log("---");
for (const e of events.slice(-15)) console.log(e);
await browser.close();
