const ApiError = require("../utils/api-error");
const crudService = require("../services/crud.service");

const validatePayload = (schema, payload) => {
  if (!schema) {
    return { value: payload };
  }
  return schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });
};

const createCrudController = (entity) => {
  const list = async (req, res) => {
    const data = await crudService.list(entity, req.query);
    
    // Для модулей добавляем preview_url из первого изображения
    if (entity.route === "modules" && Array.isArray(data)) {
      const { query } = require("../config/db");
      for (const item of data) {
        const { rows: imageRows } = await query(
          `SELECT url FROM images 
           WHERE entity_type = 'modules' AND entity_id = $1 
           ORDER BY sort_order ASC, id ASC LIMIT 1`,
          [item.id]
        );
        if (imageRows[0]) {
          item.preview_url = imageRows[0].url;
        }
      }
    }
    
    res.status(200).json({ data });
  };

  const getById = async (req, res) => {
    const data = await crudService.getById(entity, req.params.id);
    
    // Для модулей добавляем preview_url из первого изображения
    if (entity.route === "modules") {
      const { query } = require("../config/db");
      const { rows: imageRows } = await query(
        `SELECT url FROM images 
         WHERE entity_type = 'modules' AND entity_id = $1 
         ORDER BY sort_order ASC, id ASC LIMIT 1`,
        [data.id]
      );
      if (imageRows[0]) {
        data.preview_url = imageRows[0].url;
      }
    }
    
    res.status(200).json({ data });
  };

  const create = async (req, res) => {
    const { error, value } = validatePayload(entity.createSchema, req.body);
    if (error) {
      throw ApiError.badRequest("Validation failed", error.details);
    }

    const payload = entity.beforeCreate
      ? await entity.beforeCreate(value, req)
      : value;

    const data = await crudService.create(entity, payload);
    res.status(201).json({ data });
  };

  const update = async (req, res) => {
    const { error, value } = validatePayload(entity.updateSchema, req.body);
    if (error) {
      throw ApiError.badRequest("Validation failed", error.details);
    }

    const payload = entity.beforeUpdate
      ? await entity.beforeUpdate(value, req)
      : value;

    const data = await crudService.update(entity, req.params.id, payload);
    res.status(200).json({ data });
  };

  const remove = async (req, res) => {
    await crudService.remove(entity, req.params.id);
    res.status(204).send();
  };

  return {
    list,
    getById,
    create,
    update,
    remove,
  };
};

module.exports = createCrudController;

