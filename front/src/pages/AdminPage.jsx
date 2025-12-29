import { useState } from "react";
import SecureButton from "../components/ui/SecureButton";
import OrdersTable from "../components/admin/OrdersTable";
import EntityManager from "../components/admin/EntityManager";
import ModuleCreator from "../components/admin/ModuleCreator";
import { FaShoppingCart, FaBox, FaBook, FaCog, FaEdit, FaTrash, FaPlus, FaChevronDown, FaChevronRight } from "react-icons/fa";

// Структура разделов админ панели
const adminSections = [
  {
    id: "orders",
    label: "Заказы",
    icon: FaShoppingCart,
    items: [
      { id: "orders", label: "Список заказов", component: "orders" },
    ],
  },
  {
    id: "materials",
    label: "Материал",
    icon: FaBox,
    items: [
      { id: "sheetMaterials", label: "Листовой материал", endpoint: "/sheet-materials" },
      { id: "materialClasses", label: "Классы материалов", endpoint: "/material-classes" },
      { id: "materials", label: "Материалы", endpoint: "/materials" },
      { id: "linearMaterials", label: "Погонный материал", endpoint: "/linear-materials" },
    ],
  },
  {
    id: "catalog",
    label: "Каталог",
    icon: FaBook,
    items: [
      { id: "kitSolutions", label: "Готовые решения", endpoint: "/kit-solutions" },
      { id: "modules", label: "Модули", endpoint: "/modules", special: "moduleCreator" },
      { id: "hardwareExtended", label: "Фурнитура", endpoint: "/hardware-extended" },
    ],
  },
  {
    id: "other",
    label: "Прочее",
    icon: FaCog,
    items: [
      { id: "calculationParameters", label: "Параметры расчета", endpoint: "/calculation-parameters" },
      { id: "materialPrices", label: "Цена материалов", endpoint: "/material-prices" },
      { id: "moduleTypes", label: "Типы модулей", endpoint: "/module-types" },
      { id: "moduleDescriptions", label: "Подтипы модулей (основа артикула)", endpoint: "/module-descriptions" },
      { id: "kitchenTypes", label: "Тип кухни", endpoint: "/kitchen-types" },
      { id: "sizeTemplates", label: "Шаблоны размеров", endpoint: "/size-templates" },
      { id: "colors", label: "Цвета", endpoint: "/colors" },
    ],
  },
];

