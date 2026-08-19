import { defineConfig } from "vite";

const apiTarget = process.env.VITE_API_TARGET || "http://localhost:4000";

export default defineConfig({
  root: ".",
  server: {
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/uploads": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
