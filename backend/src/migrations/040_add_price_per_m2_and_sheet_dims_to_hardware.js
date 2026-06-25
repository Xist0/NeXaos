/**
 * Миграция: добавляем поля price_per_m2, sheet_length_mm, sheet_width_mm
 * в hardware_items_extended для листовой фурнитуры (столешницы, HDF и т.д.).
 */

const statements = [
  `ALTER TABLE hardware_items_extended
     ADD COLUMN IF NOT EXISTS price_per_m2 NUMERIC(12,2);`,
  `ALTER TABLE hardware_items_extended
     ADD COLUMN IF NOT EXISTS sheet_length_mm INT;`,
  `ALTER TABLE hardware_items_extended
     ADD COLUMN IF NOT EXISTS sheet_width_mm INT;`,
];

const downStatements = [
  `ALTER TABLE hardware_items_extended DROP COLUMN IF EXISTS price_per_m2;`,
  `ALTER TABLE hardware_items_extended DROP COLUMN IF EXISTS sheet_length_mm;`,
  `ALTER TABLE hardware_items_extended DROP COLUMN IF EXISTS sheet_width_mm;`,
];

const up = async (query) => {
  console.log("🔧 Добавляем price_per_m2, sheet_length_mm, sheet_width_mm в hardware_items_extended...");

  for (const sql of statements) {
    await query(sql);
  }

  console.log("✅ Добавлены price_per_m2, sheet_length_mm, sheet_width_mm в hardware_items_extended");
};

const down = async (query) => {
  console.log("↩️ Откатываем price_per_m2, sheet_length_mm, sheet_width_mm из hardware_items_extended...");

  for (const sql of downStatements) {
    await query(sql);
  }

  console.log("✅ Удалены price_per_m2, sheet_length_mm, sheet_width_mm из hardware_items_extended");
};

module.exports = {
  id: "040_add_price_per_m2_and_sheet_dims_to_hardware",
  up,
  down,
};
