const statements = [
  `ALTER TABLE kit_solutions
    ADD COLUMN IF NOT EXISTS category_group TEXT,
    ADD COLUMN IF NOT EXISTS category TEXT;`,

  `CREATE INDEX IF NOT EXISTS idx_kit_solutions_category_group ON kit_solutions(category_group);`,
  `CREATE INDEX IF NOT EXISTS idx_kit_solutions_category ON kit_solutions(category);`,
];

const dropStatements = [
  `DROP INDEX IF EXISTS idx_kit_solutions_category;`,
  `DROP INDEX IF EXISTS idx_kit_solutions_category_group;`,
  `ALTER TABLE kit_solutions
    DROP COLUMN IF EXISTS category,
    DROP COLUMN IF EXISTS category_group;`,
];

const up = async (query) => {
  for (const sql of statements) {
    await query(sql);
  }
};

const down = async (query) => {
  for (const sql of dropStatements) {
    await query(sql);
  }
};

module.exports = {
  id: "021_add_categories_to_kit_solutions",
  up,
  down,
};
