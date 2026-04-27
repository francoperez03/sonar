import { test, expect } from "@playwright/test";

test.use({ contextOptions: { reducedMotion: "reduce" } });

test("reduced-motion: hero shell renders with locked H1 copy", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText(
    "Rotate keys without trusting",
  );
  // Plan 03 will extend this spec to assert the live <canvas> is absent
  // when reduced-motion is active. In plan 02 baseline HeroCanvas is a stub
  // returning the static SVG fallback, so no <canvas> exists yet.
});
