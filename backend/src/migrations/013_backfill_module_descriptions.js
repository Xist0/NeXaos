/**
 * Миграция: мигрируем существующие modules.base_sku в module_descriptions
 * и проставляем modules.description_id.
 */

const up = async (query) => {
  console.log("🔧 Backfill module_descriptions from modules.base_sku...");

  // 1) Создаем описания по уникальным base_sku
  await query(
    `INSERT INTO module_descriptions (base_sku, name)
     SELECT DISTINCT m.base_sku, m.base_sku
     FROM modules m
     WHERE m.base_sku IS NOT NULL AND btrim(m.base_sku) <> ''
     ON CONFLICT (base_sku) DO NOTHING`
  );

  // 2) Проставляем description_id по base_sku
  await query(
    `UPDATE modules m
     SET description_id = d.id
     FROM module_descriptions d
     WHERE m.description_id IS NULL
       AND m.base_sku IS NOT NULL AND btrim(m.base_sku) <> ''
       AND d.base_sku = m.base_sku`
  );

  console.log("✅ Backfill module_descriptions completed");
};

const down = async (query) => {
  console.log("🔙 Down migration for 013_backfill_module_descriptions (noop)");
};

module.exports = {
  id: "013_backfill_module_descriptions",
  up,
  down,
};
