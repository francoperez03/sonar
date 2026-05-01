// Augment vitest's Assertion interface so jest-dom matchers typecheck.
// The auto-binding shipped at @testing-library/jest-dom/vitest augments the
// hoisted vitest module instance, but this app resolves vitest@2 locally
// while operator/runtime/mcp/keeperhub pull in vitest@4 — the hoisted
// instance is v4, so the auto-augmentation never reaches v2's Assertion.
// We re-augment the @vitest/expect module (the actual home of the
// Assertion interface) here so tsc sees the matchers in this app's tests.
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare module "@vitest/expect" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends TestingLibraryMatchers<unknown, T> {}
  interface AsymmetricMatchersContaining
    extends TestingLibraryMatchers<unknown, unknown> {}
}
