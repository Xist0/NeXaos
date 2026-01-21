import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import useAuthStore from "../store/authStore";
import logger from "./logger";
import { enqueueRequest } from "./requestQueue";
import { refreshAccessToken } from "./auth.service";

const rawClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
  validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

rawClient.interceptors.request.use((config) => {
  // Получаем токен из store или localStorage напрямую для надежности
  const token = useAuthStore.getState().accessToken || localStorage.getItem("nexaos_access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    // Логируем проверку токена для важных действий
    if (config.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method.toUpperCase())) {
      logger.info("Проверка токена при выполнении действия", {
        method: config.method,
        url: config.url,
      });
    }
  }
  return config;
});

rawClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    const responseData = error.response?.data;
    const requestId =
      responseData?.requestId ||
      error.response?.headers?.["x-request-id"] ||
      error.response?.headers?.["X-Request-Id"];
    const backendMessage = responseData?.message;
    const validationDetails = responseData?.details;

    const url = String(originalRequest?.url || "");
    const isAuthRefresh = url.includes("/auth/refresh");
    const isAuthLogin = url.includes("/auth/login");
    const isAuthRegister = url.includes("/auth/register");

    // Если ошибка 401 и это не запрос на refresh/login
    if (status === 401 && !originalRequest._retry && !isAuthRefresh && !isAuthLogin && !isAuthRegister) {
      if (isRefreshing) {
        // Если уже идет обновление токена, ждем
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return rawClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Refresh token хранится в httpOnly cookie; тело можно отправлять пустым.
        const data = await refreshAccessToken();
        if (data?.accessToken) {
          useAuthStore.setState({
            accessToken: data.accessToken,
            user: data.user,
            role: data.user?.roleName || "user",
          });
          localStorage.setItem("nexaos_access_token", data.accessToken);
          localStorage.setItem("nexaos_user", JSON.stringify(data.user));
          
          processQueue(null, data.accessToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return rawClient(originalRequest);
        }

        processQueue(error, null);
        useAuthStore.getState().logout();
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    logger.error("API interceptor caught error", {
      status,
      method: originalRequest?.method,
      url: originalRequest?.url,
      message: backendMessage,
      requestId,
      details: validationDetails,
    });
    return Promise.reject(error);
  }
);

const runQueuedRequest = (config) =>
  enqueueRequest(() => rawClient.request(config), { retries: 1 });

const apiClient = (config) => runQueuedRequest(config);

["get", "delete", "head", "options"].forEach((method) => {
  apiClient[method] = (url, config = {}) =>
    runQueuedRequest({ ...config, method: method.toUpperCase(), url });
});

["post", "put", "patch"].forEach((method) => {
  apiClient[method] = (url, data, config = {}) =>
    runQueuedRequest({ ...config, method: method.toUpperCase(), url, data });
});

apiClient.interceptors = rawClient.interceptors;
apiClient.defaults = rawClient.defaults;

export default apiClient;

