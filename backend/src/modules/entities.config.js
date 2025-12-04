const Joi = require("joi");
const { hashPassword } = require("../services/user.service");
const { query } = require("../config/db");

const buildFieldSchema = (config) => {
  let field;
  switch (config.type) {
    case "integer":
      field = Joi.number().integer();
      break;
    case "number":
      field = Joi.number();
      if (config.precision) {
        field = field.precision(config.precision);
      }
      break;
    case "boolean":
      field = Joi.boolean();
      break;
    case "date":
      field = Joi.date();
      break;
    case "json":
      field = Joi.object();
      break;
    default:
      field = Joi.string();
  }

  if (config.max) {
    field = field.max(config.max);
  }
  if (config.min) {
    field = field.min(config.min);
  }
  if (config.enum) {
    field = field.valid(...config.enum);
  }
  if (config.allowNull) {
    field = field.allow(null);
  }

  return field;
};

const buildSchema = (columns, { requireRequired }) => {
  const shape = {};

  Object.entries(columns).forEach(([key, config]) => {
    if (config.internal) {
      return;
    }

    let field = buildFieldSchema(config);

    if (config.virtual && !config.required) {
      field = field.optional();
    }

    if (config.required && requireRequired && !config.allowNull) {
      field = field.required();
    } else {
      field = field.optional();
    }

    shape[key] = field;
  });

  return Joi.object(shape).min(requireRequired ? 1 : 0);
};

const passwordHook = async (payload) => {
  if (payload.password) {
    payload.password_hash = await hashPassword(payload.password);
    delete payload.password;
  }
  return payload;
};

// Хук для автоматической установки role_id = "user" если не указан
const userCreateHook = async (payload, req) => {
  // Сначала обрабатываем пароль
  await passwordHook(payload);
  
  // Если role_id не указан, устанавливаем роль "user"
  if (!payload.role_id) {
    const { rows } = await query(
      `SELECT id FROM roles WHERE name = 'user' LIMIT 1`
    );
    if (rows[0]) {
      payload.role_id = rows[0].id;
    }
  }
  
  return payload;
};

