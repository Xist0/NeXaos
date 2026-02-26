// hooks/useLogger.js
import { useCallback, useMemo } from "react";

const IS_PROD = Boolean(import.meta?.env?.PROD);

const SENSITIVE_KEYS = new Set([
    "password",
    "pass",
    "token",
    "refreshToken",
    "accessToken",
    "authorization",
    "cookie",
    "set-cookie",
]);

const redact = (value, depth = 0) => {
    if (depth > 6) return "[REDACTED]";
    if (!value) return value;
    if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
    if (typeof value !== "object") return value;

    const out = {};
    for (const [k, v] of Object.entries(value)) {
        if (SENSITIVE_KEYS.has(String(k).toLowerCase())) {
            out[k] = "[REDACTED]";
            continue;
        }
        out[k] = redact(v, depth + 1);
    }
    return out;
};

const useLogger = () => {
    const pushToast = useCallback((type, message) => {
        window.dispatchEvent(
            new CustomEvent("nexaos-toast", { detail: { type, message } })
        );
    }, []);

    const info = useCallback(
        (message, meta) => {
            if (!IS_PROD) console.log("[NeXaos] INFO", { message, meta: redact(meta) });
            // ❌ НЕ вызываем глобальный logger здесь
        },
        [pushToast]
    );

    const warn = useCallback(
        (message, meta) => {
            if (!IS_PROD) console.warn("[NeXaos] WARN", { message, meta: redact(meta) });
            pushToast("info", message);
        },
        [pushToast]
    );

    const error = useCallback(
        (message, meta) => {
            if (!IS_PROD) console.error("[NeXaos] ERROR", { message, meta: redact(meta) });
            pushToast("error", message);
        },
        [pushToast]
    );

    return useMemo(() => ({ info, warn, error }), [info, warn, error]);
};

export default useLogger;
