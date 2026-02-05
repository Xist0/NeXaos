const crypto = require("crypto");

const statements = [
  `ALTER TABLE kit_solution_modules
    ADD COLUMN IF NOT EXISTS position_uid TEXT;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_kit_solution_modules_position_uid
    ON kit_solution_modules(position_uid)
    WHERE position_uid IS NOT NULL;`,
];

const dropStatements = [
  `DROP INDEX IF EXISTS idx_kit_solution_modules_position_uid;`,
  `ALTER TABLE kit_solution_modules
    DROP COLUMN IF EXISTS position_uid;`,
];

const up = async (query) => {
  for (const sql of statements) {
    await query(sql);
  }

  const { rows } = await query(
    `SELECT id FROM kit_solution_modules WHERE position_uid IS NULL ORDER BY id`
  );

  for (const row of rows) {
    await query(
      `UPDATE kit_solution_modules
       SET position_uid = $1
       WHERE id = $2 AND position_uid IS NULL`,
      [crypto.randomUUID(), row.id]
    );
  }
};

const down = async (query) => {
  for (const sql of dropStatements) {
    await query(sql);
  }
};

module.exports = {
  id: "022_add_position_uid_to_kit_solution_modules",
  up,
  down,
};
