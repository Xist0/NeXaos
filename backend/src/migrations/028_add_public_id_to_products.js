const crypto = require("crypto");

const statements = [
  `ALTER TABLE modules
    ADD COLUMN IF NOT EXISTS public_id TEXT;`,
  `ALTER TABLE catalog_items
    ADD COLUMN IF NOT EXISTS public_id TEXT;`,
  `ALTER TABLE kit_solutions
    ADD COLUMN IF NOT EXISTS public_id TEXT;`,

  `CREATE UNIQUE INDEX IF NOT EXISTS idx_modules_public_id
    ON modules(public_id)
    WHERE public_id IS NOT NULL;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_items_public_id
    ON catalog_items(public_id)
    WHERE public_id IS NOT NULL;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_kit_solutions_public_id
    ON kit_solutions(public_id)
    WHERE public_id IS NOT NULL;`,
];

const dropStatements = [
  `DROP INDEX IF EXISTS idx_kit_solutions_public_id;`,
  `DROP INDEX IF EXISTS idx_catalog_items_public_id;`,
  `DROP INDEX IF EXISTS idx_modules_public_id;`,

  // intentionally do not drop columns in down migrations
];

const backfill = async (query, table) => {
  const { rows } = await query(
    `SELECT id FROM ${table} WHERE public_id IS NULL OR TRIM(public_id) = '' ORDER BY id`
  );

  for (const row of rows) {
    await query(
      `UPDATE ${table}
       SET public_id = $1
       WHERE id = $2 AND (public_id IS NULL OR TRIM(public_id) = '')`,
      [crypto.randomUUID(), row.id]
    );
  }
};

const up = async (query) => {
  for (const sql of statements) {
    await query(sql);
  }

  await backfill(query, "modules");
  await backfill(query, "catalog_items");
  await backfill(query, "kit_solutions");
};

const down = async (query) => {
  for (const sql of dropStatements) {
    await query(sql);
  }
};

module.exports = {
  id: "028_add_public_id_to_products",
  up,
  down,
};
