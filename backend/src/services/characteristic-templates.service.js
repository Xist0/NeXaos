const { query } = require("../config/db");

const extractValue = (raw) => {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "object" && !Array.isArray(raw) && "value" in raw) {
    const v = raw.value;
    return v === null || v === undefined ? "" : String(v).trim();
  }
  if (typeof raw === "boolean") return raw ? "Да" : "";
  if (typeof raw === "number") return String(raw).trim();
  return String(raw).trim();
};

const upsertFromCharacteristics = async (characteristics) => {
  if (!characteristics || typeof characteristics !== "object" || Array.isArray(characteristics)) {
    return;
  }

  for (const [fieldKey, raw] of Object.entries(characteristics)) {
    const key = String(fieldKey || "").trim();
    if (!key) continue;
    const value = extractValue(raw);
    if (!value) continue;

    await query(
      `INSERT INTO characteristic_value_templates(field_key, value)
       VALUES ($1, $2)
       ON CONFLICT (field_key, value_norm)
       DO UPDATE SET updated_at = NOW()`,
      [key, value]
    );
  }
};

const listByFieldKey = async (fieldKey, limit = 200) => {
  const key = String(fieldKey || "").trim();
  if (!key) return [];

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
  const { rows } = await query(
    `SELECT id, field_key, value
     FROM characteristic_value_templates
     WHERE field_key = $1
     ORDER BY value ASC
     LIMIT $2`,
    [key, safeLimit]
  );
  return rows;
};

const listGrouped = async (limitPerField = 100) => {
  const safeLimit = Math.min(Math.max(parseInt(limitPerField, 10) || 100, 1), 300);
  const { rows } = await query(
    `SELECT DISTINCT ON (field_key, value_norm) field_key, value
     FROM characteristic_value_templates
     ORDER BY field_key ASC, value_norm ASC, value ASC`
  );

  const map = {};
  for (const row of rows) {
    const fk = String(row.field_key || "");
    if (!fk) continue;
    if (!map[fk]) map[fk] = [];
    if (map[fk].length >= safeLimit) continue;
    const v = String(row.value || "").trim();
    if (v && !map[fk].includes(v)) map[fk].push(v);
  }
  return map;
};

module.exports = {
  upsertFromCharacteristics,
  listByFieldKey,
  listGrouped,
  extractValue,
};
