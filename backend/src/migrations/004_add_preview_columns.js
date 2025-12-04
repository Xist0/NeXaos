const statements = [
  // Превью для модулей
  `ALTER TABLE modules
     ADD COLUMN IF NOT EXISTS preview_url TEXT;`,
  // Превью для материалов
  `ALTER TABLE materials
     ADD COLUMN IF NOT EXISTS preview_url TEXT;`,
];

const downStatements = [
  `ALTER TABLE modules DROP COLUMN IF EXISTS preview_url;`,
  `ALTER TABLE materials DROP COLUMN IF EXISTS preview_url;`,
];

const up = async (query) => {
  for (const sql of statements) {
    await query(sql);
  }
};

const down = async (query) => {
  for (const sql of downStatements) {
    await query(sql);
  }
};

module.exports = {
  id: "004_add_preview_columns",
  up,
  down,
};




