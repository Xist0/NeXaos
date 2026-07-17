import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import useAuth from "../../hooks/useAuth";
import { canAccessRole } from "../../utils/roleUtils";

const isJwtExpired = (token) => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
};

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const location = useLocation();
  const { accessToken: token, role, user, refreshAccess } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);

  useEffect(() => {
    if (token && isJwtExpired(token) && !refreshing && !refreshFailed) {
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
  }, [token, refreshing, refreshFailed, refreshAccess]);

  if (refreshing) {
    return null;
  }

  if (!token || isJwtExpired(token) || refreshFailed) {
    useAuth.getState().logout();
    return null;
  }

  if (allowedRoles.length > 0 && !canAccessRole(role, allowedRoles)) {
    useAuth.getState().logout();
    return null;
  }

  return <Outlet />;
};

export default ProtectedRoute;
