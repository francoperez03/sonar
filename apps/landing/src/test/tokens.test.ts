import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import * as tokens from "../styles/tokens";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(__dirname, "../styles/tokens.css");
const css = readFileSync(cssPath, "utf8");

const cssVars = Array.from(css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)).map(
  ([, name, value]) => ({ name, value: value.trim() }),
);

type TokenGroup = "color" | "space" | "duration" | "radius" | "z";
const groupKeys: TokenGroup[] = ["color", "space", "duration", "radius", "z"];

const cssKeyToTsPath = (
  name: string,
): { group: TokenGroup; key: string } | null => {
  const segs = name.split("-");
  const groupRaw = segs[0];
  if (!groupRaw) return null;
  if (!groupKeys.includes(groupRaw as TokenGroup)) return null;
  const rest = segs.slice(1);
  const key = rest
    .map((seg, i) => (i === 0 ? seg : seg.charAt(0).toUpperCase() + seg.slice(1)))
    .join("");
  return { group: groupRaw as TokenGroup, key };
};

describe("tokens.css <-> tokens.ts parity", () => {
  for (const { name, value } of cssVars) {
    const mapped = cssKeyToTsPath(name);
    // Out of parity scope: --container-*, --font-*, --text-*, --lh-*,
    // --size-*, --ease-*, plus rgba color tokens (border/grid/grain).
    if (!mapped) continue;
    const groupTokens = (tokens as unknown as Record<string, Record<string, string | number>>)[
      mapped.group
    ];
    const tsValue = groupTokens?.[mapped.key];

    it(`--${name} matches ${mapped.group}.${mapped.key}`, () => {
      // rgba colors are intentionally not duplicated literally in tokens.ts;
      // they live only as CSS vars consumed via var(--*).
      if (typeof value === "string" && value.startsWith("rgba(")) {
        if (tsValue === undefined) return;
      }
      expect(
        tsValue,
        `tokens.ts is missing ${mapped.group}.${mapped.key}`,
      ).toBeDefined();
      const cssNorm = String(value).replace(/px$/i, "").replace(/ms$/i, "");
      const tsNorm = String(tsValue);
      expect(cssNorm.toLowerCase()).toBe(tsNorm.toLowerCase());
    });
  }
});

describe("tokens.ts sanity", () => {
  it("locks accent cyan to calibrated #3FB8C9", () => {
    expect(tokens.color.accentCyan).toBe("#3FB8C9");
  });
  it("locks space.md to 16", () => {
    expect(tokens.space.md).toBe(16);
  });
  it("locks duration.base to 280", () => {
    expect(tokens.duration.base).toBe(280);
  });
});
