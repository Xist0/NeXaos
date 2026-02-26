import { useEffect, useMemo, useState } from "react";
import useApi from "../../hooks/useApi";

const actionLabel = (action) => {
  const a = String(action || "").toLowerCase();
  if (a === "create") return "Создание";
  if (a === "update") return "Изменение";
  if (a === "delete") return "Удаление";
  return action || "—";
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const StaffAuditLogs = () => {
  const { get } = useApi();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const resp = await get("/audit-logs");
        if (!mounted) return;
        setItems(Array.isArray(resp?.data) ? resp.data : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Не удалось загрузить лог действий");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [get]);

  const rows = useMemo(() => {
    return items
      .slice()
      .sort((a, b) => {
        const ta = new Date(a?.created_at || a?.createdAt || 0).getTime();
        const tb = new Date(b?.created_at || b?.createdAt || 0).getTime();
        return tb - ta;
      });
  }, [items]);

  return (
    <section className="glass-card p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-night-900">Лог действий</h2>
          <p className="text-sm text-night-500">CRUD-действия сотрудников с датой и временем.</p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full table-fixed text-left text-sm">
          <thead>
            <tr className="text-night-400">
              <th className="py-3 pr-4 w-36">Дата</th>
              <th className="py-3 pr-4 w-56">Сотрудник</th>
              <th className="py-3 pr-4">Действие</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const dt = r?.created_at || r?.createdAt;
              const dateLabel = formatDateTime(dt);
              const userName = r?.user_full_name || r?.userFullName || "—";
              const userRole = r?.user_role_name || r?.userRoleName;
              const who = userRole ? `${userName} (${userRole === "admin" ? "Администратор" : userRole === "manager" ? "Менеджер" : userRole})` : userName;

              const action = actionLabel(r?.action);

              return (
                <tr key={r.id} className="border-t border-night-100 text-night-900">
                  <td className="py-3 pr-4 whitespace-nowrap text-xs">{dateLabel}</td>
                  <td className="py-3 pr-4 break-words">{who}</td>
                  <td className="py-3 pr-4">
                    <div className="font-semibold">{action}</div>
                  </td>
                </tr>
              );
            })}

            {!rows.length && !loading && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-night-400">
                  Нет записей
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-night-400">
                  Загрузка…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default StaffAuditLogs;
