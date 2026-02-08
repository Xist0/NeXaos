const { query } = require("../config/db");

module.exports = {
  name: "031_add_entity_to_order_items",
  up: async () => {
    await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS entity_type VARCHAR(64);`);
    await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS entity_id INT;`);

    // Backfill existing rows (legacy): treat module_id as modules
    await query(`
      UPDATE order_items
      SET entity_type = 'modules',
          entity_id = module_id
      WHERE entity_type IS NULL
        AND entity_id IS NULL
        AND module_id IS NOT NULL;
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_order_items_entity
      ON order_items(entity_type, entity_id);
    `);
  },
};
