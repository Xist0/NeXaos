import { createBrowserRouter } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import HomePage from "../pages/HomePage";
import CatalogPage from "../pages/CatalogPage";
import ProductPage from "../pages/ProductPage";
import KitSolutionPage from "../pages/KitSolutionPage";
import FavoritesPage from "../pages/FavoritesPage";
import CartPage from "../pages/CartPage";
import AccountPage from "../pages/AccountPage";
import AdminPage from "../pages/AdminPage";
import WorksPage from "../pages/WorksPage";
import NotFoundPage from "../pages/NotFoundPage";
import { ROLES } from "../utils/constants";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "catalog", element: <CatalogPage /> },
      { path: "catalog/:id", element: <ProductPage /> },
      { path: "catalog/kit/:id", element: <KitSolutionPage /> },
      { path: "works", element: <WorksPage /> },
      { path: "favorites", element: <FavoritesPage /> },
      { path: "cart", element: <CartPage /> },
      {
        element: <ProtectedRoute />,
        children: [{ path: "account", element: <AccountPage /> }],
      },
      {
        element: <ProtectedRoute allowedRoles={[ROLES.ADMIN]} />,
        children: [{ path: "admin", element: <AdminPage /> }],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);

