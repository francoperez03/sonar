/**
 * Typed re-export of design tokens for JS-side consumers (R3F materials,
 * inline animation logic). DOM-side consumers MUST use the matching
 * `var(--*)` declared in tokens.css — never import these constants into
 * components for visual styling (D-13).
 *
 * Hex/numeric values MUST stay in lockstep with tokens.css; the parity
 * test in src/test/tokens.test.ts enforces this.
 */

export const color = {
  bg: "#07090C",
  bgElevated: "#0D1117",
  surface: "#121826",
  border: "rgba(120, 200, 255, 0.12)",
  grid: "rgba(80, 200, 255, 0.06)",
  grain: "rgba(255, 255, 255, 0.015)",
  text: "#F2F4F7",
  textMuted: "#8B95A7",
  accentCyan: "#22D3EE",
  accentBlue: "#3B82F6",
  accentEcho: "#F2F4F7",
  accentCyanGlow: "rgba(34, 211, 238, 0.35)",
  destructive: "#F87171",
} as const;

export const duration = {
  fast: 150,
  base: 280,
  slow: 600,
} as const;

export const ease = {
  standard: [0.2, 0.8, 0.2, 1],
  emphasized: [0.16, 1, 0.3, 1],
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
  "4xl": 96,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 16,
} as const;

export const z = {
  base: 0,
  grid: 1,
  heroCanvas: 5,
  content: 10,
  nav: 100,
  overlay: 1000,
} as const;
