/**
 * Миграция: переименование категории "Полиматериал" → "Пиломатериал"
 * в таблицах sheet_materials и hardware_items_extended.
 */

const statements = [
  `UPDATE sheet_materials SET category = 'Пиломатериал' WHERE category = 'Полиматериал';`,
  `UPDATE hardware_items_extended SET category = 'Пиломатериал' WHERE category = 'Полиматериал';`,
];

const up = async (query) => {
  console.log("🔧 Переименование категории 'Полиматериал' → 'Пиломатериал'...");

  for (const sql of statements) {
    await query(sql);
  }

  console.log("✅ Категория 'Полиматериал' переименована в 'Пиломатериал'");
};

const down = async (query) => {
  console.log("↩️ Откат: 'Пиломатериал' → 'Полиматериал'...");

  await query(`UPDATE sheet_materials SET category = 'Полиматериал' WHERE category = 'Пиломатериал';`);
  await query(`UPDATE hardware_items_extended SET category = 'Полиматериал' WHERE category = 'Пиломатериал';`);

  console.log("✅ Откат выполнен");
};

module.exports = {
  id: "042_rename_polimaterial_to_pilomaterial",
  up,
  down,
};
