const { query } = require("../config/db");

const normalizeLinksInput = (items) => {
  if (!Array.isArray(items)) return [];
  const uniq = new Set();

  for (const it of items) {
    const categoryId = Number(it?.category_id ?? it?.categoryId ?? it?.id);
    if (!Number.isFinite(categoryId) || categoryId <= 0) continue;
    uniq.add(categoryId);
  }

  return Array.from(uniq.values()).map((categoryId) => ({ categoryId }));
};

const setEntityCategories = async ({ entityType, entityId, items }) => {
  if (!entityType) throw new Error("entityType is required");
  const id = Number(entityId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("entityId is invalid");

  const normalized = normalizeLinksInput(items);

  await query(
    `DELETE FROM product_parameter_category_links WHERE entity_type = $1 AND entity_id = $2`,
    [String(entityType), id]
  );

  for (const it of normalized) {
    await query(
      `INSERT INTO product_parameter_category_links(entity_type, entity_id, category_id)
       VALUES ($1, $2, $3)`,
      [String(entityType), id, it.categoryId]
    );
  }

  return await getEntityCategories({ entityType, entityId: id });
};

const getEntityCategories = async ({ entityType, entityId }) => {
  if (!entityType) return [];
  const id = Number(entityId);
  if (!Number.isFinite(id) || id <= 0) return [];

  const { rows } = await query(
    `SELECT
      ppc.category_id as id,
      ppcat.name as name
     FROM product_parameter_category_links ppc
     JOIN product_parameter_categories ppcat ON ppcat.id = ppc.category_id
     WHERE ppc.entity_type = $1 AND ppc.entity_id = $2
     ORDER BY ppcat.name ASC`,
    [String(entityType), id]
  );

  return rows;
};

module.exports = {
  setEntityCategories,
  getEntityCategories,
};
