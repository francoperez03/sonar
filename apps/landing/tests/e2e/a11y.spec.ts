import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('no critical violations on first paint', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    if (critical.length > 0) {
      console.error('axe violations:', JSON.stringify(critical, null, 2));
    }
    expect(critical).toEqual([]);
  });

  test('primary CTA is keyboard-focusable with visible focus ring', async ({ page }, testInfo) => {
    // Keyboard Tab navigation is a desktop concern; mobile touch viewports do not
    // dispatch keyboard Tab events the same way under Playwright. Focus rings on
    // mobile are not part of the locked UI contract.
    test.skip(testInfo.project.name !== 'desktop', 'desktop-only keyboard focus check');
    await page.goto('/');
    // Scope to hero: the app CTA is the primary tabbable target.
    const cta = page.getByTestId('hero').getByText('Go to app');
    // Advance focus via keyboard so :focus-visible activates deterministically.
    // Programmatic .focus() does NOT reliably trigger :focus-visible across all Chromium builds.
    await page.keyboard.press('Tab');
    for (let i = 0; i < 20; i++) {
      const isFocused = await cta.evaluate((el) => el === document.activeElement);
      if (isFocused) break;
      await page.keyboard.press('Tab');
    }
    await expect(cta).toBeFocused();
    const outline = await cta.evaluate((el) => getComputedStyle(el).outlineColor);
    // expect cyan outline (#3FB8C9 → rgb(63, 184, 201))
    expect(outline).toMatch(/rgb\(63,\s*184,\s*201\)/);
  });
});
