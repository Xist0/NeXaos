import { useEffect, useState } from "react";
import useApi from "../hooks/useApi";

const DashboardPage = () => {
  const { get } = useApi();
  const [snapshot, setSnapshot] = useState({ modules: 0, materials: 0 });

  useEffect(() => {
    let mounted = true;
    const fetchSnapshot = async () => {
      try {
        const [modules, materials] = await Promise.all([
          get("/modules", { limit: 1 }),
          get("/materials", { limit: 1 }),
        ]);
        if (mounted) {
          setSnapshot({
            modules: modules.data?.length ?? 0,
            materials: materials.data?.length ?? 0,
          });
        }
      } catch (error) {
        // ошибки уже залогированы useApi
      }
    };

    fetchSnapshot();
    return () => {
      mounted = false;
    };
  }, [get]);

  return (
    <section className="grid two">
      <article className="glass-panel">
        <h3>Модули</h3>
        <p>Активных модулей: {snapshot.modules}</p>
      </article>
      <article className="glass-panel">
        <h3>Материалы</h3>
        <p>Всего материалов: {snapshot.materials}</p>
      </article>
    </section>
  );
};

export default DashboardPage;

