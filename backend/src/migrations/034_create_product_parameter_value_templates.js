const statements = [
  `CREATE TABLE IF NOT EXISTS product_parameter_value_templates (
    id SERIAL PRIMARY KEY,
    parameter_id INT NOT NULL REFERENCES product_parameters(id) ON DELETE CASCADE,
    value TEXT NULL,
    quantity INT NOT NULL DEFAULT 1,
    value_norm TEXT GENERATED ALWAYS AS (COALESCE(value, '')) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS product_parameter_value_templates_uniq
    ON product_parameter_value_templates(parameter_id, value_norm, quantity);`,
];

const dropStatements = [
  `DROP TABLE IF EXISTS product_parameter_value_templates;`,
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
  id: "034_create_product_parameter_value_templates",
  up,
  down,
};
