import { NavLink, Outlet, Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import useCart from "../../hooks/useCart";
import SecureButton from "../ui/SecureButton";
import { ROLES } from "../../utils/constants";

const navLinks = [
  { label: "Главная", to: "/" },
  { label: "Каталог", to: "/catalog" },
  { label: "Избранное", to: "/favorites" },
  { label: "Корзина", to: "/cart" },
];

const AppLayout = () => {
  const { user, role, logout, requireAuth } = useAuth();
  const { items } = useCart();
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="shop-shell">
      <div className="bg-night-900 text-white text-xs sm:text-sm">
        <div className="shop-container flex flex-wrap items-center justify-between gap-2 py-2">
          <p>Сервис и доставка мебели по всей России</p>
          <p className="opacity-80">8 (800) 555-35-35 — ежедневно 09:00–21:00</p>
        </div>
      </div>

      <header className="bg-white border-b border-night-100">
        <div className="shop-container flex h-20 items-center justify-between gap-6">
          <Link to="/" className="text-2xl font-semibold text-night-900">
            NeXaos
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-night-500">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `transition hover:text-accent ${
                    isActive ? "text-night-900" : ""
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            {role === ROLES.ADMIN && (
              <NavLink to="/admin" className="text-accent">
                Админ
              </NavLink>
            )}
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <NavLink
                  to="/account"
                  className="text-right text-xs hover:text-accent transition"
                >
                  <p className="font-semibold text-night-900">{user.fullName}</p>
                  <p className="text-night-400">{role?.toUpperCase()}</p>
                </NavLink>
                <SecureButton variant="ghost" className="px-4 py-2" onClick={logout}>
                  Выйти
                </SecureButton>
              </>
            ) : (
              <SecureButton variant="outline" className="px-4 py-2 text-sm" onClick={() => requireAuth()}>
                Войти
              </SecureButton>
            )}
            <NavLink
              to="/cart"
              className="relative flex items-center gap-2 rounded-full border border-night-100 px-4 py-2 text-sm font-semibold text-night-700 hover:border-night-300"
            >
              <span>Корзина</span>
              <span className="rounded-full bg-night-900 px-2 py-0.5 text-xs text-white">
                {cartCount}
              </span>
            </NavLink>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-12 bg-night-900 text-white">
        <div className="shop-container grid gap-6 py-10 md:grid-cols-3">
          <div>
            <p className="text-lg font-semibold">NeXaos</p>
            <p className="mt-2 text-sm text-night-200">
              Современная мебель и модульные кухонные решения с доставкой по России.
            </p>
          </div>
          <div className="text-sm text-night-200">
            <p>Пн-Вс: 09:00 – 21:00</p>
            <p>Поддержка: support@nexaos.io</p>
          </div>
          <div className="text-sm text-night-200">
            <p>© {new Date().getFullYear()} NeXaos. Все права защищены.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;

