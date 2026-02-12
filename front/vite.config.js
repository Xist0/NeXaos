import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import process from "node:process";

const normalizeOrigin = (value) => String(value || "").replace(/\/+$/, "");

export default defineConfig(async ({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const envBackendOrigin = normalizeOrigin(env.VITE_API_URL);
    const backendOrigin =
        mode === "development"
            ? "http://localhost:5001"
            : (envBackendOrigin || "http://localhost:5001");

    const port = Number(env.VITE_PORT) || 5173;
    const strictPort = true;

    return {
        plugins: [react()],
        server: {
            port,
            strictPort,
            proxy: {
                "/api": {
                    target: backendOrigin,
                    changeOrigin: true,
                    secure: false,
                },
                "/uploads": {
                    target: backendOrigin,
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
    };
});
