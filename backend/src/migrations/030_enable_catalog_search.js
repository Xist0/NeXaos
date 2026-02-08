const { query } = require("../config/db");

module.exports = {
  name: "030_enable_catalog_search",
  up: async () => {
    await query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_modules_search_tsv
      ON modules
      USING GIN (to_tsvector('russian', COALESCE(name, '') || ' ' || COALESCE(sku, '') || ' ' || COALESCE(short_desc, '')));
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_catalog_items_search_tsv
      ON catalog_items
      USING GIN (to_tsvector('russian', COALESCE(name, '') || ' ' || COALESCE(sku, '') || ' ' || COALESCE(description, '')));
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_kit_solutions_search_tsv
      ON kit_solutions
      USING GIN (to_tsvector('russian', COALESCE(name, '') || ' ' || COALESCE(sku, '') || ' ' || COALESCE(description, '')));
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_modules_name_trgm ON modules USING GIN (name gin_trgm_ops);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_modules_sku_trgm ON modules USING GIN (sku gin_trgm_ops);`);

    await query(`CREATE INDEX IF NOT EXISTS idx_catalog_items_name_trgm ON catalog_items USING GIN (name gin_trgm_ops);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_catalog_items_sku_trgm ON catalog_items USING GIN (sku gin_trgm_ops);`);

    await query(`CREATE INDEX IF NOT EXISTS idx_kit_solutions_name_trgm ON kit_solutions USING GIN (name gin_trgm_ops);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_kit_solutions_sku_trgm ON kit_solutions USING GIN (sku gin_trgm_ops);`);
  },
};
