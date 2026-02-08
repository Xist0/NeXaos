const { query } = require("../config/db");

module.exports = {
  name: "029_create_product_parameter_categories",
  up: async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS product_parameter_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS product_parameter_category_links (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(64) NOT NULL,
        entity_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL REFERENCES product_parameter_categories(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(entity_type, entity_id, category_id)
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_product_parameter_category_links_entity
      ON product_parameter_category_links(entity_type, entity_id);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_product_parameter_category_links_category
      ON product_parameter_category_links(category_id);
    `);
  },
};
