/**
 * Добавляем сокращение (префикс для основы артикула) в module_categories
 */

const statements = [
  `ALTER TABLE module_categories ADD COLUMN IF NOT EXISTS sku_prefix TEXT;`,

  `UPDATE module_categories
   SET sku_prefix = CASE
     WHEN code = 'bottom' THEN 'НМ'
     WHEN code = 'top' THEN 'ВМ'
     WHEN name ILIKE '%ниж%' THEN 'НМ'
     WHEN name ILIKE '%верх%' THEN 'ВМ'
     ELSE sku_prefix
   END
   WHERE sku_prefix IS NULL;`,
];

const dropStatements = [
  `ALTER TABLE module_categories DROP COLUMN IF EXISTS sku_prefix;`,
];

const up = async (query) => {
  console.log("🔧 Добавляем sku_prefix в module_categories...");
  for (const sql of statements) {
    await query(sql);
  }
  console.log("✅ sku_prefix добавлен");
};

const down = async (query) => {
  console.log("🔙 Откатываем sku_prefix из module_categories...");
  for (const sql of dropStatements) {
    await query(sql);
  }
  console.log("✅ Откат выполнен");
};

module.exports = {
  id: "016_add_sku_prefix_to_module_categories",
  up,
  down,
};
