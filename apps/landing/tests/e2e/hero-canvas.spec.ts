import { test, expect } from "@playwright/test";

test.describe("Hero R3F canvas", () => {
  test("canvas mounts after lazy load", async ({ page }) => {
    await page.goto("/");
    const canvas = page.locator("[data-testid='hero-canvas-slot'] canvas");
    await expect(canvas).toBeVisible({ timeout: 5000 });
  });

  test("autonomous loop animates (frame counter + clock advances)", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "desktop-only; mobile uses 60vh + same logic",
    );
    await page.goto("/");
    const canvasLoc = page.locator("[data-testid='hero-canvas-slot'] canvas");
    await expect(canvasLoc).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(400);

    // PingScene's useFrame writes its frame counter and the loop's `t` to
    // window.__pingFrames / window.__pingT every tick. Asserting both
    // advance proves the autonomous R3F loop is actually running — more
    // reliable than pixel diff under Playwright headless WebGL where
    // toDataURL can return a cleared back-buffer.
    const sample = async () =>
      await page.evaluate(() => {
        const w = window as unknown as {
          __pingFrames?: number;
          __pingT?: number;
        };
        return { frames: w.__pingFrames ?? -1, t: w.__pingT ?? -1 };
      });

    const a = await sample();
    await page.waitForTimeout(900);
    const b = await sample();

    expect(a.frames).toBeGreaterThan(0);
    expect(b.frames).toBeGreaterThan(a.frames + 30); // ~50fps over 900ms
    expect(b.t).not.toBe(a.t);
  });

  test("FPS >= 50 during loop (desktop)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only FPS gate");
    await page.goto("/");
    await page.waitForTimeout(800);
    const fps = await page.evaluate(async () => {
      return await new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = () => {
          frames++;
          if (performance.now() - start < 3000) {
            requestAnimationFrame(tick);
          } else {
            resolve((frames / (performance.now() - start)) * 1000);
          }
        };
        requestAnimationFrame(tick);
      });
    });
    expect(fps).toBeGreaterThanOrEqual(50);
  });

  test("NodeBadge labels visible: ALPHA / BETA / GAMMA", async ({ page }) => {
    await page.goto("/");
    for (const label of ["ALPHA", "BETA", "GAMMA"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });
});
