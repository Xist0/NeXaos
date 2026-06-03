const up = async (query) => {
  await query(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    INSERT INTO site_settings (id, settings)
    VALUES (1, '{"header":{"logoText":"NeXaos","navLinks":[{"label":"Каталог","url":"/catalog"},{"label":"Контакты","url":"/contacts"},{"label":"Отзывы","url":"/reviews"}],"socialLinks":[]}}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  `);
};

const down = async (query) => {
  await query(`DROP TABLE IF EXISTS site_settings;`);
};

module.exports = {
  id: "035_create_site_settings",
  up,
  down,
};
