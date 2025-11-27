const up = async (query) => {
  await query(`
    CREATE TABLE IF NOT EXISTS order_notes (
      id SERIAL PRIMARY KEY,
      order_id INT REFERENCES orders(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      note TEXT NOT NULL,
      is_private BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_order_notes_order_id ON order_notes(order_id)
  `);
};

const down = async (query) => {
  await query(`DROP TABLE IF EXISTS order_notes CASCADE`);
};

module.exports = { up, down };

