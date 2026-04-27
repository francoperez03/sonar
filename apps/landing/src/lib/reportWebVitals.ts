import { onLCP, onCLS, onINP } from "web-vitals/attribution";

type WebVitalsRecord = Record<string, { value: number; element: string }>;

declare global {
  interface Window {
    __webVitals?: WebVitalsRecord;
  }
}

type AnyMetric = {
  name: string;
  value: number;
  attribution?: { element?: string } | Record<string, unknown>;
};

function logMetric(m: AnyMetric): void {
  const attribution = m.attribution as { element?: string } | undefined;
  const el = attribution?.element ?? "?";
  console.info(`[web-vitals] ${m.name}=${m.value.toFixed(1)} element=${el}`);
  window.__webVitals = {
    ...(window.__webVitals ?? {}),
    [m.name]: { value: m.value, element: el },
  };
}

export function reportWebVitals(): void {
  onLCP((m) => logMetric(m as unknown as AnyMetric));
  onCLS((m) => logMetric(m as unknown as AnyMetric));
  onINP((m) => logMetric(m as unknown as AnyMetric));
}
