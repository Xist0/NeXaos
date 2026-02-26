import { useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import useCart from "../../hooks/useCart";
import SecureButton from "../ui/SecureButton";
import { ROLES } from "../../utils/constants";

const navLinks = [
  { label: "Главная", to: "/" },
  { label: "Каталог", to: "/catalog" },
  { label: "Наши работы", to: "/works" },
  { label: "Избранное", to: "/favorites" },
];

const MobileMenu = ({ closeMenu, user, role, requireAuth, logout, cartCount }) => (
  <div className="fixed inset-0 bg-white z-50 lg:hidden">
    <div className="flex justify-between items-center p-4 border-b border-night-100">
      <Link to="/" onClick={closeMenu} className="text-xl font-semibold text-night-900">
        NeXaos
      </Link>
      <SecureButton onClick={closeMenu} variant="ghost" className="px-2 py-1 text-2xl">&times;</SecureButton>
    </div>
    <nav className="flex flex-col p-4 space-y-2">
      {navLinks.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          onClick={closeMenu}
          className={({ isActive }) =>
            `px-4 py-3 rounded-lg text-lg transition ${isActive ? "bg-night-100 font-semibold text-night-900" : "hover:bg-night-50"}`
          }
        >
          {link.label}
        </NavLink>
      ))}
      {user ? (
        <NavLink
          to="/account"
          onClick={closeMenu}
          className={({ isActive }) =>
            `px-4 py-3 rounded-lg text-lg transition ${isActive ? "bg-night-100 font-semibold text-night-900" : "hover:bg-night-50"}`
          }
        >
          Личный профиль
        </NavLink>
      ) : (
        <button
          type="button"
          onClick={() => {
            closeMenu();
            requireAuth("/account");
          }}
          className="px-4 py-3 rounded-lg text-lg transition text-left hover:bg-night-50"
        >
          Войти
        </button>
      )}
      <NavLink
        to="/cart"
        onClick={closeMenu}
        className={({ isActive }) =>
          `px-4 py-3 rounded-lg text-lg transition ${isActive ? "bg-night-100 font-semibold text-night-900" : "hover:bg-night-50"}`
        }
      >
        Корзина{cartCount > 0 ? ` (${cartCount})` : ""}
      </NavLink>
      {(role === ROLES.ADMIN || role === ROLES.MANAGER) && (
        <NavLink to="/admin" onClick={closeMenu} className="px-4 py-3 rounded-lg text-lg transition text-accent-dark font-semibold hover:bg-accent/10">
          Админ
        </NavLink>
      )}
      {user && (
        <button
          type="button"
          onClick={() => {
            closeMenu();
            logout();
          }}
          className="px-4 py-3 rounded-lg text-lg transition text-left text-night-700 hover:bg-night-50"
        >
          Выйти
        </button>
      )}
    </nav>
  </div>
);

const AppLayout = () => {
  const { user, role, logout, requireAuth } = useAuth();
  const { items } = useCart();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="shop-shell bg-night-50/50">
      <div className="bg-night-900 text-white text-[11px] sm:text-xs">
        <div className="shop-container flex flex-col sm:flex-row items-center justify-between gap-x-4 gap-y-1 py-2 text-center">
          <p>Сервис и доставка мебели по всей России</p>
          <p className="opacity-80">8 (800) 555-35-35 — ежедневно 09:00–21:00</p>
        </div>
      </div>

      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-night-100/80">
        <div className="shop-container flex h-16 sm:h-20 items-center justify-between gap-4">
          <Link to="/" className="text-xl sm:text-2xl font-semibold text-night-900">
            NeXaos
          </Link>
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-night-500">
            {navLinks.map((link) => (
              <NavLink key={link.to} to={link.to} className={({ isActive }) => `transition hover:text-accent ${isActive ? "text-night-900 font-semibold" : ""}`}>
                {link.label}
              </NavLink>
            ))}
            {(role === ROLES.ADMIN || role === ROLES.MANAGER) && <NavLink to="/admin" className="text-accent-dark font-semibold">Админ</NavLink>}
          </nav>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-3">
              {user ? (
                <>
                  <NavLink to="/account" className="text-right text-xs hover:text-accent transition">
                    <p className="font-semibold text-night-900 truncate max-w-[100px]">{user.fullName}</p>
                    <p className="text-night-400">{role?.toUpperCase()}</p>
                  </NavLink>
                  <SecureButton variant="ghost" className="px-3 sm:px-4 py-2 text-xs sm:text-sm" onClick={logout}>Выйти</SecureButton>
                </>
              ) : (
                <SecureButton variant="outline" className="px-3 sm:px-4 py-2 text-xs sm:text-sm" onClick={() => requireAuth()}>Войти</SecureButton>
              )}
            </div>

            <NavLink to="/cart" className="relative flex items-center gap-2 rounded-full border border-night-100 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-night-700 hover:border-night-300 hover:bg-night-50 transition-colors">
              <span className="hidden sm:inline">Корзина</span>
              <span className="sm:hidden">🛒</span>
              {cartCount > 0 && <span className="absolute -top-1 -right-1 flex justify-center items-center w-5 h-5 rounded-full bg-accent text-white text-xs font-bold">{cartCount}</span>}
            </NavLink>

            <button onClick={() => setMenuOpen(true)} className="lg:hidden p-2 rounded-md hover:bg-night-100 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
            </button>
          </div>
        </div>
      </header>
      
      {isMenuOpen && (
        <MobileMenu
          closeMenu={closeMenu}
          user={user}
          role={role}
          requireAuth={requireAuth}
          logout={logout}
          cartCount={cartCount}
        />
      )}

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-12 bg-white border-t border-night-100">
        <div className="shop-container grid gap-8 py-10 grid-cols-1 md:grid-cols-3 text-center md:text-left">
          <div>
            <p className="text-lg font-semibold">NeXaos</p>
            <p className="mt-2 text-sm text-night-500">
              Современная мебель и модульные кухонные решения с доставкой по России.
            </p>
          </div>
          <div className="text-sm text-night-500">
            <p>Пн-Вс: 09:00 – 21:00</p>
            <p>Поддержка: support@nexaos.io</p>
          </div>
          <div className="text-sm text-night-500">
            <p>© {new Date().getFullYear()} NeXaos. Все права защищены.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
