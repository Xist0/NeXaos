const statements = [
  `CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS units (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE,
    name TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    role_id INT REFERENCES roles(id) ON DELETE SET NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    full_name TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT true
  );`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    user_agent TEXT,
    ip INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked BOOLEAN DEFAULT false
  );`,
  `CREATE TABLE IF NOT EXISTS materials (
    id SERIAL PRIMARY KEY,
    sku TEXT,
    name TEXT NOT NULL,
    unit_id INT REFERENCES units(id) ON DELETE SET NULL,
    comment TEXT,
    length_mm INT,
    width_mm INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  `CREATE TABLE IF NOT EXISTS material_prices (
    id SERIAL PRIMARY KEY,
    material_id INT REFERENCES materials(id) ON DELETE CASCADE,
    price NUMERIC(12,2) NOT NULL,
    price_per_sheet NUMERIC(12,2),
    coeff NUMERIC(6,3) DEFAULT 1.0,
    unit_id INT REFERENCES units(id) ON DELETE SET NULL,
    valid_from DATE DEFAULT now(),
    valid_to DATE
  );`,
  `CREATE TABLE IF NOT EXISTS hardware_items (
    id SERIAL PRIMARY KEY,
    sku TEXT,
    name TEXT NOT NULL,
    unit_id INT REFERENCES units(id) ON DELETE SET NULL,
    price NUMERIC(12,2),
    is_active BOOLEAN DEFAULT TRUE
  );`,
  `CREATE TABLE IF NOT EXISTS modules (
    id SERIAL PRIMARY KEY,
    sku TEXT UNIQUE,
    name TEXT NOT NULL,
    short_desc TEXT,
    length_mm INT,
    depth_mm INT,
    height_mm INT,
    facade_color TEXT,
    corpus_color TEXT,
    shelf_count INT,
    front_count INT,
    supports_count INT,
    hinges_count INT,
    clips_count INT,
    notes TEXT,
    base_price NUMERIC(12,2),
    cost_price NUMERIC(12,2),
    margin_pct NUMERIC(5,2),
    final_price NUMERIC(12,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT TRUE
  );`,
  `CREATE TABLE IF NOT EXISTS module_specs (
    id SERIAL PRIMARY KEY,
    module_id INT REFERENCES modules(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT,
    value_num NUMERIC,
    unit_id INT REFERENCES units(id) ON DELETE SET NULL
  );`,
  `CREATE TABLE IF NOT EXISTS module_materials (
    id SERIAL PRIMARY KEY,
    module_id INT REFERENCES modules(id) ON DELETE CASCADE,
    material_id INT REFERENCES materials(id) ON DELETE SET NULL,
    qty NUMERIC(12,4) NOT NULL,
    unit_id INT REFERENCES units(id) ON DELETE SET NULL,
    length_mm INT,
    width_mm INT,
    waste_coeff NUMERIC(6,4) DEFAULT 1.0,
    note TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS module_hardware (
    id SERIAL PRIMARY KEY,
    module_id INT REFERENCES modules(id) ON DELETE CASCADE,
    hardware_id INT REFERENCES hardware_items(id) ON DELETE SET NULL,
    qty NUMERIC(12,4) DEFAULT 1
  );`,
  `CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id INT NOT NULL,
    url TEXT NOT NULL,
    alt TEXT,
    sort_order INT DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS carts (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  `CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    cart_id INT REFERENCES carts(id) ON DELETE CASCADE,
    module_id INT REFERENCES modules(id) ON DELETE SET NULL,
    qty INT DEFAULT 1,
    price NUMERIC(12,2)
  );`,
  `CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    status TEXT,
    total NUMERIC(12,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    module_id INT REFERENCES modules(id) ON DELETE SET NULL,
    qty INT,
    price NUMERIC(12,2),
    cost_price NUMERIC(12,2)
  );`,
  `CREATE TABLE IF NOT EXISTS price_components (
    id SERIAL PRIMARY KEY,
    module_id INT REFERENCES modules(id) ON DELETE CASCADE,
    component_type TEXT,
    reference_id INT,
    qty NUMERIC(12,4),
    unit_id INT REFERENCES units(id) ON DELETE SET NULL,
    unit_price NUMERIC(12,2),
    total_price NUMERIC(12,2)
  );`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    table_name TEXT,
    row_id INT,
    action TEXT,
    user_id INT,
    changes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
];

const dropStatements = [
  "DROP TABLE IF EXISTS audit_logs CASCADE;",
  "DROP TABLE IF EXISTS price_components CASCADE;",
  "DROP TABLE IF EXISTS order_items CASCADE;",
  "DROP TABLE IF EXISTS orders CASCADE;",
  "DROP TABLE IF EXISTS cart_items CASCADE;",
  "DROP TABLE IF EXISTS carts CASCADE;",
  "DROP TABLE IF EXISTS images CASCADE;",
  "DROP TABLE IF EXISTS module_hardware CASCADE;",
  "DROP TABLE IF EXISTS module_materials CASCADE;",
  "DROP TABLE IF EXISTS module_specs CASCADE;",
  "DROP TABLE IF EXISTS modules CASCADE;",
  "DROP TABLE IF EXISTS hardware_items CASCADE;",
  "DROP TABLE IF EXISTS material_prices CASCADE;",
  "DROP TABLE IF EXISTS materials CASCADE;",
  "DROP TABLE IF EXISTS sessions CASCADE;",
  "DROP TABLE IF EXISTS users CASCADE;",
  "DROP TABLE IF EXISTS units CASCADE;",
  "DROP TABLE IF EXISTS roles CASCADE;",
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
  id: "001_create_core_tables",
  up,
  down,
};

