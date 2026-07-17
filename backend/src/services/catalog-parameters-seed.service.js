const asyncHandler = require("../utils/async-handler");
const { query } = require("../config/db");

const CATALOG_STRUCTURE = [
  {
    name: "Общие параметры",
    parameters: [
      { name: "Тип изделия", field_key: "product_type", sort: 1 },
      { name: "Материал корпуса", field_key: "material_corpus", sort: 2 },
      { name: "Материал фасада", field_key: "material_facade", sort: 3 },
      { name: "Задняя стенка", field_key: "back_panel", sort: 4 },
      { name: "Толщина фасада", field_key: "facade_thickness_mm", sort: 5 },
      { name: "Пленка", field_key: "film", sort: 6 },
      { name: "Фрезеровка", field_key: "milling", sort: 7 },
    ],
  },
  {
    name: "Основные характеристики",
    parameters: [
      { name: "Назначение модуля", field_key: "module_purpose", sort: 1 },
      { name: "Кол-во распашных фасадов", field_key: "front_count", sort: 2 },
      { name: "Кол-во подъёмных механизмов", field_key: "lift_mechanism_count", sort: 3 },
      { name: "Кол-во ящиков (всего)", field_key: "drawer_count", sort: 4 },
      { name: "Кол-во петель (всего)", field_key: "hinges_count", sort: 5 },
      { name: "Кол-во полок", field_key: "shelf_count", sort: 6 },
      { name: "Кол-во навесов", field_key: "hangers_count", sort: 7 },
      { name: "Кол-во опор", field_key: "supports_count", sort: 8 },
      { name: "Ниша для техники", field_key: "tech_niche", sort: 9 },
      { name: "Тип открывания", field_key: "opening_type", sort: 10 },
      { name: "Подъёмный механизм", field_key: "lift_mechanism", sort: 11 },
      { name: "Тип ящиков", field_key: "drawers_type", sort: 12 },
      { name: "Тип петель", field_key: "hinges_type", sort: 13 },
      { name: "Тип полок", field_key: "shelves_type", sort: 14 },
      { name: "Способ открывания", field_key: "opening_method", sort: 17 },
      { name: "Вид и кол-во ящиков", field_key: "drawers_detail", sort: 18 },
      { name: "Вид и кол-во Петель", field_key: "hinges_detail", sort: 19 },
      { name: "Высота опор, мм", field_key: "supports_height_mm", sort: 20 },
    ],
  },
  {
    name: "Дополнительная информация",
    parameters: [
      { name: "Столешница", field_key: "countertop", sort: 1 },
      { name: "Цоколь", field_key: "plinth", sort: 2 },
      { name: "Лоток для столовых приборов", field_key: "cutlery_tray", sort: 3 },
      { name: "Толщина", field_key: "countertop_thickness", sort: 4 },
      { name: "Подсветка", field_key: "lighting", sort: 5 },
      { name: "Сушка для посуды", field_key: "dish_dryer", sort: 6 },
      { name: "Цвет", field_key: "countertop_color", sort: 7 },
      { name: "Боковые стойки в цвет фасада", field_key: "side_posts_facade_color", sort: 8 },
    ],
  },
];

const DEFAULT_CALC_PARAMS = [
  { name: "Коэф. общий", numeric_value: 2.2 },
  { name: "На плитный", numeric_value: 1.2 },
  { name: "На кромку", numeric_value: 1.15 },
];

const seedCatalogParameters = async () => {
  let categories = 0;
  let parameters = 0;

  for (const section of CATALOG_STRUCTURE) {
    const { rows: catRows } = await query(
      `INSERT INTO product_parameter_categories (name)
       VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [section.name]
    );
    const categoryId = catRows[0]?.id;
    if (!categoryId) continue;
    categories += 1;

    for (const param of section.parameters) {
      await query(
        `INSERT INTO product_parameters (name, category_id, field_key, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (name) DO UPDATE SET
           category_id = EXCLUDED.category_id,
           field_key = COALESCE(NULLIF(product_parameters.field_key, ''), EXCLUDED.field_key),
           sort_order = EXCLUDED.sort_order`,
        [param.name, categoryId, param.field_key, param.sort]
      );
      parameters += 1;
    }
  }

  for (const cp of DEFAULT_CALC_PARAMS) {
    await query(
      `INSERT INTO calculation_parameters (name, numeric_value)
       VALUES ($1, $2)
       ON CONFLICT (name) DO NOTHING`,
      [cp.name, cp.numeric_value]
    );
  }

  return { categories, parameters };
};

const seedCatalogParametersHandler = asyncHandler(async (_req, res) => {
  const result = await seedCatalogParameters();
  res.status(200).json({ data: result });
});

module.exports = {
  seedCatalogParameters,
  seedCatalogParametersHandler,
};