const entities = [
  {
    route: "roles",
    table: "roles",
    idColumn: "id",
    columns: {
      name: { type: "string", required: true, max: 120 },
      description: { type: "string", max: 500, allowNull: true },
    },
  },
  {
    route: "units",
    table: "units",
    idColumn: "id",
    columns: {
      code: { type: "string", required: true, max: 20 },
      name: { type: "string", required: true, max: 255 },
    },
  },
  {
    route: "users",
    table: "users",
    idColumn: "id",
    columns: {
      role_id: { type: "integer", required: true },
      email: { type: "string", required: true, max: 255 },
      password: { type: "string", required: true, min: 6, virtual: true },
      password_hash: { type: "string", internal: true },
      full_name: { type: "string", max: 255, allowNull: true },
      phone: { type: "string", required: true, max: 50 },
      is_active: { type: "boolean" },
    },
    selectFields: [
      "id",
      "role_id",
      "email",
      "full_name",
      "phone",
      "is_active",
      "created_at",
      "updated_at",
    ],
    beforeCreate: userCreateHook,
    beforeUpdate: passwordHook,
  },
  {
    route: "sessions",
    table: "sessions",
    idColumn: "id",
    columns: {
      user_id: { type: "integer", required: true },
      token: { type: "string", required: true },
      user_agent: { type: "string", max: 255, allowNull: true },
      ip: { type: "string", max: 50, allowNull: true },
      expires_at: { type: "date", allowNull: true },
      revoked: { type: "boolean" },
    },
    selectFields: [
      "id",
      "user_id",
      "token",
      "user_agent",
      "ip",
      "created_at",
      "expires_at",
      "revoked",
    ],
  },
  {
    route: "materials",
    table: "materials",
    idColumn: "id",
    columns: {
      sku: { type: "string", max: 255, allowNull: true },
      name: { type: "string", required: true, max: 255 },
      unit_id: { type: "integer" },
      preview_url: { type: "string", allowNull: true },
      comment: { type: "string", allowNull: true },
      length_mm: { type: "integer" },
      width_mm: { type: "integer" },
      is_active: { type: "boolean" },
    },
  },
  {
    route: "material-prices",
    table: "material_prices",
    idColumn: "id",
    columns: {
      material_id: { type: "integer", required: true },
      price: { type: "number", required: true, precision: 2 },
      price_per_sheet: { type: "number", precision: 2 },
      coeff: { type: "number", precision: 3 },
      unit_id: { type: "integer" },
      valid_from: { type: "date" },
      valid_to: { type: "date" },
    },
  },
  {
    route: "hardware-items",
    table: "hardware_items",
    idColumn: "id",
    columns: {
      sku: { type: "string", max: 255, allowNull: true },
      name: { type: "string", required: true, max: 255 },
      unit_id: { type: "integer" },
      price: { type: "number", precision: 2 },
      is_active: { type: "boolean" },
    },
  },
  {
    route: "modules",
    table: "modules",
    idColumn: "id",
    columns: {
      sku: { type: "string", max: 255 },
      name: { type: "string", required: true, max: 255 },
      short_desc: { type: "string", allowNull: true },
      preview_url: { type: "string", allowNull: true },
      length_mm: { type: "integer" },
      depth_mm: { type: "integer" },
      height_mm: { type: "integer" },
      facade_color: { type: "string", allowNull: true },
      corpus_color: { type: "string", allowNull: true },
      shelf_count: { type: "integer" },
      front_count: { type: "integer" },
      supports_count: { type: "integer" },
      hinges_count: { type: "integer" },
      clips_count: { type: "integer" },
      notes: { type: "string", allowNull: true },
      base_price: { type: "number", precision: 2 },
      cost_price: { type: "number", precision: 2 },
      margin_pct: { type: "number", precision: 2 },
      final_price: { type: "number", precision: 2 },
      is_active: { type: "boolean" },
    },
  },
  {
    route: "module-specs",
    table: "module_specs",
    idColumn: "id",
    columns: {
      module_id: { type: "integer", required: true },
      key: { type: "string", required: true },
      value: { type: "string", allowNull: true },
      value_num: { type: "number" },
      unit_id: { type: "integer" },
    },
  },
  {
    route: "module-materials",
    table: "module_materials",
    idColumn: "id",
    columns: {
      module_id: { type: "integer", required: true },
      material_id: { type: "integer", required: true },
      qty: { type: "number", required: true, precision: 4 },
      unit_id: { type: "integer" },
      length_mm: { type: "integer" },
      width_mm: { type: "integer" },
      waste_coeff: { type: "number", precision: 4 },
      note: { type: "string", allowNull: true },
    },
  },
  {
    route: "module-hardware",
    table: "module_hardware",
    idColumn: "id",
    columns: {
      module_id: { type: "integer", required: true },
      hardware_id: { type: "integer", required: true },
      qty: { type: "number", precision: 4 },
    },
  },
  {
    route: "images",
    table: "images",
    idColumn: "id",
    columns: {
      entity_type: { type: "string", required: true },
      entity_id: { type: "integer", required: true },
      url: { type: "string", required: true },
      alt: { type: "string", allowNull: true },
      sort_order: { type: "integer" },
    },
  },
  {
    route: "carts",
    table: "carts",
    idColumn: "id",
    columns: {
      user_id: { type: "integer", required: true },
    },
  },
  {
    route: "cart-items",
    table: "cart_items",
    idColumn: "id",
    columns: {
      cart_id: { type: "integer", required: true },
      module_id: { type: "integer" },
      qty: { type: "integer" },
      price: { type: "number", precision: 2 },
    },
  },
  {
    route: "orders",
    table: "orders",
    idColumn: "id",
    columns: {
      user_id: { type: "integer", allowNull: true },
      status: { type: "string", allowNull: true },
      total: { type: "number", precision: 2 },
    },
    selectFields: ["id", "user_id", "status", "total", "created_at"],
  },
  {
    route: "order-items",
    table: "order_items",
    idColumn: "id",
    columns: {
      order_id: { type: "integer", required: true },
      module_id: { type: "integer" },
      qty: { type: "integer" },
      price: { type: "number", precision: 2 },
      cost_price: { type: "number", precision: 2 },
    },
  },
  {
    route: "order-notes",
    table: "order_notes",
    idColumn: "id",
    columns: {
      order_id: { type: "integer", required: true },
      user_id: { type: "integer", allowNull: true },
      note: { type: "string", required: true },
      is_private: { type: "boolean", default: false },
    },
    selectFields: ["id", "order_id", "user_id", "note", "is_private", "created_at"],
    beforeCreate: async (payload, req) => {
      // Автоматически устанавливаем user_id из текущего пользователя
      if (req.user?.id && !payload.user_id) {
        payload.user_id = req.user.id;
      }
      return payload;
    },
  },
  {
    route: "price-components",
    table: "price_components",
    idColumn: "id",
    columns: {
      module_id: { type: "integer", required: true },
      component_type: { type: "string", required: true },
      reference_id: { type: "integer" },
      qty: { type: "number", precision: 4 },
      unit_id: { type: "integer" },
      unit_price: { type: "number", precision: 2 },
      total_price: { type: "number", precision: 2 },
    },
  },
  {
    route: "audit-logs",
    table: "audit_logs",
    idColumn: "id",
    columns: {
      table_name: { type: "string", required: true },
      row_id: { type: "integer", required: true },
      action: { type: "string", required: true },
      user_id: { type: "integer" },
      changes: { type: "json", allowNull: true },
    },
    selectFields: [
      "id",
      "table_name",
      "row_id",
      "action",
      "user_id",
      "changes",
      "created_at",
    ],
  },
];

entities.forEach((entity) => {
  // Формируем selectFields: всегда включаем idColumn, затем поля из columns
  if (!entity.selectFields) {
    const columnFields = Object.keys(entity.columns).filter((key) => !entity.columns[key].virtual);
    // Убеждаемся, что idColumn всегда включен
    entity.selectFields = entity.idColumn && !columnFields.includes(entity.idColumn)
      ? [entity.idColumn, ...columnFields]
      : columnFields;
  } else {
    // Если selectFields задан явно, убеждаемся что idColumn включен
    if (entity.idColumn && !entity.selectFields.includes(entity.idColumn)) {
      entity.selectFields = [entity.idColumn, ...entity.selectFields];
    }
  }

  entity.createSchema = buildSchema(entity.columns, { requireRequired: true });
  entity.updateSchema = buildSchema(entity.columns, { requireRequired: false });
});

module.exports = entities;

