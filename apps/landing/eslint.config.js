import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      ".lighthouseci",
      "playwright-report",
      "test-results",
      "vite.config.*",
      "vitest.config.*",
      "playwright.config.*",
      "eslint.config.*",
      ".lighthouserc.*",
    ],
  },
  ...tseslint.configs.recommended,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}", "src/sections/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}/]",
          message:
            "Hex color literals are forbidden in components — use var(--color-*) (CSS) or color.* (R3F via tokens.ts).",
        },
        {
          selector: "Literal[value=/^\\d+px$/]",
          message:
            "px literals are forbidden in components — use var(--space-*) / var(--text-*) / var(--radius-*).",
        },
        {
          selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}/]",
          message:
            "Hex color literals are forbidden in components — use var(--color-*).",
        },
      ],
    },
  },
);
