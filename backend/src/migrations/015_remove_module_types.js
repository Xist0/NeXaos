/**
 * Удаляем устаревшую структуру module_types:
 * - module_type_prices
 * - modules.module_type_id (+ индекс)
 * - module_types
 */

const statements = [
  // сначала зависимая таблица
  `DROP TABLE IF EXISTS module_type_prices CASCADE;`,

  // таблица расширенной фурнитуры тоже ссылается на module_types
  `ALTER TABLE hardware_items_extended DROP COLUMN IF EXISTS module_type_id;`,

  // убираем индекс и колонку из modules
  `DROP INDEX IF EXISTS idx_modules_module_type_id;`,
  `ALTER TABLE modules DROP COLUMN IF EXISTS module_type_id;`,

  // удаляем таблицу типов
  `DROP TABLE IF EXISTS module_types CASCADE;`,
];

const up = async (query) => {
  console.log("🧹 Удаляем module_types / module_type_prices / modules.module_type_id ...");
  for (const sql of statements) {
    await query(sql);
  }
  console.log("✅ module_types удалены");
};

// Down не восстанавливаем (слишком много данных/связей)
const down = async () => {
  console.log("↩️ down для 015_remove_module_types не реализован");
};

module.exports = {
  id: "015_remove_module_types",
  up,
  down,
};
