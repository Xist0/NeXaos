/** Определения полей характеристик товара. */
export const PRODUCT_CHARACTERISTIC_FIELDS = {
  product_type: { label: "Тип изделия" },
  material_corpus: { label: "Материал корпуса" },
  corpus_color: { label: "Цвет корпуса" },
  material_facade: { label: "Материал фасада" },
  facade_color: { label: "Цвет фасада" },
  facade_thickness_mm: { label: "Толщина фасада" },
  back_panel: { label: "Задняя стенка" },
  glass_insert_color: { label: "Цвет стеклянной вставки" },
  milling: { label: "Фрезеровка" },
  module_purpose: { label: "Назначение модуля" },
  tech_niche: { label: "Ниша для техники" },
  front_count: { label: "Кол-во фасадов" },
  opening_type: { label: "Тип открывания" },
  opening_method: { label: "Способ открывания" },
  lift_mechanism_count: { label: "Кол-во подъёмных механизмов" },
  lift_mechanism: { label: "Подъёмный механизм" },
  drawer_count: { label: "Кол-во ящиков (всего)" },
  drawers_type: { label: "Тип ящиков" },
  drawers_detail: { label: "Вид и кол-во ящиков" },
  hinges_count: { label: "Кол-во петель (всего)" },
  hinges_type: { label: "Тип петель" },
  shelf_count: { label: "Кол-во полок" },
  shelves_type: { label: "Тип полок" },
  hangers_count: { label: "Кол-во навесов" },
  hangers_type: { label: "Тип навесов" },
  supports_count: { label: "Кол-во опор" },
  supports_type: { label: "Тип опор" },
  supports_height_mm: { label: "Высота опор, мм" },
  width_mm: { label: "Ширина, мм" },
  height_mm_char: { label: "Высота, мм" },
  depth_mm_char: { label: "Глубина, мм" },
  countertop: { label: "Столешница" },
  countertop_thickness: { label: "Толщина" },
  countertop_color: { label: "Цвет" },
  plinth: { label: "Цоколь" },
  lighting: { label: "Подсветка" },
  side_posts_facade_color: { label: "Боковые стойки в цвет фасада" },
  cutlery_tray: { label: "Лоток для столовых приборов" },
  dish_dryer: { label: "Сушка для посуды" },
};

/** Секции и строки полей (как в таблице ТЗ — несколько значений в одной строке). */
export const PRODUCT_CHARACTERISTIC_SECTIONS = [
  {
    id: "general",
    title: "Общие параметры",
    rows: [
      ["product_type"],
      ["material_corpus", "corpus_color"],
      ["material_facade", "facade_color", "facade_thickness_mm"],
      ["back_panel", "glass_insert_color", "milling"],
    ],
  },
  {
    id: "main",
    title: "Основные характеристики",
    rows: [
      ["module_purpose", "tech_niche"],
      ["front_count", "opening_type", "opening_method"],
      ["lift_mechanism_count", "lift_mechanism"],
      ["drawer_count", "drawers_type", "drawers_detail"],
      ["hinges_count", "hinges_type"],
      ["shelf_count", "shelves_type"],
      ["hangers_count", "hangers_type"],
      ["supports_count", "supports_type", "supports_height_mm"],
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
      ["countertop", "countertop_thickness", "countertop_color"],
      ["plinth", "lighting", "side_posts_facade_color"],
      ["cutlery_tray", "dish_dryer"],
    ],
  },
];

export const ALL_CHARACTERISTIC_KEYS = Object.keys(PRODUCT_CHARACTERISTIC_FIELDS);

const STEP1_FIELD_KEYS = new Set(["product_type"]);
const COLOR_MATERIAL_FIELD_KEYS = new Set([
  "material_corpus",
  "corpus_color",
  "material_facade",
  "facade_color",
  "facade_thickness_mm",
]);

/** Секции для редактора на шаге «Характеристики» (без габаритов и полей шага 1 / цветов). */
export const PRODUCT_CHARACTERISTIC_EDITOR_SECTIONS = PRODUCT_CHARACTERISTIC_SECTIONS.map((section) => {
  if (section.id === "dimensions") return null;
  if (section.id === "general") {
    return {
      ...section,
      rows: section.rows
        .map((row) => row.filter((key) => !STEP1_FIELD_KEYS.has(key) && !COLOR_MATERIAL_FIELD_KEYS.has(key)))
        .filter((row) => row.length > 0),
    };
  }
  return section;
}).filter(Boolean);
