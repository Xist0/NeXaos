import { useEffect, useRef } from "react";
import useAuthStore from "../store/authStore";
import apiClient from "../services/apiClient";
import logger from "../services/logger";

const TOKEN_CHECK_INTERVAL = 5 * 60 * 1000; // 5 минут

let tokenCheckTimer = null;

let isCheckingToken = false;

const checkToken = async () => {
  if (isCheckingToken) return;

  const token = useAuthStore.getState().accessToken || localStorage.getItem("nexaos_access_token");
  if (!token) {
    if (tokenCheckTimer) {
      clearInterval(tokenCheckTimer);
      tokenCheckTimer = null;
    }
    return;
  }

  isCheckingToken = true;
  try {
    logger.info("Проверка токена и сессии", {
      action: "token_check",
      timestamp: new Date().toISOString(),
    });

    const response = await apiClient.get("/auth/me");
    const user = response?.data?.user || response?.data;

    if (user && user.id) {
      useAuthStore.setState({
        user,
        role: user?.roleName || "user",
      });
      localStorage.setItem("nexaos_user", JSON.stringify(user));
    } else {
      useAuthStore.getState().logout();
      if (tokenCheckTimer) {
        clearInterval(tokenCheckTimer);
        tokenCheckTimer = null;
      }
    }
  } catch (error) {
    logger.warn("Ошибка при проверке токена", {
      error: error.message,
      status: error.response?.status,
    });

    // apiClient interceptor already handles 401 (refresh attempt then logout)
    // If we still get here with 401/403, session is definitely invalid
    if (error.response?.status === 401 || error.response?.status === 403) {
      useAuthStore.getState().logout();
      if (tokenCheckTimer) {
        clearInterval(tokenCheckTimer);
        tokenCheckTimer = null;
      }
      useAuthStore.getState().requireAuth("/");
    }
  } finally {
    isCheckingToken = false;
  }
};

const startTokenCheckTimer = () => {
  if (tokenCheckTimer) {
    clearInterval(tokenCheckTimer);
  }

  tokenCheckTimer = setInterval(() => {
    const token = useAuthStore.getState().accessToken || localStorage.getItem("nexaos_access_token");
    if (token) {
      checkToken();
    } else {
      if (tokenCheckTimer) {
        clearInterval(tokenCheckTimer);
        tokenCheckTimer = null;
      }
    }
  }, TOKEN_CHECK_INTERVAL);
};

const useTokenCheck = () => {
  const triedSilentRefreshRef = useRef(false);

  useEffect(() => {
    const token = useAuthStore.getState().accessToken;

    if (token) {
      if (!tokenCheckTimer) {
        startTokenCheckTimer();
      }
      checkToken();
    } else {
      const user = useAuthStore.getState().user || (() => {
        try {
          return JSON.parse(localStorage.getItem("nexaos_user") || "null");
        } catch {
          return null;
        }
      })();

      if (user && !triedSilentRefreshRef.current) {
        triedSilentRefreshRef.current = true;
        useAuthStore
          .getState()
          .refreshAccess()
          .then((newToken) => {
            if (newToken) {
              if (!tokenCheckTimer) {
                startTokenCheckTimer();
              }
              checkToken();
            }
          })
          .catch(() => {
            // silent refresh failed — clear stale state
            useAuthStore.getState().logout();
          });
      }

      if (tokenCheckTimer) {
        clearInterval(tokenCheckTimer);
        tokenCheckTimer = null;
      }
    }

    const unsubscribe = useAuthStore.subscribe(
      (state) => state.accessToken,
      (newToken) => {
        if (newToken) {
          if (!tokenCheckTimer) {
            startTokenCheckTimer();
          }
        } else {
          if (tokenCheckTimer) {
            clearInterval(tokenCheckTimer);
            tokenCheckTimer = null;
          }
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  return null;
};

export default useTokenCheck;

