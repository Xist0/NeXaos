/**
 * Миграция для создания таблицы цветов и готовых решений
 */

const statements = [
  // Таблица цветов
  `CREATE TABLE IF NOT EXISTS colors (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT TRUE
  );`,

  // Обновляем таблицу modules для связи с цветами
  `ALTER TABLE modules 
   ADD COLUMN IF NOT EXISTS primary_color_id INT REFERENCES colors(id) ON DELETE SET NULL,
   ADD COLUMN IF NOT EXISTS secondary_color_id INT REFERENCES colors(id) ON DELETE SET NULL;`,

  // Таблица готовых решений (комплектов кухни)
  `CREATE TABLE IF NOT EXISTS kit_solutions (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    description TEXT,
    total_length_mm INT,
    total_depth_mm INT,
    total_height_mm INT,
    primary_color_id INT REFERENCES colors(id) ON DELETE SET NULL,
    secondary_color_id INT REFERENCES colors(id) ON DELETE SET NULL,
    material_id INT REFERENCES materials(id) ON DELETE SET NULL,
    countertop_length_mm INT,
    countertop_depth_mm INT,
    base_price NUMERIC(12,2),
    final_price NUMERIC(12,2),
    preview_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT TRUE
  );`,

  // Таблица связи готовых решений с модулями
  `CREATE TABLE IF NOT EXISTS kit_solution_modules (
    id SERIAL PRIMARY KEY,
    kit_solution_id INT REFERENCES kit_solutions(id) ON DELETE CASCADE,
    module_id INT REFERENCES modules(id) ON DELETE CASCADE,
    position_order INT DEFAULT 0,
    position_type TEXT, -- 'bottom', 'top', 'tall', 'filler', 'accessory'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,

  // Индексы
  `CREATE INDEX IF NOT EXISTS idx_modules_primary_color ON modules(primary_color_id);`,
  `CREATE INDEX IF NOT EXISTS idx_modules_secondary_color ON modules(secondary_color_id);`,
  `CREATE INDEX IF NOT EXISTS idx_kit_solutions_color ON kit_solutions(primary_color_id);`,
  `CREATE INDEX IF NOT EXISTS idx_kit_solution_modules_kit ON kit_solution_modules(kit_solution_id);`,
  `CREATE INDEX IF NOT EXISTS idx_kit_solution_modules_module ON kit_solution_modules(module_id);`,
];

const dropStatements = [
  `DROP INDEX IF EXISTS idx_kit_solution_modules_module;`,
  `DROP INDEX IF EXISTS idx_kit_solution_modules_kit;`,
  `DROP INDEX IF EXISTS idx_kit_solutions_color;`,
  `DROP INDEX IF EXISTS idx_modules_secondary_color;`,
  `DROP INDEX IF EXISTS idx_modules_primary_color;`,
  `DROP TABLE IF EXISTS kit_solution_modules CASCADE;`,
  `DROP TABLE IF EXISTS kit_solutions CASCADE;`,
  `ALTER TABLE modules 
   DROP COLUMN IF EXISTS secondary_color_id,
   DROP COLUMN IF EXISTS primary_color_id;`,
  `DROP TABLE IF EXISTS colors CASCADE;`,
];

const up = async (query) => {
  console.log("🔧 Создаем таблицы цветов и готовых решений...");
  
  for (const sql of statements) {
    await query(sql);
  }

  console.log("✅ Таблицы цветов и готовых решений созданы");
};

const down = async (query) => {
  console.log("🔙 Откатываем таблицы цветов и готовых решений...");
  for (const sql of dropStatements) {
    await query(sql);
  }
  console.log("✅ Таблицы откачены");
};

module.exports = {
  id: "009_create_colors_and_solutions",
  up,
  down,
};

