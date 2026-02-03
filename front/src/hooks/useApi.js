// hooks/useApi.js
import { useCallback } from "react";
import apiClient from "../services/apiClient";
import logger from "../services/logger";

const inFlightGets = new Map();
const getCache = new Map();

let lastPersistCleanupAt = 0;

const GET_PERSIST_TTL_MS =
  Number(
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GET_CACHE_TTL_MS) ||
      undefined
  ) ||
  60 * 60 * 1000;

const cleanupPersistedCache = () => {
  const now = Date.now();
  if (now - lastPersistCleanupAt < 10 * 60 * 1000) return;
  lastPersistCleanupAt = now;

  try {
    const prefix = "nexaos_get_cache:";
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || !parsed.ts) {
          localStorage.removeItem(key);
          continue;
        }
        if (Date.now() - Number(parsed.ts) > GET_PERSIST_TTL_MS) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
};

const getCacheBuster = () => {
  try {
    return localStorage.getItem("nexaos_cache_buster") || "";
  } catch {
    return "";
  }
};

const buildPersistKey = (key) => {
  const buster = getCacheBuster();
  return `nexaos_get_cache:${buster}:${key}`;
};

const readPersisted = (key) => {
  try {
    cleanupPersistedCache();
    const raw = localStorage.getItem(buildPersistKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.ts || Date.now() - Number(parsed.ts) > GET_PERSIST_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writePersisted = (key, response) => {
  try {
    if (!response) return;
    localStorage.setItem(
      buildPersistKey(key),
      JSON.stringify({ ts: Date.now(), status: response.status, data: response.data })
    );
  } catch {
    // ignore
  }
};

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
      const method = (config.method || "GET").toUpperCase();

      if (method === "GET") {
        const key = buildGetKey(config.url, config.params);
        const persisted = readPersisted(key);
        if (persisted) {
          const resp = { status: persisted.status || 200, data: persisted.data };
          getCache.set(key, resp);
          return resp;
        }
      }

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

      if (method === "GET") {
        const key = buildGetKey(config.url, config.params);
        if (response?.status === 304) {
          const cached = getCache.get(key);
          if (cached) return cached;

          const persisted = readPersisted(key);
          if (persisted) {
            const resp = { status: persisted.status || 200, data: persisted.data };
            getCache.set(key, resp);
            return resp;
          }
        }
        getCache.set(key, response);
        writePersisted(key, response);
      } else {
        try {
          localStorage.setItem("nexaos_cache_buster", String(Date.now()));
        } catch {
          // ignore
        }
        getCache.clear();
        inFlightGets.clear();
      }

      return response;
    } catch (error) {
      const status = error.response?.status;
      const message =
        error.response?.data?.message ||
        "Произошла ошибка при выполнении запроса";

      const requestId =
        error.response?.data?.requestId ||
        error.response?.headers?.["x-request-id"] ||
        error.response?.headers?.["X-Request-Id"];

      const details = error.response?.data?.details;

      logger.error("Ошибка при выполнении запроса", {
        url: config.url,
        method: config.method || "GET",
        status,
        message,
        requestId,
        details,
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
