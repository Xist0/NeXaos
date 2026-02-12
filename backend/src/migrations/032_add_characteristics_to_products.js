const statements = [
  `ALTER TABLE modules
    ADD COLUMN IF NOT EXISTS characteristics JSONB;`,

  `ALTER TABLE catalog_items
    ADD COLUMN IF NOT EXISTS characteristics JSONB;`,

  `ALTER TABLE kit_solutions
    ADD COLUMN IF NOT EXISTS characteristics JSONB;`,
];

const dropStatements = [
  `ALTER TABLE kit_solutions DROP COLUMN IF EXISTS characteristics;`,
  `ALTER TABLE catalog_items DROP COLUMN IF EXISTS characteristics;`,
  `ALTER TABLE modules DROP COLUMN IF EXISTS characteristics;`,
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
  id: "032_add_characteristics_to_products",
  up,
  down,
};
