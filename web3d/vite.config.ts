import { defineConfig } from "vite";
import planFixture from './scripts/plan-fixture.mjs';
export default defineConfig({
  plugins: [planFixture],
  server: {
    host: "0.0.0.0",
    port: 8083,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        rewrite: (p) => p.replace(/^\/api(?:\/v1)?/, ""),
      },
    },
  },
});
