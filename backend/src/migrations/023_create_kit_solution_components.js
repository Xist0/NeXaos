/**
 * Миграция: универсальные компоненты для готовых решений
 * Позволяет хранить в составе как modules, так и catalog_items.
 */

const statements = [
  `CREATE TABLE IF NOT EXISTS kit_solution_components (
    id SERIAL PRIMARY KEY,
    kit_solution_id INT NOT NULL REFERENCES kit_solutions(id) ON DELETE CASCADE,
    component_type TEXT NOT NULL, -- 'module' | 'catalogItem'
    module_id INT REFERENCES modules(id) ON DELETE CASCADE,
    catalog_item_id INT REFERENCES catalog_items(id) ON DELETE CASCADE,
    position_order INT DEFAULT 0,
    position_type TEXT,
    position_uid TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,

  // Если таблица уже была создана ранее с position_uid UUID, приводим к TEXT
  `ALTER TABLE kit_solution_components
    ALTER COLUMN position_uid TYPE TEXT
    USING position_uid::text;`,

  `CREATE INDEX IF NOT EXISTS idx_kit_solution_components_kit ON kit_solution_components(kit_solution_id);`,
  `CREATE INDEX IF NOT EXISTS idx_kit_solution_components_module ON kit_solution_components(module_id);`,
  `CREATE INDEX IF NOT EXISTS idx_kit_solution_components_catalog_item ON kit_solution_components(catalog_item_id);`,
  `CREATE INDEX IF NOT EXISTS idx_kit_solution_components_position_uid ON kit_solution_components(position_uid);`,

  // Бэкоффис: перенос существующих модулей в универсальную таблицу
  `INSERT INTO kit_solution_components (kit_solution_id, component_type, module_id, position_order, position_type, position_uid, created_at)
   SELECT ksm.kit_solution_id, 'module', ksm.module_id, ksm.position_order, ksm.position_type, ksm.position_uid, ksm.created_at
   FROM kit_solution_modules ksm
   WHERE NOT EXISTS (
     SELECT 1
     FROM kit_solution_components ksc
     WHERE ksc.kit_solution_id = ksm.kit_solution_id
       AND ksc.component_type = 'module'
       AND ksc.module_id = ksm.module_id
       AND (ksc.position_uid IS NOT DISTINCT FROM ksm.position_uid)
   );`,
];

const dropStatements = [
  `DROP INDEX IF EXISTS idx_kit_solution_components_position_uid;`,
  `DROP INDEX IF EXISTS idx_kit_solution_components_catalog_item;`,
  `DROP INDEX IF EXISTS idx_kit_solution_components_module;`,
  `DROP INDEX IF EXISTS idx_kit_solution_components_kit;`,
  `DROP TABLE IF EXISTS kit_solution_components CASCADE;`,
];

const up = async (query) => {
  console.log("🔧 Создаем таблицу kit_solution_components...");
  for (const sql of statements) {
    await query(sql);
  }
  console.log("✅ Таблица kit_solution_components создана");
};

const down = async (query) => {
  console.log("🔙 Откатываем kit_solution_components...");
  for (const sql of dropStatements) {
    await query(sql);
  }
  console.log("✅ Откат kit_solution_components завершен");
};

module.exports = {
  id: "023_create_kit_solution_components",
  up,
  down,
};
