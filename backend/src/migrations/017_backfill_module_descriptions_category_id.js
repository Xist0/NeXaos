/**
 * Backfill module_descriptions.module_category_id by matching base_sku prefix to module_categories.sku_prefix
 */

const statements = [
  `UPDATE module_descriptions md
   SET module_category_id = resolved.category_id
   FROM (
     SELECT md2.id AS module_description_id,
            mc2.id AS category_id
     FROM module_descriptions md2
     JOIN LATERAL (
       SELECT mc.id
       FROM module_categories mc
       WHERE mc.sku_prefix IS NOT NULL
         AND LENGTH(TRIM(mc.sku_prefix)) > 0
         AND UPPER(md2.base_sku) LIKE UPPER(TRIM(mc.sku_prefix)) || '%'
       ORDER BY LENGTH(TRIM(mc.sku_prefix)) DESC
       LIMIT 1
     ) mc2 ON TRUE
     WHERE md2.module_category_id IS NULL
   ) resolved
   WHERE md.id = resolved.module_description_id;`,
];

const downStatements = [
  `UPDATE module_descriptions SET module_category_id = NULL;`,
];

const up = async (query) => {
  console.log("🔧 Backfill module_descriptions.module_category_id...");
  for (const sql of statements) {
    await query(sql);
  }
  console.log("✅ Backfill завершен");
};

const down = async (query) => {
  console.log("🔙 Сбрасываем module_category_id для module_descriptions...");
  for (const sql of downStatements) {
    await query(sql);
  }
  console.log("✅ Откат выполнен");
};

module.exports = {
  id: "017_backfill_module_descriptions_category_id",
  up,
  down,
};
