// hooks/useApi.js
import { useCallback } from "react";
import apiClient from "../services/apiClient";
import logger from "../services/logger"; // ← прямой импорт

const useApi = () => {
    const request = useCallback(async (config) => {
        try {
            const response = await apiClient(config);
            logger.info("API success", {
                url: config.url,
                method: config.method || "GET",
            });
            return response.data;
        } catch (error) {
            logger.error("API failed", {
                url: config.url,
                method: config.method || "GET",
                status: error.response?.status,
            });
            throw error;
        }
    }, []); // ← ПУСТЫЕ зависимости!

    const get = useCallback(
        (url, params) => request({ method: "GET", url, params }),
        [request]
    );
    const post = useCallback(
        (url, data) => request({ method: "POST", url, data }),
        [request]
    );
    const put = useCallback(
        (url, data) => request({ method: "PUT", url, data }),
        [request]
    );
    const del = useCallback(
        (url) => request({ method: "DELETE", url }),
        [request]
    );

    return { request, get, post, put, del };
};

export default useApi;
