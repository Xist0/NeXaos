// hooks/useApi.js
import { useCallback } from "react";
import apiClient from "../services/apiClient";
import logger from "../services/logger";

const inFlightGets = new Map();
const getCache = new Map();

const buildGetKey = (url, params) => {
  if (!params) return `GET ${url}`;
  try {
    return `GET ${url}?${JSON.stringify(params)}`;
  } catch {
    return `GET ${url}`;
  }
};

const useApi = () => {
  const request = useCallback(async (config) => {
    try {
      const response = await apiClient(config);

      // Нормализация: многие endpoints возвращают обертку вида { data: ... }
      // В UI почти везде ожидают, что response.data будет уже массивом/объектом данных.
      if (
        response &&
        response.data &&
        typeof response.data === "object" &&
        !Array.isArray(response.data) &&
        Object.prototype.hasOwnProperty.call(response.data, "data")
      ) {
        response.data = response.data.data;
      }

      const method = (config.method || "GET").toUpperCase();
      if (method === "GET") {
        const key = buildGetKey(config.url, config.params);
        if (response?.status === 304) {
          const cached = getCache.get(key);
          if (cached) return cached;
        }
        getCache.set(key, response);
      }

      return response;
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
    (url, params) => {
      const key = buildGetKey(url, params);
      const existing = inFlightGets.get(key);
      if (existing) return existing;

      const promise = request({ method: "GET", url, params }).finally(() => {
        inFlightGets.delete(key);
      });
      inFlightGets.set(key, promise);
      return promise;
    },
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
