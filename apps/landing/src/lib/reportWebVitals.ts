import { onLCP, onCLS, onINP } from "web-vitals/attribution";

type Metric = {
  name: string;
  value: number;
  attribution?: { element?: string };
};

declare global {
  interface Window {
    __webVitals?: Record<string, { value: number; element: string }>;
  }
}

export function reportWebVitals(): void {
  const log = (m: Metric) => {
    const el = m.attribution?.element ?? "?";
    console.info(`[web-vitals] ${m.name}=${m.value.toFixed(1)} element=${el}`);
    window.__webVitals = {
      ...(window.__webVitals ?? {}),
      [m.name]: { value: m.value, element: el },
    };
  };
  onLCP(log);
  onCLS(log);
  onINP(log);
}
