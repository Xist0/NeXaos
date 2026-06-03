import { useEffect, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { FaHeart, FaSearch } from "react-icons/fa";
import useAuth from "../../hooks/useAuth";
import useCart from "../../hooks/useCart";
import useApi from "../../hooks/useApi";
import SecureButton from "../ui/SecureButton";
import SocialIcon from "./SocialIcon";
import { ROLES } from "../../utils/constants";

const defaultNavLinks = [
  { label: "Главная", to: "/" },
  { label: "Каталог", to: "/catalog" },
  { label: "Наши работы", to: "/works" },
  { label: "Избранное", to: "/favorites" },
];

const MobileMenu = ({ closeMenu, user, role, requireAuth, logout, cartCount, headerNav, socialLinks, logoText }) => (
  <div className="fixed inset-0 bg-white z-50 lg:hidden">
    <div className="flex justify-between items-center p-4 border-b border-night-100">
      <Link to="/" onClick={closeMenu} className="text-xl font-semibold text-night-900">
        {logoText}
      </Link>
      <SecureButton onClick={closeMenu} variant="ghost" className="px-2 py-1 text-2xl">&times;</SecureButton>
    </div>
    <nav className="flex flex-col p-4 space-y-2">
      {defaultNavLinks.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          onClick={closeMenu}
          className={({ isActive }) =>
            `px-4 py-3 rounded-lg text-lg transition flex items-center gap-2 ${isActive ? "bg-night-100 font-semibold text-night-900" : "hover:bg-night-50"}`
          }
        >
          {link.to === "/favorites" ? <FaHeart className="w-5 h-5 text-accent" /> : null}
          {link.label}
        </NavLink>
      ))}
      {headerNav.map((link) => (
        <a
          key={`${link.label}-${link.url}`}
          href={link.url}
          onClick={closeMenu}
          className="px-4 py-3 rounded-lg text-lg transition hover:bg-night-50"
        >
          {link.label}
        </a>
      ))}
      {socialLinks.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-2">
          {socialLinks.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-night-200 text-night-700"
              title={item.label}
            >
              <SocialIcon icon={item.icon} />
            </a>
          ))}
        </div>
      )}
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
  const { get } = useApi();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [siteHeader, setSiteHeader] = useState({
    logoText: "NeXaos",
    navLinks: [],
    socialLinks: [],
  });
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    let active = true;
    get("/public/site-settings")
      .then((res) => {
        if (!active) return;
        const header = res?.data?.header;
        if (!header || typeof header !== "object") return;
        setSiteHeader({
          logoText: header.logoText || "NeXaos",
          navLinks: Array.isArray(header.navLinks) ? header.navLinks : [],
          socialLinks: Array.isArray(header.socialLinks) ? header.socialLinks : [],
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [get]);

  const closeMenu = () => setMenuOpen(false);
  const centerNav = siteHeader.navLinks.filter((l) => l?.label && l?.url);
  const centerNavExtra = centerNav.filter((link) => String(link.url || "").trim() !== "/catalog");
  const socialLinks = [...siteHeader.socialLinks].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div className="shop-shell bg-night-50/50">
      <div className="bg-night-900 text-white text-[11px] sm:text-xs">
        <div className="shop-container flex flex-col sm:flex-row items-center justify-between gap-x-4 gap-y-1 py-2 text-center">
          <p>Сервис и доставка мебели по всей России</p>
          <p className="opacity-80">8 (800) 555-35-35 — ежедневно 09:00–21:00</p>
        </div>
      </div>

      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-lg border-b border-night-100">
        <div className="shop-container flex h-16 sm:h-[4.5rem] items-center gap-4">
          <Link to="/" className="text-xl sm:text-2xl font-bold text-night-900 tracking-tight shrink-0">
            {siteHeader.logoText}
          </Link>

          <nav className="hidden lg:flex flex-1 items-center justify-center gap-8 text-sm font-medium text-night-600">
            <NavLink
              to="/catalog"
              className={({ isActive }) =>
                `transition hover:text-accent ${isActive ? "text-night-900 font-semibold" : ""}`
              }
            >
              Каталог
            </NavLink>
            {centerNavExtra.map((link) => {
              const isInternal = String(link.url).startsWith("/");
              if (isInternal) {
                return (
                  <NavLink
                    key={`${link.label}-${link.url}`}
                    to={link.url}
                    className={({ isActive }) =>
                      `transition hover:text-accent ${isActive ? "text-night-900 font-semibold" : ""}`
                    }
                  >
                    {link.label}
                  </NavLink>
                );
              }
              return (
                <a
                  key={`${link.label}-${link.url}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-accent"
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2 ml-auto shrink-0">
            <NavLink
              to="/catalog"
              className="hidden sm:inline-flex items-center justify-center w-10 h-10 rounded-lg text-night-600 hover:bg-night-50 transition"
              title="Поиск / каталог"
            >
              <FaSearch className="w-5 h-5" />
            </NavLink>

            <div className="hidden sm:flex items-center gap-1">
              {socialLinks.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-night-700 hover:bg-night-50 border border-transparent hover:border-night-100 transition"
                  title={item.label || item.url}
                >
                  <SocialIcon icon={item.icon} />
                </a>
              ))}
            </div>

            <NavLink
              to="/favorites"
              className="hidden sm:inline-flex items-center justify-center w-10 h-10 rounded-lg text-night-600 hover:bg-night-50 hover:text-accent transition"
              title="Избранное"
            >
              <FaHeart className="w-5 h-5" />
            </NavLink>

            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <>
                  {(role === ROLES.ADMIN || role === ROLES.MANAGER) && (
                    <NavLink
                      to="/admin"
                      className={({ isActive }) =>
                        `px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          isActive ? "bg-accent text-white" : "text-accent-dark hover:bg-accent/10"
                        }`
                      }
                    >
                      Админ
                    </NavLink>
                  )}
                  <NavLink
                    to="/account"
                    className="block text-right text-xs hover:text-accent transition max-w-[140px] px-1 py-1 rounded-lg hover:bg-night-50"
                  >
                    <p className="font-semibold text-night-900 truncate">{user.fullName}</p>
                  </NavLink>
                  <SecureButton variant="ghost" className="px-2 py-1.5 text-xs" onClick={logout}>
                    Выйти
                  </SecureButton>
                </>
              ) : (
                <SecureButton variant="outline" className="px-3 py-1.5 text-xs" onClick={() => requireAuth()}>
                  Войти
                </SecureButton>
              )}
            </div>

            <NavLink
              to="/cart"
              className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg border border-night-100 text-night-700 hover:bg-night-50 transition"
              title="Корзина"
            >
              <span className="text-lg">🛒</span>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 flex justify-center items-center min-w-[1.25rem] h-5 px-1 rounded-full bg-accent text-white text-[10px] font-bold">
                  {cartCount}
                </span>
              )}
            </NavLink>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="lg:hidden p-2 rounded-md hover:bg-night-100 transition-colors"
              aria-label="Меню"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="lg:hidden border-t border-night-100 px-4 py-2 flex gap-4 overflow-x-auto text-sm text-night-600">
          <NavLink to="/catalog" className="whitespace-nowrap hover:text-accent font-medium">
            Каталог
          </NavLink>
          {centerNavExtra.map((link) => {
            const isInternal = String(link.url).startsWith("/");
            if (isInternal) {
              return (
                <NavLink key={`m-${link.label}`} to={link.url} className="whitespace-nowrap hover:text-accent">
                  {link.label}
                </NavLink>
              );
            }
            return (
              <a key={`m-${link.label}`} href={link.url} className="whitespace-nowrap hover:text-accent">
                {link.label}
              </a>
            );
          })}
        </nav>
      </header>

      {isMenuOpen && (
        <MobileMenu
          closeMenu={closeMenu}
          user={user}
          role={role}
          requireAuth={requireAuth}
          logout={logout}
          cartCount={cartCount}
          headerNav={centerNav}
          socialLinks={socialLinks}
          logoText={siteHeader.logoText}
        />
      )}

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-12 bg-white border-t border-night-100">
        <div className="shop-container grid gap-8 py-10 grid-cols-1 md:grid-cols-3 text-center md:text-left">
          <div>
            <p className="text-lg font-semibold">{siteHeader.logoText}</p>
            <p className="mt-2 text-sm text-night-500">
              Современная мебель и модульные кухонные решения с доставкой по России.
            </p>
          </div>
          <div className="text-sm text-night-500">
            <p>Пн-Вс: 09:00 – 21:00</p>
            <p>Поддержка: support@nexaos.io</p>
          </div>
          <div className="text-sm text-night-500">
            <p>© {new Date().getFullYear()} {siteHeader.logoText}. Все права защищены.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
