import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// react() is typed against vite 7's PluginOption; vitest@2 bundles vite 5
// types, which causes a structurally-equivalent-but-nominally-different
// PluginOption mismatch. Cast keeps `tsc -b` green without affecting runtime.
export default defineConfig({
  plugins: [react() as unknown as never],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: true,
  },
});
