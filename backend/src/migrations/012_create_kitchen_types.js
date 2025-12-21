const statements = [
  `CREATE TABLE IF NOT EXISTS kitchen_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT TRUE
  );`,

  `ALTER TABLE kit_solutions
    ADD COLUMN IF NOT EXISTS kitchen_type_id INT REFERENCES kitchen_types(id) ON DELETE SET NULL;`,

  `CREATE INDEX IF NOT EXISTS idx_kit_solutions_kitchen_type_id ON kit_solutions(kitchen_type_id);`,
];

const dropStatements = [
  `DROP INDEX IF EXISTS idx_kit_solutions_kitchen_type_id;`,
  `ALTER TABLE kit_solutions DROP COLUMN IF EXISTS kitchen_type_id;`,
  `DROP TABLE IF EXISTS kitchen_types CASCADE;`,
];

const up = async (query) => {
  console.log("🔧 Создаем типы кухни...");
  for (const sql of statements) {
    await query(sql);
  }
  console.log("✅ Типы кухни созданы");
};

const down = async (query) => {
  console.log("🔙 Откатываем типы кухни...");
  for (const sql of dropStatements) {
    await query(sql);
  }
  console.log("✅ Откат выполнен");
};

module.exports = {
  id: "012_create_kitchen_types",
  up,
  down,
};
