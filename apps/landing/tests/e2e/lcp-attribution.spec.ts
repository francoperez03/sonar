import { test, expect } from "@playwright/test";

test.describe("LCP attribution", () => {
  test("LCP element is the H1 (Pitfall 2 protection)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop preset for LCP gate");
    await page.goto("/");
    // wait for first contentful paint + LCP measurement window
    await page.waitForTimeout(2500);
    // Force the page into a hidden state — LCP is finalized on visibility change
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(200);
    const vitals = await page.evaluate(
      () => (window as unknown as { __webVitals?: Record<string, { value: number; selector?: string }> }).__webVitals
    );
    expect(vitals).toBeDefined();
    expect(vitals?.LCP).toBeDefined();
    expect(vitals!.LCP!.value).toBeLessThanOrEqual(2000);
    expect((vitals!.LCP!.selector ?? "").toLowerCase()).toMatch(/^h1/);
  });

  test("CLS budget <= 0.05 across desktop + mobile", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(3000);
    const vitals = await page.evaluate(
      () => (window as unknown as { __webVitals?: Record<string, { value: number }> }).__webVitals
    );
    expect(vitals?.CLS?.value ?? 0).toBeLessThanOrEqual(0.05);
  });
});
