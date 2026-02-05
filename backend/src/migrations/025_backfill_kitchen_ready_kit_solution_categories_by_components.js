const { query } = require("../config/db");

module.exports = {
  name: "025_backfill_kitchen_ready_kit_solution_categories_by_components",

  up: async () => {
    // Backfill legacy kitchen kit_solutions where categories were not set.
    // Heuristic: if kit_solution has module composition, it belongs to kitchen.
    await query(
      `UPDATE kit_solutions ks
       SET category_group = COALESCE(NULLIF(TRIM(ks.category_group), ''), 'Кухня'),
           category = COALESCE(NULLIF(TRIM(ks.category), ''), 'Готовые кухни')
       WHERE (ks.category_group IS NULL OR TRIM(ks.category_group) = '' OR ks.category IS NULL OR TRIM(ks.category) = '')
         AND (
           EXISTS (SELECT 1 FROM kit_solution_modules ksm WHERE ksm.kit_solution_id = ks.id)
           OR EXISTS (
             SELECT 1
             FROM kit_solution_components ksc
             WHERE ksc.kit_solution_id = ks.id
               AND ksc.component_type = 'module'
           )
         )`
    );
  },

  down: async () => {
    // No-op.
  },
};
