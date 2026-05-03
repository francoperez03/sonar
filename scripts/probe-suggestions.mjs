import { chromium } from "/Users/francoperez/repos/x402/foja-all/sonar/node_modules/.pnpm/playwright@1.48.0/node_modules/playwright/index.mjs";

const url = process.argv[2] ?? "http://localhost:5174/";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const sugg = await page.locator(".chat-suggestion").allTextContents();
console.log("SUGGESTIONS:", sugg);

await page.locator(".chat-suggestion").first().click();

let lastDraft = "";
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(400);
  const bubbles = await page.locator(".chat-bubble").allTextContents();
  const draft = bubbles[bubbles.length - 1] ?? "";
  if (draft !== lastDraft) {
    console.log(`t+${(i + 1) * 400}ms`, JSON.stringify(draft.slice(0, 100)));
    lastDraft = draft;
  }
}

const finalBubbles = await page.locator(".chat-bubble").allTextContents();
console.log("---");
console.log("BUBBLES:", finalBubbles.length);
finalBubbles.forEach((b, i) => console.log(`  [${i}]`, b.slice(0, 150)));
await browser.close();
