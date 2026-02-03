const statements = [
  `CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_collections_is_active ON collections(is_active);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_sku_unique ON collections(sku) WHERE sku IS NOT NULL AND sku <> '';`,

  `ALTER TABLE modules
    ADD COLUMN IF NOT EXISTS collection_id INT REFERENCES collections(id) ON DELETE SET NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_modules_collection_id ON modules(collection_id);`,

  `ALTER TABLE kit_solutions
    ADD COLUMN IF NOT EXISTS collection_id INT REFERENCES collections(id) ON DELETE SET NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_kit_solutions_collection_id ON kit_solutions(collection_id);`,

  `CREATE TABLE IF NOT EXISTS catalog_items (
    id SERIAL PRIMARY KEY,
    sku TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category_group TEXT,
    category TEXT,
    primary_color_id INT REFERENCES colors(id) ON DELETE SET NULL,
    secondary_color_id INT REFERENCES colors(id) ON DELETE SET NULL,
    length_mm INT,
    depth_mm INT,
    height_mm INT,
    base_price NUMERIC(12,2),
    final_price NUMERIC(12,2),
    preview_url TEXT,
    collection_id INT REFERENCES collections(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_catalog_items_is_active ON catalog_items(is_active);`,
  `CREATE INDEX IF NOT EXISTS idx_catalog_items_category_group ON catalog_items(category_group);`,
  `CREATE INDEX IF NOT EXISTS idx_catalog_items_category ON catalog_items(category);`,
  `CREATE INDEX IF NOT EXISTS idx_catalog_items_collection_id ON catalog_items(collection_id);`,
  `CREATE INDEX IF NOT EXISTS idx_catalog_items_sku ON catalog_items(sku);`,
  `CREATE INDEX IF NOT EXISTS idx_catalog_items_name ON catalog_items(name);`,
];

const dropStatements = [
  `DROP INDEX IF EXISTS idx_catalog_items_name;`,
  `DROP INDEX IF EXISTS idx_catalog_items_sku;`,
  `DROP INDEX IF EXISTS idx_catalog_items_collection_id;`,
  `DROP INDEX IF EXISTS idx_catalog_items_category;`,
  `DROP INDEX IF EXISTS idx_catalog_items_category_group;`,
  `DROP INDEX IF EXISTS idx_catalog_items_is_active;`,
  `DROP TABLE IF EXISTS catalog_items CASCADE;`,

  `DROP INDEX IF EXISTS idx_kit_solutions_collection_id;`,
  `ALTER TABLE kit_solutions DROP COLUMN IF EXISTS collection_id;`,

  `DROP INDEX IF EXISTS idx_modules_collection_id;`,
  `ALTER TABLE modules DROP COLUMN IF EXISTS collection_id;`,

  `DROP INDEX IF EXISTS idx_collections_sku_unique;`,
  `DROP INDEX IF EXISTS idx_collections_is_active;`,
  `DROP TABLE IF EXISTS collections CASCADE;`,
];

const up = async (query) => {
  for (const sql of statements) {
    await query(sql);
  }
};

const down = async (query) => {
  for (const sql of dropStatements) {
    await query(sql);
  }
};

module.exports = {
  id: "020_create_collections_and_catalog_items",
  up,
  down,
};
