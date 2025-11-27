import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { canAccessRole } from "../../utils/roleUtils";

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const location = useLocation();
  const { token, role } = useAuth(); // ← не вызываем requireAuth!

  // Если нет токена — отправляем на логин
  if (!token) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Если указаны allowedRoles и роль не подходит — домой
  if (allowedRoles.length > 0 && !canAccessRole(role, allowedRoles)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;