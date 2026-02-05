const { query } = require("../config/db");

module.exports = {
  name: "024_backfill_kitchen_ready_kit_solution_categories",

  up: async () => {
    // Backfill legacy kitchen kit_solutions where categories were not set.
    // Heuristic: kitchen_type_id is set => kitchen kit solution.
    await query(
      `UPDATE kit_solutions
       SET category_group = COALESCE(NULLIF(TRIM(category_group), ''), 'Кухня'),
           category = COALESCE(NULLIF(TRIM(category), ''), 'Готовые кухни')
       WHERE kitchen_type_id IS NOT NULL
         AND (category_group IS NULL OR TRIM(category_group) = '' OR category IS NULL OR TRIM(category) = '')`
    );
  },

  down: async () => {
    // No-op: we don't want to erase categories once backfilled.
  },
};
