import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Reads the "@/" alias from tsconfig.app.json, so it's defined in one place only.
    tsconfigPaths: true,
  },
});
