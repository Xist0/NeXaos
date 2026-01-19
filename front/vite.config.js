import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const normalizeOrigin = (value) => String(value || "").replace(/\/+$/, "");

const probeBackend = async (origin, timeoutMs = 600) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const url = `${normalizeOrigin(origin)}/api/health`;
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
        });
        if (!res || res.status < 200 || res.status >= 400) return false;
        const data = await res.json().catch(() => null);
        return Boolean(data && data.status === "OK");
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
};

const resolveBackendOrigin = async () => {
    const ports = Array.from({ length: 21 }, (_, i) => 5000 + i);
    for (const port of ports) {
        const origin = `http://localhost:${port}`;
        // eslint-disable-next-line no-await-in-loop
        if (await probeBackend(origin)) return origin;
    }
    return null;
};

export default defineConfig(async ({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const detectedLocalBackend = await resolveBackendOrigin();
    const envBackendOrigin = normalizeOrigin(env.VITE_API_URL);
    const backendOrigin = detectedLocalBackend || envBackendOrigin || "http://localhost:5000";

    const port = Number(env.VITE_PORT) || 5173;
    const strictPort = env.VITE_STRICT_PORT === "1" || env.VITE_STRICT_PORT === "true";

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
