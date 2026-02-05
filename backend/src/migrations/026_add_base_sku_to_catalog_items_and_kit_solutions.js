const { query } = require("../config/db");

module.exports = {
  name: "026_add_base_sku_to_catalog_items_and_kit_solutions",

  up: async () => {
    await query(
      `ALTER TABLE catalog_items
       ADD COLUMN IF NOT EXISTS base_sku TEXT`
    );

    await query(
      `ALTER TABLE kit_solutions
       ADD COLUMN IF NOT EXISTS base_sku TEXT`
    );

    // Backfill: if base_sku is empty, use name as a reasonable default.
    await query(
      `UPDATE catalog_items
       SET base_sku = COALESCE(NULLIF(TRIM(base_sku), ''), NULLIF(TRIM(name), ''))
       WHERE base_sku IS NULL OR TRIM(base_sku) = ''`
    );

    await query(
      `UPDATE kit_solutions
       SET base_sku = COALESCE(NULLIF(TRIM(base_sku), ''), NULLIF(TRIM(name), ''))
       WHERE base_sku IS NULL OR TRIM(base_sku) = ''`
    );
  },

  down: async () => {
    // No-op. Dropping columns is intentionally avoided.
  },
};
