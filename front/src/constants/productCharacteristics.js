/**
 * Тип источника данных для materialSelect-полей.
 *  "sheet"            — листовой материал (sheet_materials, category != Столешница*)
 *  "sheet_countertop" — столешницы (sheet_materials, category starts with "Столешница")
 *  "linear"           — погонный материал (linear_materials)
 *  "sheet_all"        — все листовые без фильтра
 *  "hardware"         — фурнитура (hardware_items_extended)
 */
export const MATERIAL_SELECT_SOURCE_TYPES = {
  sheet: "sheet",
  sheet_countertop: "sheet_countertop",
  linear: "linear",
  sheet_all: "sheet_all",
  hardware: "hardware",
};

/** Определения полей характеристик товара. */
export const PRODUCT_CHARACTERISTIC_FIELDS = {
  product_type: { label: "Тип изделия", readOnly: true },
  material_corpus: { label: "Материал корпуса", selectType: "sheet", priceKey: "price_per_m2" },
  material_facade: { label: "Материал фасада", selectType: "sheet", priceKey: "price_per_m2" },
  back_panel: { label: "Задняя стенка", selectType: "sheet", priceKey: "price_per_m2" },
  facade_thickness_mm: { label: "Толщина фасада" },
  film: { label: "Пленка", selectType: "hardware", priceKey: "price_per_m2", categoryFilter: "Пленка под фрезу" },
  milling: { label: "Фрезеровка", selectType: "hardware", priceKey: "price_per_m2", categoryFilter: "Вид фрезы" },
  film_under_milling: { label: "Пленка под фрезу", selectType: "sheet", priceKey: "price_per_m2" },
  milling_type: { label: "Вид фрезы", selectType: "sheet_all", priceKey: "price_per_m2" },
  frame: { label: "Рамка" },
  glass_in_frame: { label: "Стекло в рамку" },
  showcase_back_panel_color: { label: "Цвет задней стенки витрины", colorRole: "all" },
  corpus_color: { label: "Основной цвет (корпус)", colorRole: "corpus" },
  facade_color: { label: "Доп. цвет (фасад)", colorRole: "facade" },
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
  lift_mechanism: { label: "Подъёмный механизм", selectType: "hardware", priceKey: "price_per_unit", categoryFilter: "Подъемные механизмы" },
  drawers_type: { label: "Тип ящиков" },
  hinges_type: { label: "Тип петель", selectType: "hardware", priceKey: "price_per_unit", categoryFilter: "Петли" },
  shelves_type: { label: "Тип полок" },
  hangers_type: { label: "Тип навесов", selectType: "hardware", priceKey: "price_per_unit", categoryFilter: "Навесы" },
  supports_type: { label: "Тип опор", selectType: "hardware", priceKey: "price_per_unit", categoryFilter: "Опора" },
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

export const COLOR_CHARACTERISTIC_KEYS = [
  "showcase_back_panel_color",
  "corpus_color",
  "facade_color",
  "glass_insert_color",
];

/** Поляная структура для отображения на странице товара. в редакторе. */
export const PRODUCT_CHARACTERISTIC_SECTIONS = [
  {
    id: "materials",
    title: "Материалы",
    rows: [
      ["product_type"],
      ["material_corpus"],
      ["material_facade"],
      ["back_panel"],
      // ["countertop"],        // дубль — берётся с вкладки Материалы
      // ["countertop_thickness"], // дубль — берётся с вкладки Материалы
      // ["countertop_color"],  // дубль — берётся с вкладки Материалы
      ["plinth"],
      ["cutlery_tray"],
      ["ventilation_grid"],
      ["dish_dryer"],
    ],
  },
  {
    id: "other_materials",
    title: "Прочие материалы",
    rows: [
      ["supports_type"],
      ["hangers_type"],
      ["lift_mechanism"],
      ["drawers_detail"],
    ],
  },
  // Общие параметры — убраны дубли (film, milling, film_under_milling, milling_type, frame, glass_in_frame)
  // оставлена только Толщина фасада — перенесена в секцию Основные характеристики
  // {
  //   id: "general",
  //   title: "Общие параметры",
  //   rows: [
  //     ["facade_thickness_mm"],
  //     // ["film"],                // дубль — берётся с вкладки Материалы
  //     // ["milling"],             // дубль — берётся с вкладки Материалы
  //     // ["film_under_milling"],  // дубль — берётся с вкладки Материалы
  //     // ["milling_type"],        // дубль — берётся с вкладки Материалы
  //     // ["frame"],               // дубль — берётся с вкладки Материалы
  //     // ["glass_in_frame"],      // дубль — берётся с вкладки Материалы
  //   ],
  // },
  {
    id: "main",
    title: "Основные характеристики",
    rows: [
      ["facade_thickness_mm"], // перенесено из Общие параметры
      // ["module_purpose"],      // дубль — берётся с вкладки Материалы
      ["front_count"],
      ["lift_mechanism_count"],
      ["drawer_count"],
      ["hinges_count"],
      ["shelf_count"],
      ["hangers_count"],
      ["supports_count"],
      ["tech_niche"],
      ["opening_type"],
      ["drawers_type"],
      ["hinges_type"],
      ["shelves_type"],
      ["opening_method"],
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
      ["lighting"],
      ["side_posts_facade_color"],
      // Столешницы убраны — берётся с вкладки Материалы (админ → Материал → Столешницы)
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
