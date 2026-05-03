import { chromium } from "playwright";

const url = process.argv[2] ?? "https://sonar-demo-ui.vercel.app/";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const wsEvents = [];
page.on("websocket", (ws) => {
  const u = ws.url();
  wsEvents.push(`OPEN  ${u}`);
  ws.on("framereceived", (f) => wsEvents.push(`RECV  ${u}  ${String(f.payload).slice(0, 120)}`));
  ws.on("framesent", (f) => wsEvents.push(`SEND  ${u}  ${String(f.payload).slice(0, 120)}`));
  ws.on("close", () => wsEvents.push(`CLOSE ${u}`));
  ws.on("socketerror", (e) => wsEvents.push(`ERR   ${u}  ${e}`));
});
page.on("console", (m) => {
  if (m.type() === "error") wsEvents.push(`CONSOLE-ERR ${m.text()}`);
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForTimeout(6000);

const badge = await page.locator('[data-testid="connection-badge"]').first();
const badgeText = (await badge.textContent({ timeout: 5000 }).catch(() => null)) ?? "(badge not found)";
const badgeClass = (await badge.getAttribute("class").catch(() => null)) ?? "(no class)";

console.log("URL:", url);
console.log("BADGE-CLASS:", badgeClass);
console.log("BADGE-TEXT :", badgeText.replace(/\s+/g, " ").trim());
console.log("--- WS / console events ---");
for (const e of wsEvents) console.log(e);
await browser.close();
