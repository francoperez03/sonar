import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 200,
  },
  server: {
    port: 5174,
    proxy: {
      // AXL Node B has no CORS headers; in dev we proxy through Vite so the
      // browser sees same-origin. Set VITE_AXL_BRIDGE_URL=/axl to use it.
      "/axl": {
        target: "http://127.0.0.1:9002",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/axl/, ""),
      },
    },
  },
  preview: {
    port: 4174,
  },
});
