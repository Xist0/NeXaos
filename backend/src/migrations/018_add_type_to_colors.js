/**
 * Добавляем поле type в colors (facade/corpus/универсальный)
 */

const statements = [
  `ALTER TABLE colors ADD COLUMN IF NOT EXISTS type TEXT;`,

  // Нормализуем пустые значения
  `UPDATE colors SET type = NULL WHERE type = '';`,
];

const dropStatements = [
  `ALTER TABLE colors DROP COLUMN IF EXISTS type;`,
];

const up = async (query) => {
  console.log("🔧 Добавляем type в colors...");
  for (const sql of statements) {
    await query(sql);
  }
  console.log("✅ type добавлен");
};

const down = async (query) => {
  console.log("🔙 Откатываем type из colors...");
  for (const sql of dropStatements) {
    await query(sql);
  }
  console.log("✅ Откат выполнен");
};

module.exports = {
  id: "018_add_type_to_colors",
  up,
  down,
};
