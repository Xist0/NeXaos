/**
 * Миграция для создания новой структуры модулей:
 * - Типы модулей (по функционалу)
 * - Категории модулей (нижние, верхние, пеналы и т.д.)
 * - Описания модулей по основе артикула
 */

const statements = [
  // Таблица типов модулей по функционалу (распашной, выдвижной, угловой и т.д.)
  `CREATE TABLE IF NOT EXISTS module_types (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,

  // Таблица категорий модулей (нижние, верхние, пеналы, доборные, аксессуары)
  `CREATE TABLE IF NOT EXISTS module_categories (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,

  // Таблица описаний модулей по основе артикула (НМР, ВМР и т.д.)
  `CREATE TABLE IF NOT EXISTS module_descriptions (
    id SERIAL PRIMARY KEY,
    base_sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    characteristics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,

  // Добавляем новые поля в таблицу modules
  `ALTER TABLE modules 
   ADD COLUMN IF NOT EXISTS module_type_id INT REFERENCES module_types(id) ON DELETE SET NULL,
   ADD COLUMN IF NOT EXISTS module_category_id INT REFERENCES module_categories(id) ON DELETE SET NULL,
   ADD COLUMN IF NOT EXISTS base_sku TEXT,
   ADD COLUMN IF NOT EXISTS description_id INT REFERENCES module_descriptions(id) ON DELETE SET NULL;`,

  // Индексы для быстрого поиска
  `CREATE INDEX IF NOT EXISTS idx_modules_module_type_id ON modules(module_type_id);`,
  `CREATE INDEX IF NOT EXISTS idx_modules_module_category_id ON modules(module_category_id);`,
  `CREATE INDEX IF NOT EXISTS idx_modules_base_sku ON modules(base_sku);`,
  `CREATE INDEX IF NOT EXISTS idx_modules_description_id ON modules(description_id);`,
  `CREATE INDEX IF NOT EXISTS idx_module_descriptions_base_sku ON module_descriptions(base_sku);`,
];

const dropStatements = [
  `DROP INDEX IF EXISTS idx_module_descriptions_base_sku;`,
  `DROP INDEX IF EXISTS idx_modules_description_id;`,
  `DROP INDEX IF EXISTS idx_modules_base_sku;`,
  `DROP INDEX IF EXISTS idx_modules_module_category_id;`,
  `DROP INDEX IF EXISTS idx_modules_module_type_id;`,
  `ALTER TABLE modules 
   DROP COLUMN IF EXISTS description_id,
   DROP COLUMN IF EXISTS base_sku,
   DROP COLUMN IF EXISTS module_category_id,
   DROP COLUMN IF EXISTS module_type_id;`,
  `DROP TABLE IF EXISTS module_descriptions CASCADE;`,
  `DROP TABLE IF EXISTS module_categories CASCADE;`,
  `DROP TABLE IF EXISTS module_types CASCADE;`,
];

const up = async (query) => {
  console.log("🔧 Создаем структуру модулей...");
  
  for (const sql of statements) {
    await query(sql);
  }

  // Заполняем базовые данные
  console.log("📝 Заполняем базовые данные...");

  // Типы модулей
  const moduleTypes = [
    ["swing", "Распашной", "Модуль с распашными дверцами"],
    ["drawer", "Выдвижной", "Модуль с выдвижными ящиками"],
    ["corner", "Угловой", "Угловой модуль"],
    ["tall", "Пенал", "Высокий модуль-пенал"],
    ["accessory", "Аксессуар", "Дополнительный элемент"],
    ["filler", "Доборный", "Доборный элемент"],
  ];

  for (const [code, name, description] of moduleTypes) {
    await query(
      `INSERT INTO module_types (code, name, description) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (code) DO NOTHING`,
      [code, name, description]
    );
  }

  // Категории модулей
  const moduleCategories = [
    ["bottom", "Нижние модули", "Модули для нижнего ряда кухни", 1],
    ["top", "Верхние модули", "Модули для верхнего ряда кухни", 2],
    ["tall", "Пеналы", "Высокие модули-пеналы", 3],
    ["filler", "Доборные элементы", "Доборные элементы для кухни", 4],
    ["accessory", "Аксессуары", "Аксессуары для кухни", 5],
  ];

  for (const [code, name, description, sortOrder] of moduleCategories) {
    await query(
      `INSERT INTO module_categories (code, name, description, sort_order) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (code) DO NOTHING`,
      [code, name, description, sortOrder]
    );
  }

  console.log("✅ Структура модулей создана");
};

const down = async (query) => {
  console.log("🔙 Откатываем структуру модулей...");
  for (const sql of dropStatements) {
    await query(sql);
  }
  console.log("✅ Структура модулей откачена");
};

module.exports = {
  id: "006_create_module_structure",
  up,
  down,
};

