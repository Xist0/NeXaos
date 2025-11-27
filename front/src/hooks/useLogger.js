// hooks/useLogger.js
import { useCallback } from "react";

const useLogger = () => {
    const pushToast = useCallback((type, message) => {
        window.dispatchEvent(
            new CustomEvent("nexaos-toast", { detail: { type, message } })
        );
    }, []);

    const info = useCallback(
        (message, meta) => {
            console.log("[NeXaos] INFO", { message, meta });
            // ❌ НЕ вызываем глобальный logger здесь
        },
        [pushToast]
    );

    const warn = useCallback(
        (message, meta) => {
            console.warn("[NeXaos] WARN", { message, meta });
            pushToast("info", message);
        },
        [pushToast]
    );

    const error = useCallback(
        (message, meta) => {
            console.error("[NeXaos] ERROR", { message, meta });
            pushToast("error", message);
        },
        [pushToast]
    );

    return { info, warn, error };
};

export default useLogger;
