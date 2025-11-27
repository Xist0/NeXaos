import { createBrowserRouter } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import AuthPage from "../pages/AuthPage";
import DashboardPage from "../pages/DashboardPage";
import MaterialsPage from "../pages/MaterialsPage";
import AdminPage from "../pages/AdminPage";
import NotFoundPage from "../pages/NotFoundPage";
import { ROLES } from "../utils/constants";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        element: (
          <ProtectedRoute allowedRoles={[ROLES.USER, ROLES.MANAGER, ROLES.ADMIN]} />
        ),
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "materials", element: <MaterialsPage /> },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={[ROLES.ADMIN]} />,
        children: [{ path: "admin", element: <AdminPage /> }],
      },
    ],
  },
  { path: "/auth", element: <AuthPage /> },
  { path: "*", element: <NotFoundPage /> },
]);

