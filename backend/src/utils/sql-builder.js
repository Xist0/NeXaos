const buildInsertQuery = (table, data) => {
  const fields = Object.keys(data);
  if (!fields.length) {
    throw new Error("No fields provided for INSERT");
  }
  const placeholders = fields.map((_, idx) => `$${idx + 1}`);
  const text = `INSERT INTO ${table} (${fields.join(
    ", "
  )}) VALUES (${placeholders.join(", ")}) RETURNING *`;
  return { text, values: Object.values(data) };
};

const buildUpdateQuery = (table, idColumn, data, idValue) => {
  const fields = Object.keys(data);
  if (!fields.length) {
    throw new Error("No fields provided for UPDATE");
  }
  const setClause = fields
    .map((field, idx) => `${field} = $${idx + 1}`)
    .join(", ");
  const text = `UPDATE ${table} SET ${setClause} WHERE ${idColumn} = $${
    fields.length + 1
  } RETURNING *`;
  const values = [...Object.values(data), idValue];
  return { text, values };
};

module.exports = {
  buildInsertQuery,
  buildUpdateQuery,
};

