/**
 * Миграция для:
 * - шаблонов размеров (size_templates)
 * - цен по типу модуля (module_type_prices)
 */

const statements = [
  `CREATE TABLE IF NOT EXISTS size_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sizes JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,

  `CREATE TABLE IF NOT EXISTS module_type_prices (
    id SERIAL PRIMARY KEY,
    module_type_id INT NOT NULL REFERENCES module_types(id) ON DELETE CASCADE,
    price NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (module_type_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_module_type_prices_module_type_id ON module_type_prices(module_type_id);`,
];

const dropStatements = [
  `DROP INDEX IF EXISTS idx_module_type_prices_module_type_id;`,
  `DROP TABLE IF EXISTS module_type_prices CASCADE;`,
  `DROP TABLE IF EXISTS size_templates CASCADE;`,
];

const up = async (query) => {
  console.log("🔧 Создаем таблицы шаблонов размеров и цен по типам модулей...");
  for (const sql of statements) {
    await query(sql);
  }
  console.log("✅ Таблицы шаблонов размеров и цен по типам модулей созданы");
};

const down = async (query) => {
  console.log("🔙 Откатываем таблицы шаблонов размеров и цен по типам модулей...");
  for (const sql of dropStatements) {
    await query(sql);
  }
  console.log("✅ Откат выполнен");
};

module.exports = {
  id: "011_create_size_templates_and_module_type_prices",
  up,
  down,
};
