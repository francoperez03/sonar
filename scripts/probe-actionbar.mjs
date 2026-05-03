import { chromium } from "/Users/francoperez/repos/x402/foja-all/sonar/node_modules/.pnpm/playwright@1.48.0/node_modules/playwright/index.mjs";

const url = process.argv[2] ?? "http://localhost:5174/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const screenshot = await page.screenshot({ path: "/tmp/actionbar.png", fullPage: false });
console.log("screenshot saved /tmp/actionbar.png", screenshot.length, "bytes");

const layout = await page.evaluate(() => {
  const get = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  return {
    topbar: get(".demo-topbar"),
    shell: get(".demo-shell"),
    sidebar: get(".demo-sidebar"),
    canvas: get(".demo-canvas"),
    actionbar: get(".demo-actionbar"),
    chatInput: get('[data-testid="chat-input"]'),
    suggestions: get('[data-testid="chat-suggestions"]'),
    rotation: get(".demo-actionbar-rotation"),
  };
});
console.log(JSON.stringify(layout, null, 2));

const sidebarHasInput = await page.locator('aside.demo-sidebar [data-testid="chat-input"]').count();
const actionbarHasInput = await page.locator('.demo-actionbar [data-testid="chat-input"]').count();
console.log({ sidebarHasInput, actionbarHasInput });

await browser.close();
