import { useState } from "react";
import SecureButton from "../components/ui/SecureButton";
import OrdersTable from "../components/admin/OrdersTable";
import EntityManager from "../components/admin/EntityManager";

const tabs = [
  { id: "orders", label: "Заказы" },
  { id: "modules", label: "Модули" },
  { id: "materials", label: "Материалы" },
];

const entityConfigs = {
  modules: {
    title: "Каталог модулей",
    endpoint: "/modules",
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "Артикул" },
      { name: "final_price", label: "Цена", type: "number", required: true },
      { name: "facade_color", label: "Цвет фасада" },
      { name: "corpus_color", label: "Цвет корпуса" },
    ],
  },
  materials: {
    title: "Материалы",
    endpoint: "/materials",
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "unit_id", label: "ID единицы", type: "number" },
      { name: "price", label: "Цена", type: "number" },
    ],
  },
};

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState("orders");
  const entityConfig = entityConfigs[activeTab];

  return (
    <div className="shop-container py-12 space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-night-400">
          Панель администратора
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-night-900">Управление магазином</h1>
            <p className="text-sm text-night-500">
              Отслеживайте заказы, редактируйте каталог и контролируйте материалы.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {tabs.map((tab) => (
            <SecureButton
              key={tab.id}
              variant={tab.id === activeTab ? "primary" : "outline"}
              className="px-5 py-2 text-sm"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </SecureButton>
          ))}
        </div>
      </header>

      {activeTab === "orders" && <OrdersTable />}
      {entityConfig && <EntityManager {...entityConfig} />}
    </div>
  );
};

export default AdminPage;

