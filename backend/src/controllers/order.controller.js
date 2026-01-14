const { query } = require("../config/db");
const asyncHandler = require("../utils/async-handler");
const ApiError = require("../utils/api-error");

// Кастомный список заказов с информацией о пользователе
const list = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

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
    ORDER BY o.id DESC
    LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  res.status(200).json({ data: rows });
});

// Кастомный getById с полной информацией о заказе
const getById = asyncHandler(async (req, res) => {
  const orderId = req.params.id;

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

  // Получаем элементы заказа
  const { rows: items } = await query(
    `SELECT 
      oi.id,
      oi.module_id,
      oi.qty,
      oi.price,
      oi.cost_price,
      m.name as module_name,
      m.sku as module_sku
    FROM order_items oi
    LEFT JOIN modules m ON oi.module_id = m.id
    WHERE oi.order_id = $1`,
    [orderId]
  );

  order.items = items;

  // Получаем заметки (все для админа, только публичные для пользователя)
  // Проверяем наличие req.user безопасно
  const isAdmin = req.user && req.user.roleName === "admin";
  
  // Проверяем, существует ли таблица order_notes, если нет - возвращаем пустой массив
  let notes = [];
  try {
    const notesQuery = isAdmin
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

module.exports = { list, getById };

