const up = async (query) => {
  // Сначала обновляем существующие записи без телефона
  await query(`
    UPDATE users 
    SET phone = '+7 (000) 000-00-00' 
    WHERE phone IS NULL OR phone = ''
  `);

  // Затем делаем поле обязательным
  await query(`
    ALTER TABLE users 
    ALTER COLUMN phone SET NOT NULL
  `);
};

const down = async (query) => {
  await query(`
    ALTER TABLE users 
    ALTER COLUMN phone DROP NOT NULL
  `);
};

module.exports = { up, down };

