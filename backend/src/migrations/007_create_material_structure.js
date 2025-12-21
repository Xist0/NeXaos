/**
 * Миграция для создания структуры материалов и фурнитуры:
 * - Классы материалов
 * - Погонный материал
 * - Листовой материал
 * - Фурнитура
 * - Параметры расчета
 */

const statements = [
  // Таблица классов материалов
  `CREATE TABLE IF NOT EXISTS material_classes (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,

  // Таблица погонного материала
  `CREATE TABLE IF NOT EXISTS linear_materials (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT,
    unit_id INT REFERENCES units(id) ON DELETE SET NULL,
    material_class_id INT REFERENCES material_classes(id) ON DELETE SET NULL,
    price_per_unit NUMERIC(12,2),
    edge_price_per_m NUMERIC(12,2),
    purpose TEXT,
    comment TEXT,
    length_mm INT,
    width_mm INT,
    price_per_piece NUMERIC(12,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT TRUE
  );`,

  // Таблица листового материала
  `CREATE TABLE IF NOT EXISTS sheet_materials (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT,
    unit_id INT REFERENCES units(id) ON DELETE SET NULL,
    material_class_id INT REFERENCES material_classes(id) ON DELETE SET NULL,
    price_per_m2 NUMERIC(12,2),
    edge_price_per_m NUMERIC(12,2),
    purpose TEXT,
    hardware_color TEXT,
    texture_url TEXT,
    comment TEXT,
    sheet_length_mm INT,
    sheet_width_mm INT,
    price_per_sheet NUMERIC(12,2),
    coefficient NUMERIC(6,4) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT TRUE
  );`,

  // Таблица фурнитуры
  `CREATE TABLE IF NOT EXISTS hardware_items_extended (
    id SERIAL PRIMARY KEY,
    module_type_id INT REFERENCES module_types(id) ON DELETE SET NULL,
    base_sku TEXT,
    name TEXT NOT NULL,
    sku TEXT,
    unit_id INT REFERENCES units(id) ON DELETE SET NULL,
    material_class_id INT REFERENCES material_classes(id) ON DELETE SET NULL,
    price_per_unit NUMERIC(12,2),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT TRUE
  );`,

  // Таблица параметров расчета
  `CREATE TABLE IF NOT EXISTS calculation_parameters (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    value TEXT,
    numeric_value NUMERIC(12,4),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,

  // Индексы
  `CREATE INDEX IF NOT EXISTS idx_linear_materials_class ON linear_materials(material_class_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sheet_materials_class ON sheet_materials(material_class_id);`,
  `CREATE INDEX IF NOT EXISTS idx_hardware_extended_class ON hardware_items_extended(material_class_id);`,
  `CREATE INDEX IF NOT EXISTS idx_hardware_extended_type ON hardware_items_extended(module_type_id);`,
];

const dropStatements = [
  `DROP INDEX IF EXISTS idx_hardware_extended_type;`,
  `DROP INDEX IF EXISTS idx_hardware_extended_class;`,
  `DROP INDEX IF EXISTS idx_sheet_materials_class;`,
  `DROP INDEX IF EXISTS idx_linear_materials_class;`,
  `DROP TABLE IF EXISTS calculation_parameters CASCADE;`,
  `DROP TABLE IF EXISTS hardware_items_extended CASCADE;`,
  `DROP TABLE IF EXISTS sheet_materials CASCADE;`,
  `DROP TABLE IF EXISTS linear_materials CASCADE;`,
  `DROP TABLE IF EXISTS material_classes CASCADE;`,
];

const up = async (query) => {
  console.log("🔧 Создаем структуру материалов и фурнитуры...");
  
  for (const sql of statements) {
    await query(sql);
  }

  // Заполняем базовые данные
  console.log("📝 Заполняем классы материалов...");

  const materialClasses = [
    ["M1", "Листовой материал"],
    ["M2", "Кромочный материал"],
    ["M3", "Погонный материал"],
    ["M4", "Столешницы"],
    ["M5", "Стекольная продукция"],
    ["FRN1", "Соединительная фурнитура"],
    ["FRN2", "Система открывания"],
    ["FRN3", "Наполнение для мебели"],
    ["FRN4", "Лицевая фурнитура"],
    ["FRN5", "Мебельная электрика"],
  ];

  for (const [code, name] of materialClasses) {
    await query(
      `INSERT INTO material_classes (code, name) 
       VALUES ($1, $2) 
       ON CONFLICT (code) DO NOTHING`,
      [code, name]
    );
  }

  console.log("✅ Структура материалов создана");
};

const down = async (query) => {
  console.log("🔙 Откатываем структуру материалов...");
  for (const sql of dropStatements) {
    await query(sql);
  }
  console.log("✅ Структура материалов откачена");
};

module.exports = {
  id: "007_create_material_structure",
  up,
  down,
};

