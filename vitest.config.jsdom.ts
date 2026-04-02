import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.jsdom.ts"],
    globals: true,
  },
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
});
