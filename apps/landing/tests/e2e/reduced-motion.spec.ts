import { test, expect } from "@playwright/test";

test.use({ contextOptions: { reducedMotion: "reduce" } });

test("reduced-motion: hero shell renders with locked H1 copy", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText(
    "Rotate keys without trusting",
  );
});

test("reduced-motion: no <canvas> in hero, fallback SVG remains", async ({
  page,
}) => {
  await page.goto("/");
  // HeroCanvas returns null under reduced-motion → no <canvas> ever mounts.
  // Wait long enough for the lazy chunk to resolve so a false negative
  // can't sneak through.
  await page.waitForTimeout(800);
  const canvasCount = await page
    .locator("[data-testid='hero-canvas-slot'] canvas")
    .count();
  expect(canvasCount).toBe(0);
  // Fallback SVG silhouette must still be visible in the slot
  const fallbackSvg = page.locator("[data-testid='hero-canvas-slot'] svg");
  await expect(fallbackSvg.first()).toBeVisible();
});

test("reduced-motion: fallback SVG encodes the 3 sonar nodes", async ({
  page,
}) => {
  await page.goto("/");
  // NodeBadges are inside HeroCanvas (which returns null under reduced-motion).
  // The fallback SVG already encodes the three node positions visually:
  // assert >= 3 <circle> children render.
  const circles = await page
    .locator("[data-testid='hero-canvas-slot'] svg circle")
    .count();
  expect(circles).toBeGreaterThanOrEqual(3);
});
