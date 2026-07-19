import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import useAuthStore from "../../store/authStore";
import { canAccessRole } from "../../utils/roleUtils";

const isJwtExpired = (token) => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.exp) return true;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
};

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const refreshAccess = useAuthStore((s) => s.refreshAccess);
  const logoutFn = useAuthStore((s) => s.logout);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);

  const handleLogout = useCallback(() => {
    logoutFn();
  }, [logoutFn]);

  useEffect(() => {
    if (accessToken && isJwtExpired(accessToken) && !refreshing && !refreshFailed) {
      setRefreshing(true);
      refreshAccess()
        .then((newToken) => {
          if (!newToken) {
            setRefreshFailed(true);
          }
        })
        .catch(() => {
          setRefreshFailed(true);
        })
        .finally(() => {
          setRefreshing(false);
        });
    }
  }, [accessToken, refreshing, refreshFailed, refreshAccess]);

  // Разлогировать при истёкшем токене или неудачном refresh — в useEffect (side-effect)
  useEffect(() => {
    if (refreshFailed) {
      handleLogout();
    }
  }, [refreshFailed, handleLogout]);

  // Отсутствие токена — сразу редирект на главную (без logout, т.к. уже нет токена)
  if (!accessToken) {
    return <Navigate to="/" replace />;
  }

  if (refreshing) {
    return null;
  }

  // Токен истёк и refresh не удался — редирект (logout уже в useEffect)
  if (isJwtExpired(accessToken) || refreshFailed) {
    return <Navigate to="/" replace />;
  }

  // Недостаточно прав — редирект на главную
  if (allowedRoles.length > 0 && !canAccessRole(role, allowedRoles)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
