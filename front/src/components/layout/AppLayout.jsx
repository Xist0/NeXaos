import { NavLink, Outlet } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import SecureButton from "../ui/SecureButton";
import { ROLES } from "../../utils/constants";

const AppLayout = () => {
  const { user, role, logout } = useAuth();

  return (
    <div className="layout-shell">
      <header
        style={{
          padding: "1rem 1.5rem",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <strong>NeXaos</strong>
          <span style={{ marginLeft: "0.75rem", opacity: 0.7 }}>
            {role?.toUpperCase() || "Гость"}
          </span>
        </div>
        <nav style={{ display: "flex", gap: "1rem" }}>
          <NavLink to="/" end>
            Главная
          </NavLink>
          <NavLink to="/materials">Материалы</NavLink>
          {role === ROLES.ADMIN && <NavLink to="/admin">Админ</NavLink>}
        </nav>
        {user ? (
          <SecureButton onClick={logout} variant="ghost">
            Выйти
          </SecureButton>
        ) : null}
      </header>
      <main className="layout-content">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;

