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
  server: {
    // Forwards API calls to Express, so the browser only ever talks to one origin.
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