// Полные конфигурации для EntityManager (ВСЕ БЕЗ ИЗМЕНЕНИЙ)
const entityConfigs = {
 colors: {
  title: "Цвета",
  endpoint: "/colors",
  fields: [
    { name: "name", label: "Название цвета", required: true },
    { name: "sku", label: "Артикул" },
    { name: "type", label: "Тип цвета", type: "select", options: [
      { value: "facade", label: "Фасад (основной)" },
      { value: "corpus", label: "Корпус (дополнительный)" },
      { value: "", label: "Универсальный" }
    ]},
    { name: "image_url", label: "Фотография", inputType: "image" },
    { name: "is_active", label: "Активен", type: "checkbox" },
  ],
},
  moduleTypes: {
    title: "Типы модулей",
    endpoint: "/module-types",
    fields: [
      { name: "code", label: "Код", required: true },
      { name: "name", label: "Название", required: true },
      { name: "description", label: "Описание" },
    ],
  },
  moduleDescriptions: {
    title: "Подтипы модулей (основа артикула)",
    endpoint: "/module-descriptions",
    fields: [
      { name: "base_sku", label: "Основа артикула", required: true },
      { name: "name", label: "Название", required: true },
      { name: "description", label: "Описание" },
      { name: "characteristics", label: "Характеристики (JSON)" },
    ],
  },
  sizeTemplates: {
    title: "Шаблоны размеров",
    endpoint: "/size-templates",
    fields: [
      { name: "name", label: "Название шаблона", required: true },
      { name: "sizes", label: "Размеры (JSON)", required: true },
    ],
  },
  kitchenTypes: {
    title: "Тип кухни",
    endpoint: "/kitchen-types",
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "description", label: "Описание" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  kitSolutions: {
    title: "Готовые решения",
    endpoint: "/kit-solutions",
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "Артикул" },
      { name: "description", label: "Описание" },
      { name: "kitchen_type_id", label: "Тип кухни (ID)", type: "number" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "total_length_mm", label: "Общая длина (мм)", type: "number" },
      { name: "total_depth_mm", label: "Общая глубина (мм)", type: "number" },
      { name: "total_height_mm", label: "Общая высота (мм)", type: "number" },
      { name: "countertop_length_mm", label: "Длина столешницы (мм)", type: "number" },
      { name: "countertop_depth_mm", label: "Глубина столешницы (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
    ],
  },
  sheetMaterials: {
    title: "Листовой материал",
    endpoint: "/sheet-materials",
    fields: [
      { name: "name", label: "Наименование", required: true },
      { name: "sku", label: "Артикул" },
      { name: "unit_id", label: "Ед.изм. (ID)", type: "number" },
      { name: "material_class_id", label: "Класс материала (ID)", type: "number" },
      { name: "price_per_m2", label: "Цена за м²", type: "number" },
      { name: "edge_price_per_m", label: "Цена кромки за м.п.", type: "number" },
      { name: "purpose", label: "Назначение материала" },
      { name: "hardware_color", label: "Цвет фурнитуры" },
      { name: "texture_url", label: "Текстура (картинка)", inputType: "image" },
      { name: "comment", label: "Комментарий" },
      { name: "sheet_length_mm", label: "Длина листа (мм)", type: "number" },
      { name: "sheet_width_mm", label: "Ширина листа (мм)", type: "number" },
      { name: "price_per_sheet", label: "Цена за лист", type: "number" },
      { name: "coefficient", label: "Коэф-т", type: "number" },
    ],
  },
  linearMaterials: {
    title: "Погонный материал",
    endpoint: "/linear-materials",
    fields: [
      { name: "name", label: "Наименование", required: true },
      { name: "sku", label: "Артикул" },
      { name: "unit_id", label: "Ед.изм. (ID)", type: "number" },
      { name: "material_class_id", label: "Класс материала (ID)", type: "number" },
      { name: "price_per_unit", label: "Цена за ед.", type: "number" },
      { name: "edge_price_per_m", label: "Цена кромки за м.п.", type: "number" },
      { name: "purpose", label: "Назначение материала" },
      { name: "comment", label: "Комментарий" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "width_mm", label: "Ширина (мм)", type: "number" },
      { name: "price_per_piece", label: "Цена за единицу", type: "number" },
    ],
  },
  hardwareExtended: {
    title: "Фурнитура",
    endpoint: "/hardware-extended",
    fields: [
      { name: "name", label: "Наименование", required: true },
      { name: "sku", label: "Артикул" },
      { name: "unit_id", label: "Ед.изм. (ID)", type: "number" },
      { name: "material_class_id", label: "Класс материала (ID)", type: "number" },
      { name: "price_per_unit", label: "Цена за ед.", type: "number" },
      { name: "comment", label: "Комментарий" },
      { name: "module_type_id", label: "Тип модуля (ID)", type: "number" },
      { name: "base_sku", label: "Основа артикула" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
    ],
  },
  materialClasses: {
    title: "Классы материалов",
    endpoint: "/material-classes",
    fields: [
      { name: "code", label: "Код", required: true },
      { name: "name", label: "Наименование", required: true },
    ],
  },
  calculationParameters: {
    title: "Параметры расчета",
    endpoint: "/calculation-parameters",
    fields: [
      { name: "name", label: "Наименование параметра", required: true },
      { name: "value", label: "Значение (текст)" },
      { name: "numeric_value", label: "Значение (число)", type: "number" },
      { name: "comment", label: "Комментарий" },
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
};

const AdminPage = () => {
  const [activeSection, setActiveSection] = useState("orders");
  const [activeTab, setActiveTab] = useState("orders");
  const [expandedSections, setExpandedSections] = useState({
    orders: true,
    materials: false,
    catalog: false,
    other: false,
  });

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleTabClick = (tabId, item) => {
    setActiveTab(tabId);
    setActiveSection(item?.sectionId || tabId);
  };

  const currentSection = adminSections.find((s) => s.id === activeSection);
  const currentItem = currentSection?.items.find((item) => item.id === activeTab);
  const entityConfig = entityConfigs[activeTab];
  const isModuleCreator = currentItem?.special === "moduleCreator";

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
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Боковая панель с разделами */}
        <div className="lg:col-span-1">
          <div className="glass-card p-4 space-y-2">
            {adminSections.map((section) => {
              const Icon = section.icon;
              const isExpanded = expandedSections[section.id];
              const hasActiveTab = section.items.some((item) => item.id === activeTab);

              return (
                <div key={section.id} className="space-y-1">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                      hasActiveTab
                        ? "bg-accent/10 text-accent font-semibold border border-accent/20 shadow-md"
                        : "text-night-700 hover:bg-night-50 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="text-lg" />
                      <span>{section.label}</span>
                    </div>
                    {isExpanded ? (
                      <FaChevronDown className="text-xs transition-transform rotate-180" />
                    ) : (
                      <FaChevronRight className="text-xs" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="ml-8 space-y-1 animate-in slide-in-from-left duration-300">
                      {section.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleTabClick(item.id, { sectionId: section.id })}
                          className={`w-full text-left px-4 py-2.5 rounded-xl transition-all duration-200 ${
                            activeTab === item.id
                              ? "bg-accent text-white font-semibold shadow-md scale-[1.02] translate-y-[-1px]"
                              : "text-night-600 hover:bg-night-50 hover:shadow-sm hover:translate-x-1"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Основной контент */}
        <div className="lg:col-span-3">
          {/* Заказы */}
          {activeTab === "orders" && <OrdersTable />}
          
          {/* ✅ СПЕЦИАЛЬНАЯ ЭТАПНАЯ ФОРМА ДЛЯ МОДУЛЕЙ */}
          {isModuleCreator && <ModuleCreator />}
          
          {/* ВСЕ ОСТАЛЬНЫЕ EntityManager (кроме modules) */}
          {entityConfig && !isModuleCreator && (
            <EntityManager key={entityConfig.endpoint} {...entityConfig} />
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
