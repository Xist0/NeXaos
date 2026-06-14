/**
 * Миграция: добавляем поле category в sheet_materials и hardware_items_extended
 * для группировки материалов и фурнитуры по типам/группам.
 *
 * Также обновляем seed-данные material_classes с новыми категориями
 * и добавляем колонку countertop_size в sheet_materials (для столешниц).
 */

const statements = [
  // Добавляем category в sheet_materials
  `ALTER TABLE sheet_materials ADD COLUMN IF NOT EXISTS category TEXT;`,

  // Добавляем countertop_size в sheet_materials (для столешниц: "4100*600*38", "3050х650х12" etc)
  `ALTER TABLE sheet_materials ADD COLUMN IF NOT EXISTS countertop_size TEXT;`,

  // Добавляем category в hardware_items_extended
  `ALTER TABLE hardware_items_extended ADD COLUMN IF NOT EXISTS category TEXT;`,

  // Индекс по category для быстрой фильтрации
  `CREATE INDEX IF NOT EXISTS idx_sheet_materials_category ON sheet_materials(category);`,
  `CREATE INDEX IF NOT EXISTS idx_hardware_extended_category ON hardware_items_extended(category);`,
];

const seedMaterialCategories = [
  // Материалы — группы
  ["ЛХДФ", "ЛХДФ"],
  ["EGGER", "EGGER"],
  ["AGT", "AGT"],
  ["Кромка", "Кромочный материал"],
  ["Столешница EGGER", "Столешница EGGER"],
  ["Столешница СКИФ", "Столешница СКИФ"],
  ["Рамка", "Рамка"],
  ["Стекло в рамку", "Стекло в рамку"],
  ["Пленка под фрезу", "Пленка под фрезу"],
  ["Вид фрезы", "Вид фрезы"],
];

const seedHardwareCategories = [
  ["Выдвижные системы", "Выдвижные системы"],
  ["Подъемные механизмы", "Подъемные механизмы"],
  ["Петли", "Петли"],
  ["Опора", "Опора"],
  ["Решётка вентиляционная", "Решётка вентиляционная"],
  ["Сушка", "Сушка"],
  ["Лоток", "Лоток"],
  ["Навесы", "Навесы"],
  ["Расходники", "Расходники"],
  ["Крепежная фурнитура", "Крепежная фурнитура"],
];

const up = async (query) => {
  console.log("🔧 Добавляем категории материалов и фурнитуры...");

  for (const sql of statements) {
    await query(sql);
  }

  // Добавляем новые классы материалов для категорий
  console.log("📝 Добавляем классы материалов для категорий...");

  for (const [code, name] of seedMaterialCategories) {
    await query(
      `INSERT INTO material_classes (code, name)
       VALUES ($1, $2)
       ON CONFLICT (code) DO NOTHING`,
      [code, name]
    );
  }

  for (const [code, name] of seedHardwareCategories) {
    await query(
      `INSERT INTO material_classes (code, name)
       VALUES ($1, $2)
       ON CONFLICT (code) DO NOTHING`,
      [code, name]
    );
  }

  console.log("✅ Категории материалов и фурнитуры созданы");
};

const down = async (query) => {
  console.log("🔙 Откатываем категории...");

  `DROP INDEX IF EXISTS idx_hardware_extended_category;`,
  `DROP INDEX IF EXISTS idx_sheet_materials_category;`,

  await query(`ALTER TABLE sheet_materials DROP COLUMN IF EXISTS countertop_size;`);
  await query(`ALTER TABLE sheet_materials DROP COLUMN IF EXISTS category;`);
  await query(`ALTER TABLE hardware_items_extended DROP COLUMN IF EXISTS category;`);

  console.log("✅ Категории откачены");
};

module.exports = {
  id: "037_add_category_to_materials_and_hardware",
  up,
  down,
};