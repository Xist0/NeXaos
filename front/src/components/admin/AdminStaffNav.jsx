import { NavLink, useNavigate } from "react-router-dom";
import { FaUser } from "react-icons/fa";

/** Краткая навигация в личном кабинете сотрудника (полное меню — только на /admin). */
const AdminStaffNav = () => {
  const navigate = useNavigate();

  return (
    <aside className="w-full lg:w-[240px] shrink-0 lg:sticky lg:top-24 self-start">
      <div className="glass-card border border-night-200 p-4 space-y-2 shadow-sm">
        <p className="text-xs uppercase tracking-[0.25em] text-night-400 px-2">Администрирование</p>

        <NavLink
          to="/account"
          className={({ isActive }) =>
            `w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
              isActive ? "bg-accent text-white shadow-sm" : "text-night-700 hover:bg-night-50"
            }`
          }
        >
          <FaUser className="text-lg shrink-0" />
          Личный профиль
        </NavLink>

        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold bg-night-900 text-white hover:bg-night-800 transition"
        >
          Управление магазином
        </button>
      </div>
    </aside>
  );
};

export default AdminStaffNav;
