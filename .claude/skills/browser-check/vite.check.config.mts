// Vite for browser checks (the browser-check skill): the app on :5174, forwarding /api to the
// check API on :4001, so the user's own dev servers on :5173 and :4000 are never touched. Its own
// cache folder keeps this second Vite from rebuilding the user's dependency cache.
import { mergeConfig } from "vite";

import base from "../../../frontend/vite.config.ts";

export default mergeConfig(base, {
  cacheDir: "node_modules/.vite-browser-check",
  server: {
    port: 5174,
    strictPort: true,
    proxy: { "/api": "http://localhost:4001" },
  },
});
