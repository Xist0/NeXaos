/**
 * Миграция: добавляем hardware_matrix (JSON) в modules для сохранения
 * матрицы расходников при расчёте стоимости.
 */

const statements = [
  `ALTER TABLE modules
     ADD COLUMN IF NOT EXISTS hardware_matrix JSONB DEFAULT '{}';`,
];

const downStatements = [
  `ALTER TABLE modules DROP COLUMN IF EXISTS hardware_matrix;`,
];

const up = async (query) => {
  console.log("🔧 Добавляем hardware_matrix в modules...");

  for (const sql of statements) {
    await query(sql);
  }

  console.log("✅ Добавлена hardware_matrix в modules");
};

const down = async (query) => {
  console.log("↩️ Откатываем hardware_matrix из modules...");

  for (const sql of downStatements) {
    await query(sql);
  }

  console.log("✅ Удалена hardware_matrix из modules");
};

module.exports = {
  id: "041_add_hardware_matrix_to_modules",
  up,
  down,
};
