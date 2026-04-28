import { onLCP, onCLS, onINP } from "web-vitals/attribution";

type WebVitalsRecord = Record<
  string,
  { value: number; element?: string; selector?: string }
>;

declare global {
  interface Window {
    __webVitals?: WebVitalsRecord;
  }
}

type AttributionShape = {
  target?: string;
  element?: Element | string | null;
  lcpEntry?: { element?: Element | null } | null;
  [key: string]: unknown;
};

type AnyMetric = {
  name: string;
  value: number;
  attribution?: AttributionShape;
};

function buildSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls =
    typeof el.className === "string" && el.className.trim().length > 0
      ? `.${el.className.trim().split(/\s+/)[0]}`
      : "";
  return `${tag}${id}${cls}`;
}

function logMetric(m: AnyMetric): void {
  const attribution = m.attribution;
  let elementStr: string | undefined;
  let selector: string | undefined;

  // web-vitals v5: attribution.target is a CSS selector string for the element.
  // Fallback to attribution.element (older shape) and attribution.lcpEntry.element
  // (LargestContentfulPaint entry exposes the actual Element node).
  const lcpElement = attribution?.lcpEntry?.element ?? null;
  const rawEl = attribution?.element ?? null;
  const target = attribution?.target;

  if (lcpElement instanceof Element) {
    selector = buildSelector(lcpElement);
    elementStr = selector;
  } else if (rawEl instanceof Element) {
    selector = buildSelector(rawEl);
    elementStr = selector;
  } else if (typeof target === "string" && target.length > 0) {
    selector = target.toLowerCase();
    elementStr = target;
  } else if (typeof rawEl === "string") {
    selector = rawEl.toLowerCase();
    elementStr = rawEl;
  }

  console.info(
    `[web-vitals] ${m.name}=${m.value.toFixed(1)} element=${elementStr ?? "?"}`
  );
  window.__webVitals = {
    ...(window.__webVitals ?? {}),
    [m.name]: { value: m.value, element: elementStr, selector },
  };
}

export function reportWebVitals(): void {
  onLCP((m) => logMetric(m as unknown as AnyMetric));
  onCLS((m) => logMetric(m as unknown as AnyMetric));
  onINP((m) => logMetric(m as unknown as AnyMetric));
}
