import { useState } from "react";
import useApi from "../hooks/useApi";
import SecureButton from "../components/ui/SecureButton";

const AdminPage = () => {
  const { post } = useApi();
  const [logs, setLogs] = useState([]);

  const handleSync = async () => {
    const payload = { timestamp: new Date().toISOString(), action: "sync" };
    const response = await post("/admin/run-sync", payload);
    setLogs((prev) => [response, ...prev].slice(0, 10));
  };

  return (
    <div className="shop-container py-12">
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-night-400">
            Панель администратора
          </p>
          <h1 className="text-3xl font-semibold text-night-900">Синхронизация данных</h1>
        </div>
        <div className="glass-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-night-500">
              Обновите справочники модулей, материалов и цен, чтобы синхронизировать каталог.
            </p>
            <SecureButton onClick={handleSync}>Запустить синхронизацию</SecureButton>
          </div>
        </div>
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-night-900">Последние действия</h2>
          {logs.length === 0 ? (
            <p className="mt-4 text-sm text-night-500">Пока нет действий</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm text-night-600">
              {logs.map((log) => (
                <li
                  key={log.id || log.timestamp}
                  className="rounded-xl border border-night-100 bg-night-50/60 px-4 py-3"
                >
                  {JSON.stringify(log)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;

