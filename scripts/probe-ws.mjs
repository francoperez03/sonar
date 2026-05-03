import { chromium } from "/Users/francoperez/repos/x402/foja-all/sonar/node_modules/.pnpm/playwright@1.48.0/node_modules/playwright/index.mjs";

const wsUrl = process.argv[2] ?? "wss://christian-actinographic-impliedly.ngrok-free.dev/logs";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const events = [];
page.on("websocket", (ws) => {
  events.push(`OPEN  ${ws.url()}`);
  ws.on("framereceived", (f) => events.push(`RECV  ${String(f.payload).slice(0, 200)}`));
  ws.on("close", () => events.push(`CLOSE ${ws.url()}`));
  ws.on("socketerror", (e) => events.push(`ERR   ${e}`));
});
page.on("console", (m) => events.push(`CONSOLE-${m.type().toUpperCase()} ${m.text()}`));
page.on("pageerror", (e) => events.push(`PAGE-ERR ${e.message}`));

await page.setContent(`<!doctype html><script>
  const ws = new WebSocket(${JSON.stringify(wsUrl)});
  ws.onopen = () => console.log("WS-OPEN");
  ws.onmessage = (e) => console.log("WS-MSG", typeof e.data === "string" ? e.data.slice(0,200) : "(binary)");
  ws.onerror = (e) => console.error("WS-ERROR");
  ws.onclose = (e) => console.log("WS-CLOSE", e.code, e.reason);
</script>`);
await page.waitForTimeout(8000);
console.log("--- target:", wsUrl, "---");
for (const e of events) console.log(e);
await browser.close();
