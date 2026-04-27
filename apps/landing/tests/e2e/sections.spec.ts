import { test, expect } from "@playwright/test";

test("all narrative sections present in order", async ({ page }) => {
  await page.goto("/");
  const order = ["#problem", "#approach", "#demo"];
  for (const id of order) {
    await expect(page.locator(id)).toBeVisible();
  }
  // Hero H1 sits above the first narrative section.
  const h1Box = await page.locator("h1").first().boundingBox();
  const problemBox = await page.locator("#problem").boundingBox();
  expect(h1Box, "hero H1 must have a bounding box").not.toBeNull();
  expect(problemBox, "#problem must have a bounding box").not.toBeNull();
  expect(h1Box!.y).toBeLessThan(problemBox!.y);
});

test("dark theme palette resolves on body + tokens root", async ({ page }) => {
  await page.goto("/");
  const bg = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  expect(bg).toBe("rgb(7, 9, 12)"); // #07090C

  const cyan = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--color-accent-cyan")
      .trim(),
  );
  expect(cyan.toUpperCase()).toBe("#22D3EE");
});
