// hooks/useApi.js
import { useCallback } from "react";
import apiClient from "../services/apiClient";
import logger from "../services/logger";

const useApi = () => {
  const request = useCallback(async (config) => {
    try {
      const response = await apiClient(config);
      logger.info("Запрос успешно выполнен", {
        url: config.url,
        method: config.method || "GET",
      });
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const message =
        error.response?.data?.message ||
        "Произошла ошибка при выполнении запроса";

      logger.error("Ошибка при выполнении запроса", {
        url: config.url,
        method: config.method || "GET",
        status,
        message,
      });
      throw error;
    }
  }, []);

  const get = useCallback(
    (url, params) => request({ method: "GET", url, params }),
    [request]
  );
  const post = useCallback(
    (url, data, extra = {}) => request({ method: "POST", url, data, ...extra }),
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
