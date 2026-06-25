import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devApiTarget = env.VITE_DEV_API_URL || env.PUBLIC_API_URL || "http://localhost:4000";

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": devApiTarget,
        "/uploads": devApiTarget
      }
    }
  };
});
