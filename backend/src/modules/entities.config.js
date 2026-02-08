  const Joi = require("joi");
  const { hashPassword } = require("../services/user.service");
  const { query } = require("../config/db");
  const crypto = require("crypto");
  const { buildArticle } = require("../utils/article");
  const { resolveCategoryGroupCode, resolveCategoryCode } = require("../utils/category-codes");

  const buildFieldSchema = (config) => {
    let field;
    switch (config.type) {
      case "integer":
        field = Joi.number().integer().empty("");
        break;
      case "number":
        field = Joi.number().empty("");
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

  const normalizeSkuPart = (value) => {
    const s = String(value || "").trim();
    return s.replace(/\s+/g, "");
  };

  const shortColorPartFromSku = (colorSku) => {
    const lettersOnly = String(colorSku || "")
      .replace(/[^\p{L}]+/gu, "")
      .trim();
    if (!lettersOnly) return "";
    const part = lettersOnly.slice(0, 3);
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  };

  const buildAutoSku = ({ baseSku, colorSku, size }) => {
    const base = normalizeSkuPart(baseSku);
    const color = normalizeSkuPart(colorSku);
    const sizePart = normalizeSkuPart(size);
    if (!base || !color || !sizePart) return null;
    const own = `${base}${shortColorPartFromSku(color)}${sizePart}`;
    return `${base}-${color}-${sizePart}-${own}`;
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
      route: "size-templates",
      table: "size_templates",
      idColumn: "id",
      columns: {
        name: { type: "string", required: true, max: 255 },
        sizes: { type: "json", required: true },
      },
    },
    {
      route: "module-categories",
      table: "module_categories",
      idColumn: "id",
      columns: {
        code: { type: "string", required: true, max: 50 },
        name: { type: "string", required: true, max: 255 },
        description: { type: "string", allowNull: true },
        sku_prefix: { type: "string", max: 20, allowNull: true },
        sort_order: { type: "integer" },
      },
    },
    {
      route: "module-descriptions",
      table: "module_descriptions",
      idColumn: "id",
      columns: {
        base_sku: { type: "string", required: true, max: 50 },
        name: { type: "string", required: true, max: 255 },
        description: { type: "string", allowNull: true },
        characteristics: { type: "json", allowNull: true },
        module_category_id: { type: "integer" },
      },
    },
    {
      route: "kitchen-types",
      table: "kitchen_types",
      idColumn: "id",
      columns: {
        name: { type: "string", required: true, max: 255 },
        description: { type: "string", allowNull: true },
        is_active: { type: "boolean" },
      },
    },
    {
      route: "modules",
      table: "modules",
      idColumn: "id",
      columns: {
        public_id: { type: "string", max: 100, allowNull: true },
        sku: { type: "string", max: 255 },
        name: { type: "string", required: true, max: 255 },
        short_desc: { type: "string", allowNull: true },
        preview_url: { type: "string", allowNull: true },
        module_category_id: { type: "integer" },
        base_sku: { type: "string", max: 50 },
        description_id: { type: "integer" },
        collection_id: { type: "integer" },
        length_mm: { type: "integer" },
        depth_mm: { type: "integer" },
        height_mm: { type: "integer" },
        facade_color: { type: "string", allowNull: true },
        corpus_color: { type: "string", allowNull: true },
        primary_color_id: { type: "integer" },
        secondary_color_id: { type: "integer" },
        shelf_count: { type: "integer" },
        front_count: { type: "integer" },
        supports_count: { type: "integer" },
        hinges_count: { type: "integer" },
        clips_count: { type: "integer" },
        shelf_holder_count: { type: "integer" },
        screw_35x19_black_count: { type: "integer" },
        screw_35x16_white_count: { type: "integer" },
        euro_screw_7x50_count: { type: "integer" },
        cross_tie_count: { type: "integer" },
        damper_10x15_count: { type: "integer" },
        nail_16x25_count: { type: "integer" },
        drawer_smrtl_84_count: { type: "integer" },
        drawer_smrtl_135_count: { type: "integer" },
        drawer_smrtl_199_count: { type: "integer" },
        extension_15_count: { type: "integer" },
        extension_20_count: { type: "integer" },
        hdf_count: { type: "number", precision: 4 },
        pvc_edge_count: { type: "number", precision: 4 },
        agt_edge_count: { type: "number", precision: 4 },
        chipboard_count: { type: "number", precision: 4 },
        agt_count: { type: "number", precision: 4 },
        hardware_cost: { type: "number", precision: 2 },
        sheet_material_cost: { type: "number", precision: 2 },
        edge_material_cost: { type: "number", precision: 2 },
        notes: { type: "string", allowNull: true },
        base_price: { type: "number", precision: 2 },
        cost_price: { type: "number", precision: 2 },
        margin_pct: { type: "number", precision: 2 },
        final_price: { type: "number", precision: 2 },
        is_active: { type: "boolean" },
      },
      beforeCreate: async (payload) => {
        const next = { ...payload };
        if (!next.public_id) {
          next.public_id = crypto.randomUUID();
        }
        if (!next.sku) {
          let subcategory = "";
          if (next.module_category_id) {
            const { rows } = await query(
              `SELECT code, name FROM module_categories WHERE id = $1`,
              [next.module_category_id]
            );
            const row = rows?.[0];
            subcategory = row?.code || row?.name || "";
          }

          let primaryColor = next.facade_color;
          if (!primaryColor && next.primary_color_id) {
            const { rows } = await query(`SELECT sku FROM colors WHERE id = $1`, [next.primary_color_id]);
            primaryColor = rows?.[0]?.sku || null;
          }

          let secondaryColor = next.corpus_color;
          if (!secondaryColor && next.secondary_color_id) {
            const { rows } = await query(`SELECT sku FROM colors WHERE id = $1`, [next.secondary_color_id]);
            secondaryColor = rows?.[0]?.sku || null;
          }

          const generated = buildArticle({
            category: null,
            section: null,
            subcategory: null,
            name: next.base_sku || next.name,
            size1: next.length_mm,
            size2: next.depth_mm,
            size3: next.height_mm,
            primaryColor,
            secondaryColor,
          });
          if (generated) next.sku = generated;
        }
        return next;
      },
      beforeUpdate: async (payload) => {
        const next = { ...payload };
        if (Object.prototype.hasOwnProperty.call(next, "public_id")) {
          delete next.public_id;
        }
        const hasSkuInPayload = Object.prototype.hasOwnProperty.call(next, "sku") && next.sku;

        if (
          !hasSkuInPayload &&
          (next.base_sku || next.name || next.length_mm || next.depth_mm || next.height_mm || next.module_category_id || next.facade_color || next.corpus_color || next.primary_color_id || next.secondary_color_id)
        ) {
          let subcategory = "";
          if (next.module_category_id) {
            const { rows } = await query(
              `SELECT code, name FROM module_categories WHERE id = $1`,
              [next.module_category_id]
            );
            const row = rows?.[0];
            subcategory = row?.code || row?.name || "";
          }

          let primaryColor = next.facade_color;
          if (!primaryColor && next.primary_color_id) {
            const { rows } = await query(`SELECT sku FROM colors WHERE id = $1`, [next.primary_color_id]);
            primaryColor = rows?.[0]?.sku || null;
          }

          let secondaryColor = next.corpus_color;
          if (!secondaryColor && next.secondary_color_id) {
            const { rows } = await query(`SELECT sku FROM colors WHERE id = $1`, [next.secondary_color_id]);
            secondaryColor = rows?.[0]?.sku || null;
          }

          const generated = buildArticle({
            category: null,
            section: null,
            subcategory: null,
            name: next.base_sku || next.name,
            size1: next.length_mm,
            size2: next.depth_mm,
            size3: next.height_mm,
            primaryColor,
            secondaryColor,
          });
          if (generated) next.sku = generated;
        }
        return next;
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
        entity_type: { type: "string", allowNull: true, max: 64 },
        entity_id: { type: "integer", allowNull: true },
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
    {
      route: "hero-slides",
      table: "hero_slides",
      idColumn: "id",
      columns: {
        title: { type: "string", required: true },
        description: { type: "string", allowNull: true },
        publish_at: { type: "date", allowNull: true },
        sort_order: { type: "integer", default: 0 },
        is_active: { type: "boolean", default: true },
      },
      selectFields: ["id", "title", "description", "publish_at", "sort_order", "is_active", "created_at", "updated_at"],
    },
    {
      route: "works",
      table: "works",
      idColumn: "id",
      columns: {
        title: { type: "string", required: true },
        description: { type: "string", allowNull: true },
        publish_at: { type: "date", allowNull: true },
        sort_order: { type: "integer", default: 0 },
        is_active: { type: "boolean", default: true },
      },
      selectFields: ["id", "title", "description", "publish_at", "sort_order", "is_active", "created_at", "updated_at"],
    },
    {
      route: "material-classes",
      table: "material_classes",
      idColumn: "id",
      columns: {
        code: { type: "string", required: true, max: 50 },
        name: { type: "string", required: true, max: 255 },
      },
    },
    {
      route: "linear-materials",
      table: "linear_materials",
      idColumn: "id",
      columns: {
        name: { type: "string", required: true, max: 255 },
        sku: { type: "string", max: 255 },
        unit_id: { type: "integer" },
        material_class_id: { type: "integer" },
        price_per_unit: { type: "number", precision: 2 },
        edge_price_per_m: { type: "number", precision: 2 },
        purpose: { type: "string", allowNull: true },
        comment: { type: "string", allowNull: true },
        length_mm: { type: "integer" },
        width_mm: { type: "integer" },
        price_per_piece: { type: "number", precision: 2 },
        is_active: { type: "boolean" },
      },
    },
    {
      route: "sheet-materials",
      table: "sheet_materials",
      idColumn: "id",
      columns: {
        name: { type: "string", required: true, max: 255 },
        sku: { type: "string", max: 255 },
        unit_id: { type: "integer" },
        material_class_id: { type: "integer" },
        price_per_m2: { type: "number", precision: 2 },
        edge_price_per_m: { type: "number", precision: 2 },
        purpose: { type: "string", allowNull: true },
        hardware_color: { type: "string", allowNull: true },
        texture_url: { type: "string", allowNull: true },
        comment: { type: "string", allowNull: true },
        sheet_length_mm: { type: "integer" },
        sheet_width_mm: { type: "integer" },
        price_per_sheet: { type: "number", precision: 2 },
        coefficient: { type: "number", precision: 4 },
        is_active: { type: "boolean" },
      },
    },
    {
      route: "hardware-extended",
      table: "hardware_items_extended",
      idColumn: "id",
      columns: {
        base_sku: { type: "string", max: 50 },
        name: { type: "string", required: true, max: 255 },
        sku: { type: "string", max: 255 },
        unit_id: { type: "integer" },
        material_class_id: { type: "integer" },
        price_per_unit: { type: "number", precision: 2 },
        comment: { type: "string", allowNull: true },
        primary_color_id: { type: "integer" },
        secondary_color_id: { type: "integer" },
        is_active: { type: "boolean" },
      },
    },
    {
      route: "calculation-parameters",
      table: "calculation_parameters",
      idColumn: "id",
      columns: {
        name: { type: "string", required: true, max: 255 },
        value: { type: "string", allowNull: true },
        numeric_value: { type: "number", precision: 4 },
        comment: { type: "string", allowNull: true },
      },
    },
    {
      route: "colors",
      table: "colors",
      idColumn: "id",
      columns: {
        name: { type: "string", required: true, max: 255 },
        sku: { type: "string", max: 255 },
        type: { type: "string", enum: ["facade", "corpus", ""], allowNull: true },
        image_url: { type: "string", allowNull: true },
        is_active: { type: "boolean" },
      },
    },
    {
      route: "collections",
      table: "collections",
      idColumn: "id",
      columns: {
        name: { type: "string", required: true, max: 255 },
        sku: { type: "string", max: 255, allowNull: true },
        image_url: { type: "string", allowNull: true },
        is_active: { type: "boolean" },
      },
    },
    {
      route: "product-parameters",
      table: "product_parameters",
      idColumn: "id",
      columns: {
        name: { type: "string", required: true, max: 255 },
      },
    },
    {
      route: "product-parameter-categories",
      table: "product_parameter_categories",
      idColumn: "id",
      columns: {
        name: { type: "string", required: true, max: 255 },
      },
    },
    {
      route: "kit-solutions",
      table: "kit_solutions",
      idColumn: "id",
      columns: {
        public_id: { type: "string", max: 100, allowNull: true },
        name: { type: "string", required: true, max: 255 },
        base_sku: { type: "string", max: 255, allowNull: true },
        sku: { type: "string", max: 255 },
        description: { type: "string", allowNull: true },
        total_length_mm: { type: "integer" },
        total_depth_mm: { type: "integer" },
        total_height_mm: { type: "integer" },
        primary_color_id: { type: "integer" },
        secondary_color_id: { type: "integer" },
        material_id: { type: "integer" },
        countertop_length_mm: { type: "integer" },
        countertop_depth_mm: { type: "integer" },
        base_price: { type: "number", precision: 2 },
        final_price: { type: "number", precision: 2 },
        preview_url: { type: "string", allowNull: true },
        collection_id: { type: "integer" },
        is_active: { type: "boolean" },
      },
      beforeCreate: async (payload) => {
        const next = { ...payload };
        if (!next.public_id) {
          next.public_id = crypto.randomUUID();
        }
        return next;
      },
      beforeUpdate: async (payload) => {
        const next = { ...payload };
        if (Object.prototype.hasOwnProperty.call(next, "public_id")) {
          delete next.public_id;
        }
        return next;
      },
    },
    {
      route: "catalog-items",
      table: "catalog_items",
      idColumn: "id",
      columns: {
        public_id: { type: "string", max: 100, allowNull: true },
        base_sku: { type: "string", max: 255, allowNull: true },
        sku: { type: "string", max: 255, allowNull: true },
        name: { type: "string", required: true, max: 255 },
        description: { type: "string", allowNull: true },
        category_group: { type: "string", max: 255, allowNull: true },
        category: { type: "string", max: 255, allowNull: true },
        primary_color_id: { type: "integer" },
        secondary_color_id: { type: "integer" },
        length_mm: { type: "integer" },
        depth_mm: { type: "integer" },
        height_mm: { type: "integer" },
        base_price: { type: "number", precision: 2 },
        final_price: { type: "number", precision: 2 },
        preview_url: { type: "string", allowNull: true },
        collection_id: { type: "integer" },
        is_active: { type: "boolean" },
      },
      beforeCreate: async (payload) => {
        const next = { ...payload };
        if (!next.public_id) {
          next.public_id = crypto.randomUUID();
        }
        if (!next.sku) {
          let primaryColor = null;
          if (next.primary_color_id) {
            const { rows } = await query(`SELECT sku FROM colors WHERE id = $1`, [next.primary_color_id]);
            primaryColor = rows?.[0]?.sku || null;
          }
          let secondaryColor = null;
          if (next.secondary_color_id) {
            const { rows } = await query(`SELECT sku FROM colors WHERE id = $1`, [next.secondary_color_id]);
            secondaryColor = rows?.[0]?.sku || null;
          }

          const articleName = next.base_sku || next.name;
          const generated = buildArticle({
            category: null,
            section: null,
            subcategory: null,
            name: articleName,
            size1: next.length_mm,
            size2: next.depth_mm,
            size3: next.height_mm,
            primaryColor,
            secondaryColor,
          });
          if (generated) next.sku = generated;
        }
        return next;
      },
      beforeUpdate: async (payload) => {
        const next = { ...payload };
        if (Object.prototype.hasOwnProperty.call(next, "public_id")) {
          delete next.public_id;
        }
        const hasSkuInPayload = Object.prototype.hasOwnProperty.call(next, "sku") && next.sku;

        if (
          !hasSkuInPayload &&
          (next.base_sku || next.name || next.category_group || next.category || next.length_mm || next.depth_mm || next.height_mm || next.primary_color_id || next.secondary_color_id)
        ) {
          let primaryColor = null;
          if (next.primary_color_id) {
            const { rows } = await query(`SELECT sku FROM colors WHERE id = $1`, [next.primary_color_id]);
            primaryColor = rows?.[0]?.sku || null;
          }
          let secondaryColor = null;
          if (next.secondary_color_id) {
            const { rows } = await query(`SELECT sku FROM colors WHERE id = $1`, [next.secondary_color_id]);
            secondaryColor = rows?.[0]?.sku || null;
          }

          const articleName = next.base_sku || next.name;
          const generated = buildArticle({
            category: null,
            section: null,
            subcategory: null,
            name: articleName,
            size1: next.length_mm,
            size2: next.depth_mm,
            size3: next.height_mm,
            primaryColor,
            secondaryColor,
          });
          if (generated) next.sku = generated;
        }
        return next;
      },
    },
    {
      route: "kit-solution-modules",
      table: "kit_solution_modules",
      idColumn: "id",
      columns: {
        kit_solution_id: { type: "integer", required: true },
        module_id: { type: "integer", required: true },
        position_order: { type: "integer" },
        position_type: { type: "string", allowNull: true },
      },
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

