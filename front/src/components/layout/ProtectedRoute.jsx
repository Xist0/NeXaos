import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
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

const UnauthorizedRedirect = ({ location }) => {
  const { requireAuth } = useAuth();
  useEffect(() => {
    requireAuth(location.pathname);
  }, [requireAuth, location.pathname]);
  return <Navigate to="/" state={{ from: location }} replace />;
};

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const location = useLocation();
  const { accessToken: token, role, user } = useAuth();

  const isProd = typeof process !== "undefined" && process.env?.NODE_ENV === "production";

  if (!token || isJwtExpired(token)) {
    return <UnauthorizedRedirect location={location} />;
  }

  if (allowedRoles.length > 0 && !canAccessRole(role, allowedRoles)) {
    if (!isProd) {
      console.warn("[ProtectedRoute] Доступ запрещен:", { role, allowedRoles, user });
    }
    return <UnauthorizedRedirect location={location} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
