/** Определения полей характеристик товара. */
export const PRODUCT_CHARACTERISTIC_FIELDS = {
  product_type: { label: "Тип изделия" },
  material_corpus: { label: "Материал корпуса" },
  material_facade: { label: "Материал фасада" },
  back_panel: { label: "Задняя стенка" },
  facade_thickness_mm: { label: "Толщина фасада" },
  film: { label: "Пленка" },
  milling: { label: "Фрезеровка" },
  film_under_milling: { label: "Пленка под фрезу" },
  milling_type: { label: "Вид фрезы" },
  frame: { label: "Рамка" },
  glass_in_frame: { label: "Стекло в рамку" },
  showcase_back_panel_color: { label: "Цвет задней стенки витрины", colorRole: "all" },
  corpus_color: { label: "Цвет корпуса", colorRole: "corpus" },
  facade_color: { label: "Цвет фасада", colorRole: "facade" },
  glass_insert_color: { label: "Цвет стеклянной вставки", colorRole: "all" },
  module_purpose: { label: "Назначение модуля" },
  front_count: { label: "Кол-во распашных фасадов" },
  lift_mechanism_count: { label: "Кол-во подъёмных механизмов" },
  drawer_count: { label: "Кол-во ящиков (всего)" },
  hinges_count: { label: "Кол-во петель (всего)" },
  shelf_count: { label: "Кол-во полок" },
  hangers_count: { label: "Кол-во навесов" },
  supports_count: { label: "Кол-во опор" },
  tech_niche: { label: "Ниша для техники" },
  opening_type: { label: "Тип открывания" },
  lift_mechanism: { label: "Подъёмный механизм" },
  drawers_type: { label: "Тип ящиков" },
  hinges_type: { label: "Тип петель" },
  shelves_type: { label: "Тип полок" },
  hangers_type: { label: "Тип навесов" },
  supports_type: { label: "Тип опор" },
  opening_method: { label: "Способ открывания" },
  drawers_detail: { label: "Вид и кол-во ящиков" },
  supports_height_mm: { label: "Высота опор, мм" },
  width_mm: { label: "Ширина, мм" },
  height_mm_char: { label: "Высота, мм" },
  depth_mm_char: { label: "Глубина, мм" },
  countertop: { label: "Столешница" },
  plinth: { label: "Цоколь" },
  cutlery_tray: { label: "Лоток для столовых приборов" },
  countertop_thickness: { label: "Толщина" },
  lighting: { label: "Подсветка" },
  dish_dryer: { label: "Сушка для посуды" },
  countertop_color: { label: "Цвет" },
  side_posts_facade_color: { label: "Боковые стойки в цвет фасада" },
};

export const COLOR_CHARACTERISTIC_KEYS = [
  "showcase_back_panel_color",
  "corpus_color",
  "facade_color",
  "glass_insert_color",
];

/** Полная структура для отображения на странице товара. */
export const PRODUCT_CHARACTERISTIC_SECTIONS = [
  {
    id: "general",
    title: "Общие параметры",
    rows: [
      ["product_type"],
      ["material_corpus"],
      ["material_facade"],
      ["back_panel"],
      ["facade_thickness_mm"],
      ["film"],
      ["milling"],
      ["film_under_milling"],
      ["milling_type"],
      ["frame"],
      ["glass_in_frame"],
    ],
  },
  {
    id: "main",
    title: "Основные характеристики",
    rows: [
      ["module_purpose"],
      ["front_count"],
      ["lift_mechanism_count"],
      ["drawer_count"],
      ["hinges_count"],
      ["shelf_count"],
      ["hangers_count"],
      ["supports_count"],
      ["tech_niche"],
      ["opening_type"],
      ["lift_mechanism"],
      ["drawers_type"],
      ["hinges_type"],
      ["shelves_type"],
      ["hangers_type"],
      ["supports_type"],
      ["opening_method"],
      ["drawers_detail"],
      ["supports_height_mm"],
    ],
  },
  {
    id: "dimensions",
    title: "Габариты",
    rows: [["width_mm"], ["height_mm_char"], ["depth_mm_char"]],
  },
  {
    id: "extra",
    title: "Дополнительная информация",
    rows: [
      ["countertop"],
      ["plinth"],
      ["cutlery_tray"],
      ["countertop_thickness"],
      ["lighting"],
      ["dish_dryer"],
    ],
  },
];

/** Секции редактора на шаге «Характеристики» (без габаритов и цветов). */
export const PRODUCT_CHARACTERISTIC_EDITOR_SECTIONS = PRODUCT_CHARACTERISTIC_SECTIONS.filter(
  (section) => section.id !== "dimensions" && section.id !== "colors"
);

/** Секция «Габариты» для 4-й вкладки. */
export const PRODUCT_CHARACTERISTIC_DIMENSIONS_SECTION = PRODUCT_CHARACTERISTIC_SECTIONS.find(
  (section) => section.id === "dimensions"
);

export const ALL_CHARACTERISTIC_KEYS = Object.keys(PRODUCT_CHARACTERISTIC_FIELDS);

export const resolveColorId = (colors, storedValue) => {
  const value = String(storedValue ?? "").trim();
  if (!value || !Array.isArray(colors)) return "";

  const byId = colors.find((c) => String(c.id) === value);
  if (byId) return String(byId.id);

  const match = colors.find((c) => {
    const candidates = [c.name, c.sku, c.code].map((part) => String(part ?? "").trim()).filter(Boolean);
    return candidates.includes(value);
  });

  return match?.id != null ? String(match.id) : "";
};

export const colorDisplayValue = (color) => {
  if (!color) return "";
  return String(color.name || color.sku || color.code || "").trim();
};
