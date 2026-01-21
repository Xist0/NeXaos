const statements = [
  `CREATE TABLE IF NOT EXISTS hero_slides (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    publish_at TIMESTAMP WITH TIME ZONE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT TRUE
  );`,
  `CREATE INDEX IF NOT EXISTS idx_hero_slides_publish_at ON hero_slides(publish_at);`,
  `CREATE INDEX IF NOT EXISTS idx_hero_slides_is_active ON hero_slides(is_active);`,
  `CREATE INDEX IF NOT EXISTS idx_hero_slides_sort_order ON hero_slides(sort_order);`,

  `CREATE TABLE IF NOT EXISTS works (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    publish_at TIMESTAMP WITH TIME ZONE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT TRUE
  );`,
  `CREATE INDEX IF NOT EXISTS idx_works_publish_at ON works(publish_at);`,
  `CREATE INDEX IF NOT EXISTS idx_works_is_active ON works(is_active);`,
  `CREATE INDEX IF NOT EXISTS idx_works_sort_order ON works(sort_order);`,

  `ALTER TABLE images
    ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image',
    ADD COLUMN IF NOT EXISTS mime_type TEXT;`,
  `CREATE INDEX IF NOT EXISTS idx_images_entity ON images(entity_type, entity_id);`,
];

const dropStatements = [
  `DROP INDEX IF EXISTS idx_images_entity;`,
  `ALTER TABLE images
    DROP COLUMN IF EXISTS mime_type,
    DROP COLUMN IF EXISTS media_type;`,
  `DROP INDEX IF EXISTS idx_works_sort_order;`,
  `DROP INDEX IF EXISTS idx_works_is_active;`,
  `DROP INDEX IF EXISTS idx_works_publish_at;`,
  `DROP TABLE IF EXISTS works CASCADE;`,
  `DROP INDEX IF EXISTS idx_hero_slides_sort_order;`,
  `DROP INDEX IF EXISTS idx_hero_slides_is_active;`,
  `DROP INDEX IF EXISTS idx_hero_slides_publish_at;`,
  `DROP TABLE IF EXISTS hero_slides CASCADE;`,
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
  id: "019_create_hero_slides_and_works",
  up,
  down,
};
