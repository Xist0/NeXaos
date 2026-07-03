import {
  COLOR_CHARACTERISTIC_KEYS,
  PRODUCT_CHARACTERISTIC_FIELDS,
} from "./productCharacteristics";

/** Фиксированная раскладка формы создания позиции каталога (3 колонки). */
export const CATALOG_ITEM_FORM_SECTIONS = [
  {
    id: "materials",
    title: "Материалы",
    columns: [
      ["material_corpus", "corpus_color", "material_facade", "facade_color", "back_panel", "showcase_back_panel_color", "film", "milling"],
      ["edge_band", "plinth", "cutlery_tray", "ventilation_grid", "dish_dryer"],
    ],
  },
  {
    id: "other_materials",
    title: "Прочие материалы",
    columns: [
      ["supports_type"],
      ["hangers_type"],
      ["lift_mechanism", "drawers_detail", "hinges_detail"],
    ],
  },
  {
    id: "main",
    title: "Основные характеристики",
    columns: [
      [
        "product_type",
        "module_purpose",
        "facade_thickness_mm",
        "front_count",
        "lift_mechanism_count",
        "drawer_count",
        "hinges_count",
        "shelf_count",
        "hangers_count",
        "supports_count",
      ],
      [
        "tech_niche",
        "opening_type",
        "drawers_type",
        "hinges_type",
        "shelves_type",
        "opening_method",
      ],
      ["supports_height_mm"],
    ],
  },
  {
    id: "dimensions",
    title: "Габариты",
    columns: [["width_mm"], ["height_mm_char"], ["depth_mm_char"]],
  },
  {
    id: "extra",
    title: "Дополнительная информация",
    columns: [
      ["lighting"],
      ["glass_insert_color", "countertop_thickness", "countertop_color"],
      ["side_posts_facade_color"],
    ],
  },
];

export const DRAWERS_DETAIL_FIELD_KEY = "drawers_detail";

export const HARDWARE_TABLE_ROWS = [
  { key: "cross_brace", label: "Меж-я стяжка" },
  { key: "dowel_8x30", label: "Шкант 8х30" },
  { key: "euro_screw_7x50", label: "евровинт 7х50" },
  { key: "screw_3_5x16", label: "Саморез 3,5х16" },
  { key: "screw_3_5x19", label: "Саморез 3,5х19" },
  { key: "screw_4x60", label: "Саморез 4x60" },
  { key: "flipper", label: "FLIPPER" },
  { key: "eccentric", label: "Эксцентрик" },
  { key: "brace_d20", label: "Стяжка D20" },
];

export const HARDWARE_TABLE_COLUMNS = [
  { key: "drawer", label: "Ящик" },
  { key: "hinge", label: "Петля" },
  { key: "support", label: "Опора" },
  { key: "shelf", label: "Полка" },
  { key: "bottom", label: "Дно" },
  { key: "post", label: "Стойка" },
  { key: "rail", label: "Царга" },
  { key: "lid", label: "Крышка" },
  { key: "price", label: "Цена" },
];

export const resolveFieldLabel = (fieldKey, fieldLabels = {}) => {
  const def = PRODUCT_CHARACTERISTIC_FIELDS[fieldKey];
  return fieldLabels[fieldKey] || def?.label || fieldKey;
};

export const isColorField = (fieldKey) => COLOR_CHARACTERISTIC_KEYS.includes(fieldKey);
