const { query } = require("../config/db");
const asyncHandler = require("../utils/async-handler");
const ApiError = require("../utils/api-error");

const isAdminOrManager = (req) => {
  const roleName = req.user?.roleName;
  return roleName === "admin" || roleName === "manager";
};

const loadOrderForAccessCheck = async (orderId) => {
  const { rows } = await query(`SELECT id, user_id FROM orders WHERE id = $1`, [orderId]);
  return rows[0] || null;
};

const assertOrderAccess = async (req, orderId) => {
  const order = await loadOrderForAccessCheck(orderId);
  if (!order) throw ApiError.notFound("Order not found");

  if (!isAdminOrManager(req) && order.user_id != null && Number(order.user_id) !== Number(req.user?.id)) {
    throw ApiError.forbidden("Access denied");
  }

  return order;
};

// Кастомный список заказов с информацией о пользователе
const list = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  const allowAll = isAdminOrManager(req);

  const { rows } = await query(
    `SELECT 
      o.id,
      o.user_id,
      o.status,
      o.total,
      o.created_at,
      u.full_name,
      u.email,
      u.phone
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    ${allowAll ? "" : "WHERE o.user_id = $3"}
    ORDER BY o.id DESC
    LIMIT $1 OFFSET $2`,
    allowAll ? [limit, offset] : [limit, offset, req.user?.id]
  );

  res.status(200).json({ data: rows });
});

// Кастомный getById с полной информацией о заказе
const getById = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const allowAll = isAdminOrManager(req);

  // Получаем информацию о заказе с пользователем
  const { rows: orderRows } = await query(
    `SELECT 
      o.id,
      o.user_id,
      o.status,
      o.total,
      o.created_at,
      u.full_name,
      u.email,
      u.phone
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    WHERE o.id = $1`,
    [orderId]
  );

  if (!orderRows[0]) {
    throw ApiError.notFound("Order not found");
  }

  const order = orderRows[0];

  if (!allowAll && order.user_id != null && Number(order.user_id) !== Number(req.user?.id)) {
    throw ApiError.forbidden("Access denied");
  }

  // Получаем элементы заказа
  const { rows: items } = await query(
    `SELECT 
      oi.id,
      oi.module_id,
      oi.entity_type,
      oi.entity_id,
      oi.qty,
      oi.price,
      oi.cost_price,
      COALESCE(m.name, ci.name, ks.name) as item_name,
      COALESCE(m.sku, ci.sku, ks.sku) as item_sku
    FROM order_items oi
    LEFT JOIN modules m
      ON (oi.entity_type = 'modules' AND oi.entity_id = m.id)
      OR (oi.entity_type IS NULL AND oi.module_id = m.id)
    LEFT JOIN catalog_items ci
      ON oi.entity_type = 'catalog-items' AND oi.entity_id = ci.id
    LEFT JOIN kit_solutions ks
      ON oi.entity_type = 'kit-solutions' AND oi.entity_id = ks.id
    WHERE oi.order_id = $1`,
    [orderId]
  );

  order.items = items;

  // Получаем заметки (все для админа, только публичные для пользователя)
  // Проверяем наличие req.user безопасно
  const allowNotesAll = isAdminOrManager(req);
  
  // Проверяем, существует ли таблица order_notes, если нет - возвращаем пустой массив
  let notes = [];
  try {
    const notesQuery = allowNotesAll
      ? `SELECT 
          note.id,
          note.order_id,
          note.user_id,
          note.note,
          note.is_private,
          note.created_at,
          u.full_name as author_name
        FROM order_notes note
        LEFT JOIN users u ON note.user_id = u.id
        WHERE note.order_id = $1
        ORDER BY note.created_at DESC`
      : `SELECT 
          note.id,
          note.order_id,
          note.user_id,
          note.note,
          note.is_private,
          note.created_at,
          u.full_name as author_name
        FROM order_notes note
        LEFT JOIN users u ON note.user_id = u.id
        WHERE note.order_id = $1 AND note.is_private = false
        ORDER BY note.created_at DESC`;

    const { rows } = await query(notesQuery, [orderId]);
    notes = rows;
  } catch (error) {
    // Если таблица order_notes не существует, просто возвращаем пустой массив
    console.warn("Order notes table might not exist:", error.message);
    notes = [];
  }
  
  order.notes = notes;

  res.status(200).json({ data: order });
});

const listNotes = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  await assertOrderAccess(req, orderId);

  const allowAll = isAdminOrManager(req);
  const sql = allowAll
    ? `SELECT 
        note.id,
        note.order_id,
        note.user_id,
        note.note,
        note.is_private,
        note.created_at,
        u.full_name as author_name
      FROM order_notes note
      LEFT JOIN users u ON note.user_id = u.id
      WHERE note.order_id = $1
      ORDER BY note.created_at DESC`
    : `SELECT 
        note.id,
        note.order_id,
        note.user_id,
        note.note,
        note.is_private,
        note.created_at,
        u.full_name as author_name
      FROM order_notes note
      LEFT JOIN users u ON note.user_id = u.id
      WHERE note.order_id = $1 AND note.is_private = false
      ORDER BY note.created_at DESC`;

  try {
    const { rows } = await query(sql, [orderId]);
    res.status(200).json({ data: rows });
  } catch (error) {
    // Если таблица order_notes не существует, возвращаем пустой массив
    if (error?.code === "42P01") {
      return res.status(200).json({ data: [] });
    }
    throw error;
  }
});

const addNote = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  await assertOrderAccess(req, orderId);

  const noteRaw = req.body?.note;
  const note = typeof noteRaw === "string" ? noteRaw.trim() : "";
  if (!note) {
    throw ApiError.badRequest("Note is required");
  }

  const allowAll = isAdminOrManager(req);
  const isPrivate = allowAll ? Boolean(req.body?.is_private) : false;

  let inserted;
  try {
    ({ rows: inserted } = await query(
      `INSERT INTO order_notes (order_id, user_id, note, is_private)
       VALUES ($1, $2, $3, $4)
       RETURNING id, order_id, user_id, note, is_private, created_at`,
      [orderId, req.user?.id || null, note, isPrivate]
    ));
  } catch (error) {
    if (error?.code === "42P01") {
      throw ApiError.internal("Order chat is not available");
    }
    throw error;
  }

  const created = inserted[0];
  const { rows: authorRows } = await query(`SELECT full_name FROM users WHERE id = $1`, [created.user_id]);
  created.author_name = authorRows[0]?.full_name || null;

  res.status(201).json({ data: created });
});

module.exports = { list, getById, listNotes, addNote };

