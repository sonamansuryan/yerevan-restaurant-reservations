/// <reference types="vitest/config" />
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
  test: {
    // Tests ignore the Client ID in your frontend/.env, so they behave the same on every machine.
    // The tests of Google's button set a fake one, and never load Google's script.
    env: { VITE_GOOGLE_CLIENT_ID: "" },
  },
});
