import { defineConfig } from "vite";
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 8083,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
