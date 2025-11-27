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
    <section className="glass-panel">
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Администрирование</h2>
        <SecureButton onClick={handleSync}>Синхронизация</SecureButton>
      </header>
      <div style={{ marginTop: "1.25rem" }}>
        {logs.length === 0 ? (
          <p style={{ opacity: 0.7 }}>Пока нет действий</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {logs.map((log) => (
              <li key={log.id || log.timestamp}>{JSON.stringify(log)}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default AdminPage;

