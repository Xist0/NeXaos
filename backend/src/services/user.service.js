const bcrypt = require("bcrypt");
const { query } = require("../config/db");

const toSafeUser = (dbUser) => ({
  id: dbUser.id,
  roleId: dbUser.role_id,
  roleName: dbUser.role_name,
  email: dbUser.email,
  fullName: dbUser.full_name,
  phone: dbUser.phone,
  isActive: dbUser.is_active,
  createdAt: dbUser.created_at,
  updatedAt: dbUser.updated_at,
});

const findByEmail = async (email) => {
  const { rows } = await query(
    `SELECT u.*, r.name AS role_name
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.email = $1`,
    [email]
  );
  return rows[0] || null;
};

const verifyPassword = async (plain, hash) => {
  if (!hash) {
    return false;
  }
  return bcrypt.compare(plain, hash);
};

const hashPassword = (password) => bcrypt.hash(password, 10);

const ensureAdminUser = async ({
  email,
  password,
  fullName = "Test Admin",
  phone = null,
}) => {
  const existing = await findByEmail(email);
  if (existing) {
    return existing;
  }

  const passwordHash = await hashPassword(password);

  const { rows } = await query(
    `INSERT INTO users (role_id, email, password_hash, full_name, phone, is_active)
     SELECT r.id, $1, $2, $3, $4, true
     FROM roles r
     WHERE r.name = 'admin'
     RETURNING *`,
    [email, passwordHash, fullName, phone]
  );

  return rows[0];
};

module.exports = {
  findByEmail,
  verifyPassword,
  hashPassword,
  ensureAdminUser,
  toSafeUser,
};

