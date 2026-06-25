import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/ws": "http://localhost:2567",
      "/auth": "http://localhost:2567",
      "/leaderboard": "http://localhost:2567",
      "/matches": "http://localhost:2567",
      "/stats": "http://localhost:2567",
      "/match": "http://localhost:2567",
      "/users": "http://localhost:2567",
      "/heartbeat": "http://localhost:2567",
      "/friends": "http://localhost:2567",
      "/recent-opponents": "http://localhost:2567",
      "/headtohead": "http://localhost:2567",
      "/health": "http://localhost:2567",
      "/league": "http://localhost:2567",
    },
  },
});
