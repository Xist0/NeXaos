import { useState } from "react";
import SecureButton from "../components/ui/SecureButton";
import OrdersTable from "../components/admin/OrdersTable";
import EntityManager from "../components/admin/EntityManager";
import ModulesAdmin from "../components/admin/ModulesAdmin";
import KitSolutionsAdmin from "../components/admin/KitSolutionsAdmin";
import ModuleDescriptionsAdmin from "../components/admin/ModuleDescriptionsAdmin";
import CatalogItemsAdmin from "../components/admin/CatalogItemsAdmin";
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
      { id: "kitSolutions", label: "Готовые решения", endpoint: "/kit-solutions", special: "kitSolutionCreator" },
      { id: "modules", label: "Модули", endpoint: "/modules", special: "moduleCreator" },
      { id: "catalogHallwayReady", label: "Прихожая — Готовые прихожие", endpoint: "/catalog-items" },
      { id: "catalogHallwayWardrobes", label: "Прихожая — Шкафы", endpoint: "/catalog-items" },
      { id: "catalogHallwayShoeracks", label: "Прихожая — Обувницы", endpoint: "/catalog-items" },
      { id: "catalogHallwayDressers", label: "Прихожая — Комоды", endpoint: "/catalog-items" },
      { id: "catalogHallwayWallCabinets", label: "Прихожая — Тумбы подвесные", endpoint: "/catalog-items" },
      { id: "catalogHallwaySlats", label: "Прихожая — Рейки", endpoint: "/catalog-items" },
      { id: "catalogHallwayTopCabinets", label: "Прихожая — Верхние шкафы", endpoint: "/catalog-items" },
      { id: "catalogHallwayAccessories", label: "Прихожая — Аксессуары", endpoint: "/catalog-items" },
      { id: "catalogHallwayFillers", label: "Прихожая — Доборные элементы", endpoint: "/catalog-items" },

      { id: "catalogLivingroomWalls", label: "Гостиная — Стенки", endpoint: "/catalog-items" },
      { id: "catalogLivingroomTvZones", label: "Гостиная — ТВ зоны", endpoint: "/catalog-items" },
      { id: "catalogLivingroomWardrobes", label: "Гостиная — Шкафы", endpoint: "/catalog-items" },
      { id: "catalogLivingroomShelving", label: "Гостиная — Стеллажи", endpoint: "/catalog-items" },
      { id: "catalogLivingroomDressers", label: "Гостиная — Комоды", endpoint: "/catalog-items" },
      { id: "catalogLivingroomWallShelves", label: "Гостиная — Настенные полки", endpoint: "/catalog-items" },
      { id: "catalogLivingroomCoffeeTables", label: "Гостиная — Журнальные столики", endpoint: "/catalog-items" },

      { id: "kitchenModulesBottom", label: "Кухня — Модули — Нижние", component: "kitchenModulesBottom" },
      { id: "kitchenModulesTop", label: "Кухня — Модули — Верхние", component: "kitchenModulesTop" },
      { id: "kitchenModulesMezzanine", label: "Кухня — Модули — Антресольные", component: "kitchenModulesMezzanine" },
      { id: "kitchenModulesTall", label: "Кухня — Модули — Пеналы", component: "kitchenModulesTall" },
      { id: "catalogKitchenCountertops", label: "Кухня — Столешницы", endpoint: "/catalog-items" },
      { id: "catalogKitchenFillers", label: "Кухня — Доборные элементы", endpoint: "/catalog-items" },
      { id: "catalogKitchenAccessories", label: "Кухня — Аксессуары", endpoint: "/catalog-items" },

      { id: "catalogBedroomSets", label: "Спальня — Комплект мебели", endpoint: "/catalog-items" },
      { id: "catalogBedroomBeds", label: "Спальня — Кровати", endpoint: "/catalog-items" },
      { id: "catalogBedroomDressingTables", label: "Спальня — Туалетные столики", endpoint: "/catalog-items" },
      { id: "catalogBedroomBedside", label: "Спальня — Прикроватные тумбы", endpoint: "/catalog-items" },
    ],
  },
  {
    id: "content",
    label: "Контент",
    icon: FaEdit,
    items: [
      { id: "heroSlides", label: "Hero-слайды", endpoint: "/hero-slides" },
      { id: "works", label: "Наши работы", endpoint: "/works" },
    ],
  },
  {
    id: "other",
    label: "Прочее",
    icon: FaCog,
    items: [
      { id: "calculationParameters", label: "Параметры расчета", endpoint: "/calculation-parameters" },
      { id: "materialPrices", label: "Цена материалов", endpoint: "/material-prices" },
      { id: "collections", label: "Коллекции", endpoint: "/collections" },
      { id: "moduleCategories", label: "Типы модулей", endpoint: "/module-categories" },
      { id: "moduleDescriptions", label: "Подтипы модулей", endpoint: "/module-descriptions", special: "moduleDescriptionCreator" },
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
      { name: "is_active", label: "Активен", type: "checkbox" },
      { name: "image_url", label: "Фотография", inputType: "image" },
    ],
  },
  collections: {
    title: "Коллекции",
    endpoint: "/collections",
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "Артикул" },
      { name: "image_url", label: "Изображение", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },

  catalogHallwayReady: {
    title: "Каталог — Прихожая — Готовые прихожие",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Прихожая", category: "Готовые прихожие" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogHallwayWardrobes: {
    title: "Каталог — Прихожая — Шкафы",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Прихожая", category: "Шкафы" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogHallwayShoeracks: {
    title: "Каталог — Прихожая — Обувницы",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Прихожая", category: "Обувницы" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogHallwayDressers: {
    title: "Каталог — Прихожая — Комоды",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Прихожая", category: "Комоды" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogHallwayWallCabinets: {
    title: "Каталог — Прихожая — Тумбы подвесные",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Прихожая", category: "Тумбы подвесные" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogHallwaySlats: {
    title: "Каталог — Прихожая — Рейки",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Прихожая", category: "Рейки" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogHallwayTopCabinets: {
    title: "Каталог — Прихожая — Верхние шкафы",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Прихожая", category: "Верхние шкафы" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogHallwayAccessories: {
    title: "Каталог — Прихожая — Аксессуары",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Прихожая", category: "Аксессуары для прихожей" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogHallwayFillers: {
    title: "Каталог — Прихожая — Доборные элементы",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Прихожая", category: "Доборные элементы" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },

  catalogLivingroomWalls: {
    title: "Каталог — Гостиная — Стенки",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Гостиная", category: "Стенки для гостиной" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogLivingroomTvZones: {
    title: "Каталог — Гостиная — ТВ зоны",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Гостиная", category: "ТВ зоны" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogLivingroomWardrobes: {
    title: "Каталог — Гостиная — Шкафы",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Гостиная", category: "Шкафы" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogLivingroomShelving: {
    title: "Каталог — Гостиная — Стеллажи",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Гостиная", category: "Стеллажи" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogLivingroomDressers: {
    title: "Каталог — Гостиная — Комоды",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Гостиная", category: "Комоды" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogLivingroomWallShelves: {
    title: "Каталог — Гостиная — Настенные полки",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Гостиная", category: "Настенные полки" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogLivingroomCoffeeTables: {
    title: "Каталог — Гостиная — Журнальные столики",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Гостиная", category: "Журнальные столики" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },

  catalogKitchenReady: {
    title: "Каталог — Кухня — Готовые кухни",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Кухня", category: "Готовые кухни" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogKitchenCountertops: {
    title: "Каталог — Кухня — Столешницы",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Кухня", category: "Столешницы" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogKitchenFillers: {
    title: "Каталог — Кухня — Доборные элементы",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Кухня", category: "Доборные элементы" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogKitchenAccessories: {
    title: "Каталог — Кухня — Аксессуары",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Кухня", category: "Аксессуары для кухни" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },

  catalogBedroomSets: {
    title: "Каталог — Спальня — Комплект мебели",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Спальня", category: "Комплект мебели для спальни" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogBedroomBeds: {
    title: "Каталог — Спальня — Кровати",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Спальня", category: "Кровати" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogBedroomDressingTables: {
    title: "Каталог — Спальня — Туалетные столики",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Спальня", category: "Туалетные столики" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogBedroomBedside: {
    title: "Каталог — Спальня — Прикроватные тумбы",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Спальня", category: "Прикроватные тумбы" },
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogHallway: {
    title: "Каталог — Прихожая",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Прихожая" },
    fields: [
      { name: "category_group", label: "Группа", required: true },
      { name: "category", label: "Категория" },
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogLivingroom: {
    title: "Каталог — Гостиная",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Гостиная" },
    fields: [
      { name: "category_group", label: "Группа", required: true },
      { name: "category", label: "Категория" },
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogKitchen: {
    title: "Каталог — Кухня",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Кухня" },
    fields: [
      { name: "category_group", label: "Группа", required: true },
      { name: "category", label: "Категория" },
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  catalogBedroom: {
    title: "Каталог — Спальня",
    endpoint: "/catalog-items",
    fixedValues: { category_group: "Спальня" },
    fields: [
      { name: "category_group", label: "Группа", required: true },
      { name: "category", label: "Категория" },
      { name: "name", label: "Название", required: true },
      { name: "sku", label: "SKU" },
      { name: "description", label: "Описание" },
      { name: "collection_id", label: "Коллекция", type: "collection" },
      { name: "primary_color_id", label: "Основной цвет", type: "color" },
      { name: "secondary_color_id", label: "Дополнительный цвет", type: "color" },
      { name: "length_mm", label: "Длина (мм)", type: "number" },
      { name: "depth_mm", label: "Глубина (мм)", type: "number" },
      { name: "height_mm", label: "Высота (мм)", type: "number" },
      { name: "base_price", label: "Базовая цена", type: "number" },
      { name: "final_price", label: "Итоговая цена", type: "number" },
      { name: "preview_url", label: "Превью", inputType: "image" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  moduleCategories: {
    title: "Типы модулей",
    endpoint: "/module-categories",
    fields: [
      { name: "name", label: "Название", required: true },
      { name: "sku_prefix", label: "Сокращение", required: true },
    ],
  },
  moduleDescriptions: {
    title: "Подтипы модулей",
    endpoint: "/module-descriptions",
    fields: [
      { name: "base_sku", label: "Основа артикула", required: true },
      { name: "name", label: "Название", required: true },
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
  heroSlides: {
    title: "Hero-слайды",
    endpoint: "/hero-slides",
    fields: [
      { name: "title", label: "Заголовок", required: true },
      { name: "description", label: "Описание" },
      { name: "publish_at", label: "Дата публикации", type: "date" },
      { name: "is_active", label: "Активен", type: "checkbox" },
    ],
  },
  works: {
    title: "Наши работы",
    endpoint: "/works",
    fields: [
      { name: "title", label: "Заголовок", required: true },
      { name: "description", label: "Описание" },
      { name: "publish_at", label: "Дата публикации", type: "date" },
      { name: "is_active", label: "Активен", type: "checkbox" },
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
    content: false,
    other: false,
  });
  const [expandedCatalogGroups, setExpandedCatalogGroups] = useState({
    hallway: false,
    livingroom: false,
    kitchen: false,
    kitchenModules: false,
    bedroom: false,
  });

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => {
      const nextValue = !prev[sectionId];
      const next = Object.fromEntries(Object.keys(prev).map((k) => [k, false]));
      next[sectionId] = nextValue;
      return next;
    });
  };

  const toggleCatalogGroup = (groupId) => {
    setExpandedCatalogGroups((prev) => {
      // Вложенная группа кухни ("Модули") не должна закрывать саму "Кухню"
      if (groupId === "kitchenModules") {
        return {
          ...prev,
          kitchenModules: !prev.kitchenModules,
        };
      }

      const nextValue = !prev[groupId];
      const next = Object.fromEntries(Object.keys(prev).map((k) => [k, false]));
      next[groupId] = nextValue;
      // если закрыли кухню — закрываем и вложенные "Модули"
      if (groupId !== "kitchen") {
        next.kitchenModules = false;
      }
      return next;
    });
  };

  const handleTabClick = (tabId, item) => {
    setActiveTab(tabId);
    setActiveSection(item?.sectionId || tabId);
  };

  const currentSection = adminSections.find((s) => s.id === activeSection);
  const currentItem = currentSection?.items.find((item) => item.id === activeTab);
  const entityConfig = entityConfigs[activeTab];
  const isCatalogItemsTab = Boolean(entityConfig?.endpoint === "/catalog-items");
  const isModuleCreator = currentItem?.special === "moduleCreator";
  const isKitSolutionCreator = currentItem?.special === "kitSolutionCreator";
  const isModuleDescriptionCreator = currentItem?.special === "moduleDescriptionCreator";
  const isKitchenModuleTab = [
    "kitchenModulesBottom",
    "kitchenModulesTop",
    "kitchenModulesMezzanine",
    "kitchenModulesTall",
  ].includes(activeTab);

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
                      {section.id === "catalog" ? (
                        <div className="space-y-1">
                          <button
                            onClick={() => toggleCatalogGroup("hallway")}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 ${
                              expandedCatalogGroups.hallway ? "bg-night-50 text-night-800" : "text-night-600 hover:bg-night-50"
                            }`}
                          >
                            <span>Прихожая</span>
                            {expandedCatalogGroups.hallway ? (
                              <FaChevronDown className="text-[10px] transition-transform rotate-180" />
                            ) : (
                              <FaChevronRight className="text-[10px]" />
                            )}
                          </button>
                          {expandedCatalogGroups.hallway && (
                            <div className="ml-4 space-y-1">
                              {[
                                { id: "hallwayReadySolutions", label: "Готовые прихожие" },
                                { id: "catalogHallwayWardrobes", label: "Шкафы" },
                                { id: "catalogHallwayShoeracks", label: "Обувницы" },
                                { id: "catalogHallwayDressers", label: "Комоды" },
                                { id: "catalogHallwayWallCabinets", label: "Тумбы подвесные" },
                                { id: "catalogHallwaySlats", label: "Рейки" },
                                { id: "catalogHallwayTopCabinets", label: "Верхние шкафы" },
                                { id: "catalogHallwayAccessories", label: "Аксессуары для прихожей" },
                                { id: "catalogHallwayFillers", label: "Доборные элементы" },
                              ].map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => handleTabClick(item.id, { sectionId: section.id })}
                                  className={`w-full text-left px-4 py-2.5 rounded-xl transition-all duration-200 ${
                                    activeTab === item.id
                                      ? "bg-accent text-white font-semibold shadow-md"
                                      : "text-night-600 hover:bg-night-50 hover:shadow-sm"
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          )}

                          <button
                            onClick={() => toggleCatalogGroup("livingroom")}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 ${
                              expandedCatalogGroups.livingroom ? "bg-night-50 text-night-800" : "text-night-600 hover:bg-night-50"
                            }`}
                          >
                            <span>Гостиная</span>
                            {expandedCatalogGroups.livingroom ? (
                              <FaChevronDown className="text-[10px] transition-transform rotate-180" />
                            ) : (
                              <FaChevronRight className="text-[10px]" />
                            )}
                          </button>
                          {expandedCatalogGroups.livingroom && (
                            <div className="ml-4 space-y-1">
                              {[
                                { id: "livingroomReadySolutions", label: "Стенки для гостиной" },
                                { id: "catalogLivingroomTvZones", label: "ТВ зоны" },
                                { id: "catalogLivingroomWardrobes", label: "Шкафы" },
                                { id: "catalogLivingroomShelving", label: "Стеллажи" },
                                { id: "catalogLivingroomDressers", label: "Комоды" },
                                { id: "catalogLivingroomWallShelves", label: "Настенные полки" },
                                { id: "catalogLivingroomCoffeeTables", label: "Журнальные столики" },
                              ].map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => handleTabClick(item.id, { sectionId: section.id })}
                                  className={`w-full text-left px-4 py-2.5 rounded-xl transition-all duration-200 ${
                                    activeTab === item.id
                                      ? "bg-accent text-white font-semibold shadow-md"
                                      : "text-night-600 hover:bg-night-50 hover:shadow-sm"
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          )}

                          <button
                            onClick={() => toggleCatalogGroup("kitchen")}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 ${
                              expandedCatalogGroups.kitchen ? "bg-night-50 text-night-800" : "text-night-600 hover:bg-night-50"
                            }`}
                          >
                            <span>Кухня</span>
                            {expandedCatalogGroups.kitchen ? (
                              <FaChevronDown className="text-[10px] transition-transform rotate-180" />
                            ) : (
                              <FaChevronRight className="text-[10px]" />
                            )}
                          </button>
                          {expandedCatalogGroups.kitchen && (
                            <div className="ml-4 space-y-1">
                              <button
                                onClick={() => handleTabClick("kitSolutions", { sectionId: section.id })}
                                className={`w-full text-left px-4 py-2.5 rounded-xl transition-all duration-200 ${
                                  activeTab === "kitSolutions"
                                    ? "bg-accent text-white font-semibold shadow-md"
                                    : "text-night-600 hover:bg-night-50 hover:shadow-sm"
                                }`}
                              >
                                Готовые решения
                              </button>

                              <button
                                onClick={() => toggleCatalogGroup("kitchenModules")}
                                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 ${
                                  expandedCatalogGroups.kitchenModules ? "bg-night-50 text-night-800" : "text-night-600 hover:bg-night-50"
                                }`}
                              >
                                <span>Модули</span>
                                {expandedCatalogGroups.kitchenModules ? (
                                  <FaChevronDown className="text-[10px] transition-transform rotate-180" />
                                ) : (
                                  <FaChevronRight className="text-[10px]" />
                                )}
                              </button>
                              {expandedCatalogGroups.kitchenModules && (
                                <div className="ml-4 space-y-1">
                                  {[
                                    { id: "kitchenModulesBottom", label: "Нижние модули" },
                                    { id: "kitchenModulesTop", label: "Верхние модули" },
                                    { id: "kitchenModulesMezzanine", label: "Антресольные модули" },
                                    { id: "kitchenModulesTall", label: "Пеналы" },
                                  ].map((item) => (
                                    <button
                                      key={item.id}
                                      onClick={() => handleTabClick(item.id, { sectionId: section.id })}
                                      className={`w-full text-left px-4 py-2.5 rounded-xl transition-all duration-200 ${
                                        activeTab === item.id
                                          ? "bg-accent text-white font-semibold shadow-md"
                                          : "text-night-600 hover:bg-night-50 hover:shadow-sm"
                                      }`}
                                    >
                                      {item.label}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {[
                                { id: "catalogKitchenCountertops", label: "Столешницы" },
                                { id: "catalogKitchenFillers", label: "Доборные элементы" },
                                { id: "catalogKitchenAccessories", label: "Аксессуары для кухни" },
                              ].map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => handleTabClick(item.id, { sectionId: section.id })}
                                  className={`w-full text-left px-4 py-2.5 rounded-xl transition-all duration-200 ${
                                    activeTab === item.id
                                      ? "bg-accent text-white font-semibold shadow-md"
                                      : "text-night-600 hover:bg-night-50 hover:shadow-sm"
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          )}

                          <button
                            onClick={() => toggleCatalogGroup("bedroom")}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 ${
                              expandedCatalogGroups.bedroom ? "bg-night-50 text-night-800" : "text-night-600 hover:bg-night-50"
                            }`}
                          >
                            <span>Спальня</span>
                            {expandedCatalogGroups.bedroom ? (
                              <FaChevronDown className="text-[10px] transition-transform rotate-180" />
                            ) : (
                              <FaChevronRight className="text-[10px]" />
                            )}
                          </button>
                          {expandedCatalogGroups.bedroom && (
                            <div className="ml-4 space-y-1">
                              {[
                                { id: "bedroomReadySolutions", label: "Комплект мебели для спальни" },
                                { id: "catalogBedroomBeds", label: "Кровати" },
                                { id: "catalogBedroomDressingTables", label: "Туалетные столики" },
                                { id: "catalogBedroomBedside", label: "Прикроватные тумбы" },
                              ].map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => handleTabClick(item.id, { sectionId: section.id })}
                                  className={`w-full text-left px-4 py-2.5 rounded-xl transition-all duration-200 ${
                                    activeTab === item.id
                                      ? "bg-accent text-white font-semibold shadow-md"
                                      : "text-night-600 hover:bg-night-50 hover:shadow-sm"
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        section.items.map((item) => (
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
                        ))
                      )}
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

          {activeTab === "kitchenModulesBottom" && (
            <ModulesAdmin title="Кухня — Модули — Нижние" fixedModuleCategoryId={1} />
          )}
          {activeTab === "kitchenModulesTop" && (
            <ModulesAdmin title="Кухня — Модули — Верхние" fixedModuleCategoryId={2} />
          )}
          {activeTab === "kitchenModulesMezzanine" && (
            <ModulesAdmin title="Кухня — Модули — Антресольные" fixedModuleCategoryId={2} />
          )}
          {activeTab === "kitchenModulesTall" && (
            <ModulesAdmin title="Кухня — Модули — Пеналы" fixedModuleCategoryId={3} />
          )}
          
          {activeTab === "hallwayReadySolutions" && (
            <KitSolutionsAdmin
              title="Прихожая — Готовые прихожие"
              fixedValues={{ category_group: "Прихожая", category: "Готовые прихожие" }}
            />
          )}
          {activeTab === "livingroomReadySolutions" && (
            <KitSolutionsAdmin
              title="Гостиная — Стенки для гостиной"
              fixedValues={{ category_group: "Гостиная", category: "Стенки для гостиной" }}
            />
          )}
          {activeTab === "bedroomReadySolutions" && (
            <KitSolutionsAdmin
              title="Спальня — Комплект мебели для спальни"
              fixedValues={{ category_group: "Спальня", category: "Комплект мебели для спальни" }}
            />
          )}

          {/* ✅ СПЕЦИАЛЬНАЯ ЭТАПНАЯ ФОРМА ДЛЯ МОДУЛЕЙ */}
          {isModuleCreator && <ModulesAdmin />}

          {/* ✅ СПЕЦИАЛЬНАЯ ЭТАПНАЯ ФОРМА ДЛЯ ГОТОВЫХ РЕШЕНИЙ */}
          {isKitSolutionCreator && <KitSolutionsAdmin />}

          {/* ✅ СПЕЦИАЛЬНАЯ ЭТАПНАЯ ФОРМА ДЛЯ ПОДТИПОВ МОДУЛЕЙ */}
          {isModuleDescriptionCreator && <ModuleDescriptionsAdmin />}
          
          {/* ВСЕ ОСТАЛЬНЫЕ EntityManager (кроме modules) */}
          {entityConfig && !isKitchenModuleTab && !isModuleCreator && !isKitSolutionCreator && !isModuleDescriptionCreator && (
            isCatalogItemsTab ? (
              <CatalogItemsAdmin title={entityConfig.title} fixedValues={entityConfig.fixedValues} />
            ) : (
              <EntityManager key={entityConfig.endpoint} {...entityConfig} />
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
