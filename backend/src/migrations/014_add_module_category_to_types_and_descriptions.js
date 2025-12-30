/**
 * Добавляем связь с категорией (верхний/нижний) для:
 * - module_types
 * - module_descriptions
 */

const statements = [
  `ALTER TABLE module_descriptions
    ADD COLUMN IF NOT EXISTS module_category_id INT REFERENCES module_categories(id) ON DELETE SET NULL;`,

  `CREATE INDEX IF NOT EXISTS idx_module_descriptions_module_category_id ON module_descriptions(module_category_id);`,
];

const dropStatements = [
  `DROP INDEX IF EXISTS idx_module_descriptions_module_category_id;`,

  `ALTER TABLE module_descriptions DROP COLUMN IF EXISTS module_category_id;`,
];

const up = async (query) => {
  console.log("🔧 Добавляем module_category_id в module_descriptions...");
  for (const sql of statements) {
    await query(sql);
  }
  console.log("✅ module_category_id добавлен");
};

const down = async (query) => {
  console.log("🔙 Откатываем module_category_id в module_descriptions...");
  for (const sql of dropStatements) {
    await query(sql);
  }
  console.log("✅ Откат выполнен");
};

module.exports = {
  id: "014_add_module_category_to_types_and_descriptions",
  up,
  down,
};
