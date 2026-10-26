import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    allowedHosts: [".manus.computer", ".manus.space", "localhost", "127.0.0.1"],
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
