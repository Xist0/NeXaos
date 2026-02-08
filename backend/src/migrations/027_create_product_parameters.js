const { query } = require("../config/db");

module.exports = {
  name: "027_create_product_parameters",
  up: async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS product_parameters (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS product_parameter_links (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(64) NOT NULL,
        entity_id INTEGER NOT NULL,
        parameter_id INTEGER NOT NULL REFERENCES product_parameters(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(entity_type, entity_id, parameter_id)
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_product_parameter_links_entity
      ON product_parameter_links(entity_type, entity_id);
    `);
  },
};
