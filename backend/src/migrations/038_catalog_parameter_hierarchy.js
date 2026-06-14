/**
 * Иерархия параметров каталога: категория → характеристика → значения.
 */
const statements = [
  `ALTER TABLE product_parameters
     ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES product_parameter_categories(id) ON DELETE SET NULL;`,
  `ALTER TABLE product_parameters
     ADD COLUMN IF NOT EXISTS field_key VARCHAR(128);`,
  `ALTER TABLE product_parameters
     ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_product_parameters_field_key
     ON product_parameters(field_key) WHERE field_key IS NOT NULL AND field_key <> '';`,
  `CREATE INDEX IF NOT EXISTS idx_product_parameters_category_id
     ON product_parameters(category_id);`,
];

const dropStatements = [
  `DROP INDEX IF EXISTS idx_product_parameters_category_id;`,
  `DROP INDEX IF EXISTS idx_product_parameters_field_key;`,
  `ALTER TABLE product_parameters DROP COLUMN IF EXISTS sort_order;`,
  `ALTER TABLE product_parameters DROP COLUMN IF EXISTS field_key;`,
  `ALTER TABLE product_parameters DROP COLUMN IF EXISTS category_id;`,
];

module.exports = {
  id: "038_catalog_parameter_hierarchy",
  up: async (query) => {
    for (const sql of statements) await query(sql);
  },
  down: async (query) => {
    for (const sql of dropStatements) await query(sql);
  },
};
