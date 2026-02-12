const { query } = require("../config/db");

const normalizeLinksInput = (items) => {
  if (!Array.isArray(items)) return [];
  const map = new Map();

  for (const it of items) {
    const parameterId = Number(it?.parameter_id ?? it?.parameterId ?? it?.id);
    if (!Number.isFinite(parameterId) || parameterId <= 0) continue;

    const rawValue = it?.value;
    const value = rawValue === null || rawValue === undefined ? null : String(rawValue).trim();

    const qtyRaw = Number(it?.quantity ?? 1);
    const quantity = Number.isFinite(qtyRaw) ? Math.max(1, Math.round(qtyRaw)) : 1;

    // If duplicates exist, last non-empty value wins and quantity is summed.
    const prev = map.get(parameterId) || { quantity: 0, value: null };
    map.set(parameterId, {
      quantity: prev.quantity + quantity,
      value: value ? value : prev.value,
    });
  }

  return Array.from(map.entries()).map(([parameterId, meta]) => ({
    parameterId,
    quantity: meta.quantity,
    value: meta.value,
  }));
};

const setEntityParameters = async ({ entityType, entityId, items }) => {
  if (!entityType) throw new Error("entityType is required");
  const id = Number(entityId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("entityId is invalid");

  const normalized = normalizeLinksInput(items);

  await query(
    `DELETE FROM product_parameter_links WHERE entity_type = $1 AND entity_id = $2`,
    [String(entityType), id]
  );

  for (const it of normalized) {
    await query(
      `INSERT INTO product_parameter_links(entity_type, entity_id, parameter_id, quantity, value)
       VALUES ($1, $2, $3, $4, $5)`,
      [String(entityType), id, it.parameterId, it.quantity, it.value]
    );
  }

  return await getEntityParameters({ entityType, entityId: id });
};

const getEntityParameters = async ({ entityType, entityId }) => {
  if (!entityType) return [];
  const id = Number(entityId);
  if (!Number.isFinite(id) || id <= 0) return [];

  const { rows } = await query(
    `SELECT
      ppl.parameter_id as id,
      pp.name as name,
      ppl.quantity as quantity,
      ppl.value as value
     FROM product_parameter_links ppl
     JOIN product_parameters pp ON pp.id = ppl.parameter_id
     WHERE ppl.entity_type = $1 AND ppl.entity_id = $2
     ORDER BY pp.name ASC`,
    [String(entityType), id]
  );

  return rows;
};

module.exports = {
  setEntityParameters,
  getEntityParameters,
};
