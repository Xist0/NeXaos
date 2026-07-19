const up = async (query) => {
  await query(`
    ALTER TABLE hardware_items_extended
    ADD COLUMN IF NOT EXISTS fasteners JSONB DEFAULT '[]'::jsonb
  `);
};

const down = async (query) => {
  await query(`
    ALTER TABLE hardware_items_extended
    DROP COLUMN IF EXISTS fasteners
  `);
};

module.exports = {
  id: "043_add_fasteners_to_hardware",
  up,
  down,
};
