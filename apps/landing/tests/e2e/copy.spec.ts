import { test, expect } from "@playwright/test";

const LOCKED = [
  "Rotate keys without trusting the agent.",
  "Your agent is a liability with the keys.",
  "Ping the fleet. Only the real one echoes back.",
  "Watch a key rotate end-to-end in 90 seconds.",
  "Best Use of KeeperHub",
  "Base Sepolia testnet only",
];

test("locked UI-SPEC copy renders verbatim", async ({ page }) => {
  await page.goto("/");
  for (const line of LOCKED) {
    await expect(page.getByText(line, { exact: false }).first()).toBeVisible();
  }
});

test("banned marketing words are absent from rendered DOM", async ({
  page,
}) => {
  await page.goto("/");
  const text = ((await page.textContent("body")) ?? "").toLowerCase();
  for (const banned of [
    "revolutionary",
    "seamless",
    "unleash",
    "ai agent",
    "blockchain",
  ]) {
    expect(text).not.toContain(banned);
  }
});
