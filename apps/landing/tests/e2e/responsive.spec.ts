import { test, expect } from "@playwright/test";

test("mobile viewport renders without horizontal scroll", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only");
  await page.goto("/");
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test("desktop hero canvas slot reserves height (no CLS surprise)", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop-only");
  await page.goto("/");
  const slot = await page
    .locator("[data-testid='hero-canvas-slot']")
    .first()
    .boundingBox();
  expect(slot).not.toBeNull();
  expect(slot!.height).toBeGreaterThan(200);
});
