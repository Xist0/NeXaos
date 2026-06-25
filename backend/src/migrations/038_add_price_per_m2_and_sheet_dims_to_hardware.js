/**
 * Migration: add price_per_m2, sheet_length_mm, sheet_width_mm to hardware_items_extended
 */
exports.up = async (client) => {
  await client.query(`
    ALTER TABLE hardware_items_extended
      ADD COLUMN IF NOT EXISTS price_per_m2 NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS sheet_length_mm INT,
      ADD COLUMN IF NOT EXISTS sheet_width_mm INT;
  `);
  console.log("✅ Added price_per_m2, sheet_length_mm, sheet_width_mm to hardware_items_extended");
};

exports.down = async (client) => {
  await client.query(`
    ALTER TABLE hardware_items_extended
      DROP COLUMN IF EXISTS price_per_m2,
      DROP COLUMN IF EXISTS sheet_length_mm,
      DROP COLUMN IF EXISTS sheet_width_mm;
  `);
  console.log("↩️ Removed price_per_m2, sheet_length_mm, sheet_width_mm from hardware_items_extended");
};
