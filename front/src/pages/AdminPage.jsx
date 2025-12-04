import { useState } from "react";
import SecureButton from "../components/ui/SecureButton";
import OrdersTable from "../components/admin/OrdersTable";
import EntityManager from "../components/admin/EntityManager";

const tabs = [
  { id: "orders", label: "Заказы" },
  { id: "modules", label: "Модули" },
  { id: "materials", label: "Материалы" },
  { id: "hardware", label: "Фурнитура" },
  { id: "materialPrices", label: "Цены материалов" },
  { id: "hiddenSpecs", label: "Скрытые параметры" },
];

const entityConfigs = {
  modules: {
    title: "Каталог модулей",
    endpoint: "/modules",
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "Артикул" },
      {
        name: "preview_url",
        label: "Изображение (превью)",
        inputType: "image",
      },
      { name: "final_price", label: "Цена", type: "number", required: true },
      { name: "facade_color", label: "Цвет фасада" },
      { name: "corpus_color", label: "Цвет корпуса" },
      { name: "shelf_count", label: "Полок", type: "number" },
      { name: "front_count", label: "Фасадов", type: "number" },
      { name: "supports_count", label: "Опор", type: "number" },
      { name: "hinges_count", label: "Петель", type: "number" },
      { name: "clips_count", label: "Клипс", type: "number" },
    ],
  },
  materials: {
    title: "Материалы",
    endpoint: "/materials",
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "Артикул" },
      { name: "unit_id", label: "ID единицы", type: "number" },
      {
        name: "preview_url",
        label: "Изображение материала",
        inputType: "image",
      },
      { name: "comment", label: "Комментарий" },
      { name: "length_mm", label: "Длина, мм", type: "number" },
      { name: "width_mm", label: "Ширина, мм", type: "number" },
    ],
  },
  hardware: {
    title: "Фурнитура",
    endpoint: "/hardware-items",
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "Артикул" },
      { name: "unit_id", label: "ID единицы", type: "number" },
      { name: "price", label: "Цена", type: "number" },
    ],
  },
  materialPrices: {
    title: "Цены материалов",
    endpoint: "/material-prices",
    fields: [
      { name: "material_id", label: "ID материала", type: "number", required: true },
      { name: "price", label: "Цена", type: "number", required: true },
      { name: "price_per_sheet", label: "Цена за лист", type: "number" },
      { name: "coeff", label: "Коэффициент", type: "number" },
      { name: "unit_id", label: "ID единицы", type: "number" },
    ],
  },
  hiddenSpecs: {
    title: "Скрытые параметры модулей",
    endpoint: "/module-specs",
    fields: [
      { name: "module_id", label: "ID модуля", type: "number", required: true },
      {
        name: "key",
        label: "Название параметра (например, Полка, Фасад и т.д.)",
        required: true,
      },
      { name: "value", label: "Текстовое значение" },
      { name: "value_num", label: "Числовое значение", type: "number" },
      { name: "unit_id", label: "ID единицы", type: "number" },
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

