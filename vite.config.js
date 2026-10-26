import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the build works at stillwagon.github.io/hooch-report/.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { target: "es2020", chunkSizeWarningLimit: 1500 },
  test: { environment: "node" },
});
