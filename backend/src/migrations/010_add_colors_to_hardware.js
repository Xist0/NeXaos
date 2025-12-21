/**
 * Миграция для добавления полей цветов в таблицу фурнитуры
 */

const statements = [
  `ALTER TABLE hardware_items_extended 
   ADD COLUMN IF NOT EXISTS primary_color_id INT REFERENCES colors(id) ON DELETE SET NULL,
   ADD COLUMN IF NOT EXISTS secondary_color_id INT REFERENCES colors(id) ON DELETE SET NULL;`,
  
  `CREATE INDEX IF NOT EXISTS idx_hardware_extended_primary_color ON hardware_items_extended(primary_color_id);`,
  `CREATE INDEX IF NOT EXISTS idx_hardware_extended_secondary_color ON hardware_items_extended(secondary_color_id);`,
];

const dropStatements = [
  `DROP INDEX IF EXISTS idx_hardware_extended_secondary_color;`,
  `DROP INDEX IF EXISTS idx_hardware_extended_primary_color;`,
  `ALTER TABLE hardware_items_extended 
   DROP COLUMN IF EXISTS secondary_color_id,
   DROP COLUMN IF EXISTS primary_color_id;`,
];

const up = async (query) => {
  console.log("🔧 Добавляем поля цветов в таблицу фурнитуры...");
  
  for (const sql of statements) {
    await query(sql);
  }

  console.log("✅ Поля цветов добавлены в таблицу фурнитуры");
};

const down = async (query) => {
  console.log("🔙 Откатываем добавление полей цветов...");
  for (const sql of dropStatements) {
    await query(sql);
  }
  console.log("✅ Поля цветов удалены из таблицы фурнитуры");
};

module.exports = {
  id: "010_add_colors_to_hardware",
  up,
  down,
};

