import { useEffect, useState } from "react";
import useApi from "../hooks/useApi";
import SecureInput from "../components/ui/SecureInput";

const MaterialsPage = () => {
  const { get } = useApi();
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    const fetchMaterials = async () => {
      const response = await get("/materials", search ? { q: search } : undefined);
      if (active) {
        setMaterials(response.data || []);
      }
    };
    fetchMaterials();
    return () => {
      active = false;
    };
  }, [get, search]);

  return (
    <section className="glass-panel">
      <header style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
        <h2 style={{ margin: 0 }}>Материалы</h2>
        <SecureInput
          value={search}
          onChange={setSearch}
          placeholder="Поиск по названию..."
        />
      </header>
      <div style={{ marginTop: "1.25rem" }}>
        {materials.length === 0 ? (
          <p style={{ opacity: 0.7 }}>Нет данных</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {materials.map((item) => (
              <li
                key={item.id}
                style={{
                  padding: "0.85rem 0",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <strong>{item.name}</strong>
                <div style={{ fontSize: "0.9rem", opacity: 0.7 }}>
                  SKU: {item.sku || "не задан"} | Ед.: {item.unit_id || "-"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default MaterialsPage;

