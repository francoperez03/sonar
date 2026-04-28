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
  bg: "#0A0A0B",
  bgElevated: "#101012",
  surface: "#1A1A1D",
  border: "rgba(255, 255, 255, 0.08)",
  grid: "rgba(255, 255, 255, 0.035)",
  grain: "rgba(255, 255, 255, 0.015)",
  text: "#FAFAFA",
  textMuted: "#A1A1AA",
  accentCyan: "#3FB8C9",
  accentBlue: "#4A88C5",
  accentEcho: "#FAFAFA",
  accentCyanGlow: "rgba(63, 184, 201, 0.18)",
  destructive: "#E07A7A",
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
  "5xl": 128,
  section: "clamp(96px, 12vw, 160px)",
  sectionSm: "clamp(64px, 8vw, 112px)",
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
