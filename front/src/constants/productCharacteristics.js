/**
 * Тип источника данных для materialSelect-полей.
 *  "sheet"            — листовой материал (sheet_materials, category != Столешница*)
 *  "sheet_pure"       — чисто листовой (без кромки, Пиломатериал, Рамки и прочих не-листовых)
 *  "sheet_countertop" — столешницы (sheet_materials, category starts with "Столешница")
 *  "linear"           — погонный материал (linear_materials)
 *  "sheet_all"        — все листовые без фильтра
 *  "hardware"         — фурнитура (hardware_items_extended)
 */
export const MATERIAL_SELECT_SOURCE_TYPES = {
  sheet: "sheet",
  sheet_pure: "sheet_pure",
  sheet_countertop: "sheet_countertop",
  linear: "linear",
  sheet_all: "sheet_all",
  hardware: "hardware",
  sheet_category: "sheet_category",
};

/** Определения полей характеристик товара. */
export const PRODUCT_CHARACTERISTIC_FIELDS = {
  product_type: { label: "Тип изделия", readOnly: true },
  material_corpus: { label: "Материал корпуса", selectType: "sheet", priceKey: "price_per_m2", categoryFilter: "Пиломатериал" },
  corpus_color: { label: "Цвет корпуса", selectType: "sheet_pure", priceKey: "price_per_m2" },
  material_facade: { label: "Материал фасада", selectType: "sheet", priceKey: "price_per_m2", categoryFilter: "Пиломатериал" },
  facade_color: { label: "Цвет фасада", selectType: "sheet", priceKey: "price_per_m2" },
  back_panel: { label: "Задняя стенка", selectType: "sheet_pure", priceKey: "price_per_m2" },
  showcase_back_panel_color: { label: "Цвет задней стенки витрины", selectType: "sheet_pure", priceKey: "price_per_m2" },
  facade_thickness_mm: { label: "Толщина фасада, мм" },
  film: { label: "Пленка", selectType: "hardware", priceKey: "price_per_m2", categoryFilter: "Пленка под фрезу" },
  milling: { label: "Фрезеровка", selectType: "hardware", priceKey: "price_per_m2", categoryFilter: "Вид фрезы" },
  film_under_milling: { label: "Пленка под фрезу", selectType: "sheet", priceKey: "price_per_m2" },
  milling_type: { label: "Вид фрезы", selectType: "sheet_all", priceKey: "price_per_m2" },
  edge_band: { label: "Кромка", selectType: "sheet", priceKey: "edge_price_per_m", categoryFilter: "Кромка" },
  glass_in_frame: { label: "Стекло в рамку" },
  glass_insert_color: { label: "Цвет стеклянной вставки", selectType: "hardware", priceKey: "price_per_m2", categoryFilter: "Стекло в рамку" },

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
  lift_mechanism: { label: "Подъёмный механизм", selectType: "hardware", priceKey: "price_per_unit", categoryFilter: "Подъемные механизмы" },
  drawers_type: { label: "Тип ящиков" },
  hinges_type: { label: "Тип петель" },
  hinges_detail: { label: "Вид и кол-во Петель", fieldType: "hinge_select", categoryFilter: "Петли" },
  shelves_type: { label: "Тип полок" },
  hangers_type: { label: "Тип навесов", selectType: "hardware", priceKey: "price_per_unit", categoryFilter: "Навесы" },
  supports_type: { label: "Тип опор" },
  opening_method: { label: "Способ открывания" },
  drawers_detail: { label: "Вид и кол-во ящиков", fieldType: "drawer_select", categoryFilter: "Выдвижные системы" },
  supports_height_mm: { label: "Высота опор, мм" },
  width_mm: { label: "Ширина, мм" },
  height_mm_char: { label: "Высота, мм" },
  depth_mm_char: { label: "Глубина, мм" },
  countertop: { label: "Столешница", selectType: "sheet_countertop", priceKey: "price_per_m2" },
  plinth: { label: "Цоколь", selectType: "hardware", priceKey: "price_per_unit", categoryFilter: "Опора" },
  cutlery_tray: { label: "Лоток для столовых приборов", selectType: "hardware", priceKey: "price_per_unit", categoryFilter: "Лоток" },
  countertop_thickness: { label: "Толщина" },
  lighting: { label: "Подсветка" },
  dish_dryer: { label: "Сушка для посуды", selectType: "hardware", priceKey: "price_per_unit", categoryFilter: "Сушка" },
  ventilation_grid: { label: "Решётка вентиляционная", selectType: "hardware", priceKey: "price_per_unit", categoryFilter: "Решётка вентиляционная" },
  countertop_color: { label: "Цвет" },
  side_posts_facade_color: { label: "Боковые стойки в цвет фасада" },
  s_corpus: { label: "S корпуса, м²" },
  p_corpus: { label: "P корпуса, м" },
  s_drawers: { label: "S ящиков, м²" },
  p_drawers: { label: "P ящиков, м" },
  s_facade: { label: "S фасада, м²" },
  p_facade: { label: "P фасада, м" },
};

export const COLOR_CHARACTERISTIC_KEYS = [];

/** Секции для отображения в редакторе характеристик (шаг 3). */
export const PRODUCT_CHARACTERISTIC_SECTIONS = [
  {
    id: "materials",
    title: "Общие параметры",
    rows: [
      ["product_type"],
      ["material_corpus"],
      ["material_facade"],
      ["back_panel"],
      ["showcase_back_panel_color"],
      ["corpus_color"],
      ["facade_color"],
      ["glass_insert_color"],
      ["facade_thickness_mm"],
      ["film"],
      ["milling"],
      ["edge_band"],
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
      ["hinges_detail"],
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
      ["countertop_color"],
      ["side_posts_facade_color"],
    ],
  },
];

/** Ключи, которые скрываются в отображении на карточке товара (но нужны для расчётов). */
export const CALCULATION_ONLY_KEYS = [
  "s_corpus",
  "p_corpus",
  "s_drawers",
  "p_drawers",
  "s_facade",
  "p_facade",
];

/** Секции редактора на шаге «Характеристики» (без цветов и без габаритов — габариты рендерятся отдельно). */
export const PRODUCT_CHARACTERISTIC_EDITOR_SECTIONS = PRODUCT_CHARACTERISTIC_SECTIONS.filter(
  (section) => section.id !== "colors" && section.id !== "dimensions"
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
