const statements = [
  `ALTER TABLE product_parameter_links
    ADD COLUMN IF NOT EXISTS value TEXT;`,
];

const dropStatements = [
  `ALTER TABLE product_parameter_links DROP COLUMN IF EXISTS value;`,
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
  id: "033_add_value_to_product_parameter_links",
  up,
  down,
};
