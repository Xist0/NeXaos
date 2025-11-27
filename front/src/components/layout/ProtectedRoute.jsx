import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { canAccessRole } from "../../utils/roleUtils";

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const location = useLocation();
  const { token, role, requireAuth } = useAuth();

  if (!token) {
    requireAuth(location.pathname);
    return <div className="route-blocked">Требуется авторизация...</div>;
  }

  if (!canAccessRole(role, allowedRoles)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;

