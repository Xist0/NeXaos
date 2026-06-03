const statements = [
  `CREATE TABLE IF NOT EXISTS characteristic_value_templates (
    id SERIAL PRIMARY KEY,
    field_key TEXT NOT NULL,
    value TEXT NOT NULL,
    value_norm TEXT GENERATED ALWAYS AS (lower(trim(value))) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS characteristic_value_templates_uniq
    ON characteristic_value_templates(field_key, value_norm);`,
  `CREATE INDEX IF NOT EXISTS characteristic_value_templates_field_key
    ON characteristic_value_templates(field_key);`,
];

const backfillFromTable = (table) => `
  INSERT INTO characteristic_value_templates (field_key, value)
  SELECT DISTINCT k.key, trim(
    CASE
      WHEN jsonb_typeof(k.value) = 'object' THEN COALESCE(k.value->>'value', '')
      ELSE COALESCE(k.value #>> '{}', '')
    END
  )
  FROM ${table} t
  CROSS JOIN LATERAL jsonb_each(COALESCE(t.characteristics, '{}'::jsonb)) AS k(key, value)
  WHERE trim(
    CASE
      WHEN jsonb_typeof(k.value) = 'object' THEN COALESCE(k.value->>'value', '')
      ELSE COALESCE(k.value #>> '{}', '')
    END
  ) <> ''
  ON CONFLICT (field_key, value_norm) DO UPDATE SET updated_at = NOW();
`;

const dropStatements = [`DROP TABLE IF EXISTS characteristic_value_templates;`];

const up = async (query) => {
  for (const sql of statements) {
    await query(sql);
  }
  for (const table of ["modules", "catalog_items", "kit_solutions"]) {
    await query(backfillFromTable(table));
  }
};

const down = async (query) => {
  for (const sql of dropStatements) {
    await query(sql);
  }
};

module.exports = {
  id: "036_create_characteristic_value_templates",
  up,
  down,
};
