import { test, expect } from "@playwright/test";

// Stub e2e — plans 02–04 fill in the real specs (palette, hero loop,
// reduced motion, a11y, LCP attribution). Keeps `playwright test --list`
// exiting 0 so the Wave 0 config-parses gate passes.
test("playwright config parses", () => {
  expect(true).toBe(true);
});
