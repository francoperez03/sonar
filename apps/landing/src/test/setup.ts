import "@testing-library/jest-dom/vitest";

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
