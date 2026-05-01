/// <reference types="@testing-library/jest-dom/vitest" />
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

// Bind jest-dom matchers to demo-ui's local vitest expect.
// Using @testing-library/jest-dom/vitest auto-binding fails when vitest is
// hoisted at the workspace root to a different major (operator pins 4.1.5)
// than this app (vitest 2.1.x); the auto-binding then mutates the wrong
// expect instance. Importing the matchers and extending explicitly keeps
// the binding local to the test runner that actually runs this file.
expect.extend(matchers);

// jsdom does not implement IntersectionObserver. framer-motion's
// whileInView feature requires it, so stub a no-op implementation for tests.
class IntersectionObserverStub {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    IntersectionObserverStub;
}

if (typeof window.matchMedia === "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// react-virtuoso (plans 04+) requires ResizeObserver. jsdom lacks it.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
}
