import { useEffect, useRef } from "react";
import useAuthStore from "../store/authStore";
import apiClient from "../services/apiClient";
import logger from "../services/logger";

const TOKEN_CHECK_INTERVAL = 5 * 60 * 1000; // 5 минут

// Глобальный таймер для проверки токена
let tokenCheckTimer = null;
let lastActivityTime = Date.now();

// Отслеживание активности пользователя
const trackActivity = () => {
  lastActivityTime = Date.now();
  
  // Если таймер не запущен, запускаем его
  if (!tokenCheckTimer) {
    startTokenCheckTimer();
  }
};

const startTokenCheckTimer = () => {
  // Очищаем предыдущий таймер если есть
  if (tokenCheckTimer) {
    clearInterval(tokenCheckTimer);
  }

  tokenCheckTimer = setInterval(() => {
    const token = useAuthStore.getState().accessToken || localStorage.getItem("nexaos_access_token");
    const timeSinceActivity = Date.now() - lastActivityTime;
    
    // Проверяем токен только если прошло не менее 5 минут с последней активности
    if (token && timeSinceActivity >= TOKEN_CHECK_INTERVAL) {
      checkToken();
    }
  }, TOKEN_CHECK_INTERVAL);
};

let isCheckingToken = false;

const checkToken = async () => {
  // Предотвращаем параллельные проверки
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
    
    // Используем apiClient напрямую для видимости в Network
    const response = await apiClient.get("/auth/me");
    const user = response?.data?.user || response?.data;
    
    if (user && user.id) {
      useAuthStore.setState({
        user,
        role: user?.roleName || "user",
      });
      localStorage.setItem("nexaos_user", JSON.stringify(user));
    } else {
      // Если пользователь не найден, выходим
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
    
    // Если токен невалиден, выходим
    if (error.response?.status === 401 || error.response?.status === 403) {
      useAuthStore.getState().logout();
      if (tokenCheckTimer) {
        clearInterval(tokenCheckTimer);
        tokenCheckTimer = null;
      }
    }
  } finally {
    isCheckingToken = false;
  }
};

// Добавляем обработчики событий для отслеживания активности
if (typeof window !== "undefined") {
  const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
  events.forEach((event) => {
    window.addEventListener(event, trackActivity, { passive: true });
  });
}

const useTokenCheck = () => {
  const tokenRef = useRef(null);

  useEffect(() => {
    const token = useAuthStore.getState().accessToken;
    tokenRef.current = token;

    if (token) {
      // Запускаем таймер при монтировании если есть токен
      if (!tokenCheckTimer) {
        startTokenCheckTimer();
      }
      
      // Проверяем токен сразу при монтировании
      checkToken();
    } else {
      // Останавливаем таймер если токена нет
      if (tokenCheckTimer) {
        clearInterval(tokenCheckTimer);
        tokenCheckTimer = null;
      }
    }

    // Подписываемся на изменения токена
    const unsubscribe = useAuthStore.subscribe(
      (state) => state.accessToken,
      (newToken) => {
        tokenRef.current = newToken;
        if (newToken) {
          if (!tokenCheckTimer) {
            startTokenCheckTimer();
          }
          checkToken();
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

