const ApiError = require("../utils/api-error");
const crudService = require("../services/crud.service");
const path = require("path");
const fs = require("fs");
const config = require("../config/env");
const productParametersService = require("../services/product-parameters.service");
const productParameterCategoriesService = require("../services/product-parameter-categories.service");

const normalizeSkuForFolder = (sku) => {
  const transliterate = (str) => {
    const cyrillic = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
      'з': 'z', 'и': 'i', 'й': 'j', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
      'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
      'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
      'я': 'ya'
    };
    return String(str || "")
      .toLowerCase()
      .split("")
      .map((char) => cyrillic[char] || char)
      .join("")
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_");
  };

  return transliterate(sku);
};

const legacySkuFolder = (sku) => {
  return String(sku || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_");
};

const legacyUnicodeFolder = (sku) => {
  return String(sku || "")
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, "_")
    .replace(/\s+/g, "_");
};

const getModuleFolderCandidates = (sku) => {
  const preferred = normalizeSkuForFolder(sku);
  const legacy = legacySkuFolder(sku);
  const unicodeLegacy = legacyUnicodeFolder(sku);
  return Array.from(new Set([preferred, legacy, unicodeLegacy].filter(Boolean)));
};

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
    
    // Для модулей добавляем preview_url из первого изображения и данные о цветах
    if (entity.route === "modules" && Array.isArray(data)) {
      const { query } = require("../config/db");
      const ids = data.map((item) => item.id).filter(Boolean);

      if (ids.length > 0) {
        const { rows: imageRows } = await query(
          `SELECT DISTINCT ON (entity_id) id, entity_id, url
           FROM images
           WHERE entity_type = 'modules' AND entity_id = ANY($1::int[])
           ORDER BY entity_id, (sort_order IS NULL) ASC, sort_order ASC, id ASC`,
          [ids]
        );

        const imageByEntity = new Map(imageRows.map((row) => [row.entity_id, row]));
        for (const item of data) {
          const row = imageByEntity.get(item.id);
          if (!row?.url) continue;

          let previewUrl = row.url;
          if (previewUrl && item?.sku && previewUrl.startsWith("/uploads/modules/")) {
            const match = previewUrl.match(/^\/uploads\/modules\/([^/]+)\/(.+)$/);
            const correctFolder = normalizeSkuForFolder(item.sku);
            if (match && match[1] && match[2] && match[1] !== correctFolder) {
              const fixedUrl = `/uploads/modules/${correctFolder}/${match[2]}`;
              const relative = fixedUrl.replace(/^\/uploads\//, "");
              const fixedPath = path.join(config.uploadsDir, relative);
              const legacyPath = config.legacyUploadsDir ? path.join(config.legacyUploadsDir, relative) : null;
              if (fs.existsSync(fixedPath) || (legacyPath && fs.existsSync(legacyPath))) {
                await query(`UPDATE images SET url = $1 WHERE id = $2`, [fixedUrl, row.id]);
                previewUrl = fixedUrl;
              }
            }
          }

          item.preview_url = previewUrl;
        }
      }

      const colorIds = Array.from(
        new Set(
          data
            .flatMap((item) => [item.primary_color_id, item.secondary_color_id])
            .filter(Boolean)
            .map((v) => Number(v))
            .filter((v) => Number.isFinite(v))
        )
      );

      const colorSkus = Array.from(
        new Set(
          data
            .flatMap((item) => [item.facade_color, item.corpus_color])
            .filter(Boolean)
            .map((v) => String(v))
        )
      );

      if (colorIds.length > 0 || colorSkus.length > 0) {
        const { rows: colorRows } = await query(
          `SELECT id, name, sku, image_url
           FROM colors
           WHERE (cardinality($1::int[]) > 0 AND id = ANY($1::int[]))
              OR (cardinality($2::text[]) > 0 AND sku = ANY($2::text[]))`,
          [colorIds, colorSkus]
        );

        const byId = new Map(colorRows.map((row) => [row.id, row]));
        const bySku = new Map(colorRows.map((row) => [row.sku, row]));

        for (const item of data) {
          if (item.primary_color_id) {
            item.primary_color = byId.get(Number(item.primary_color_id));
          } else if (item.facade_color) {
            item.primary_color = bySku.get(String(item.facade_color));
          }

          if (item.secondary_color_id) {
            item.secondary_color = byId.get(Number(item.secondary_color_id));
          } else if (item.corpus_color) {
            item.secondary_color = bySku.get(String(item.corpus_color));
          }
        }
      }
    }
    
    // Для готовых решений добавляем данные о цветах
    if (entity.route === "kit-solutions" && Array.isArray(data)) {
      const { query } = require("../config/db");
      const colorIds = Array.from(
        new Set(
          data
            .flatMap((item) => [item.primary_color_id, item.secondary_color_id])
            .filter(Boolean)
            .map((v) => Number(v))
            .filter((v) => Number.isFinite(v))
        )
      );

      if (colorIds.length > 0) {
        const { rows: colorRows } = await query(
          `SELECT id, name, sku, image_url FROM colors WHERE id = ANY($1::int[])`,
          [colorIds]
        );
        const byId = new Map(colorRows.map((row) => [row.id, row]));
        for (const item of data) {
          if (item.primary_color_id) item.primary_color = byId.get(Number(item.primary_color_id));
          if (item.secondary_color_id) item.secondary_color = byId.get(Number(item.secondary_color_id));
        }
      }
    }
    
    // Для фурнитуры добавляем данные о цветах
    if (entity.route === "hardware-extended" && Array.isArray(data)) {
      const { query } = require("../config/db");
      const colorIds = Array.from(
        new Set(
          data
            .flatMap((item) => [item.primary_color_id, item.secondary_color_id])
            .filter(Boolean)
            .map((v) => Number(v))
            .filter((v) => Number.isFinite(v))
        )
      );

      if (colorIds.length > 0) {
        const { rows: colorRows } = await query(
          `SELECT id, name, sku, image_url FROM colors WHERE id = ANY($1::int[])`,
          [colorIds]
        );
        const byId = new Map(colorRows.map((row) => [row.id, row]));
        for (const item of data) {
          if (item.primary_color_id) item.primary_color = byId.get(Number(item.primary_color_id));
          if (item.secondary_color_id) item.secondary_color = byId.get(Number(item.secondary_color_id));
        }
      }
    }

    
    res.status(200).json({ data });
  };

  const getById = async (req, res) => {
    const data = await crudService.getById(entity, req.params.id);
    const { query } = require("../config/db");
    
    // Для модулей добавляем preview_url из первого изображения и данные о цветах
    if (entity.route === "modules") {
      const { rows: imageRows } = await query(
        `SELECT id, url FROM images 
         WHERE entity_type = 'modules' AND entity_id = $1 
         ORDER BY (sort_order IS NULL) ASC, sort_order ASC, id ASC LIMIT 1`,
        [data.id]
      );
      if (imageRows[0]) {
        let previewUrl = imageRows[0].url;
        if (previewUrl && data?.sku && previewUrl.startsWith("/uploads/modules/")) {
          const match = previewUrl.match(/^\/uploads\/modules\/([^/]+)\/(.+)$/);
          const folderCandidates = getModuleFolderCandidates(data.sku);
          if (match && match[1] && match[2]) {
            const currentFolder = match[1];
            const filename = match[2];
            let resolvedFolder = null;
            for (const candidate of folderCandidates) {
              const candidatePath = path.join(config.uploadsDir, "modules", candidate, filename);
              if (fs.existsSync(candidatePath)) {
                resolvedFolder = candidate;
                break;
              }
            }
            if (resolvedFolder && currentFolder !== resolvedFolder) {
              const fixedUrl = `/uploads/modules/${resolvedFolder}/${filename}`;
              await query(`UPDATE images SET url = $1 WHERE id = $2`, [fixedUrl, imageRows[0].id]);
              previewUrl = fixedUrl;
            }
          }
        }
        data.preview_url = previewUrl;
      }

      // Добавляем изображения модуля (чтобы фронт не дергал /images отдельно)
      const { rows: allImages } = await query(
        `SELECT id, url, alt, sort_order,
         (sort_order = 0) as is_preview
         FROM images
         WHERE entity_type = 'modules' AND entity_id = $1
         ORDER BY (sort_order IS NULL) ASC, sort_order ASC, id ASC`,
        [data.id]
      );

      if (Array.isArray(allImages) && data?.sku) {
        const folderCandidates = getModuleFolderCandidates(data.sku);
        for (const img of allImages) {
          if (!img?.url || !img.url.startsWith("/uploads/modules/")) continue;
          const match = img.url.match(/^\/uploads\/modules\/([^/]+)\/(.+)$/);
          if (!match) continue;
          const currentFolder = match[1];
          const filename = match[2];
          if (!filename) continue;

          let resolvedFolder = null;
          for (const candidate of folderCandidates) {
            const candidatePath = path.join(config.uploadsDir, "modules", candidate, filename);
            if (fs.existsSync(candidatePath)) {
              resolvedFolder = candidate;
              break;
            }
          }
          if (!resolvedFolder || currentFolder === resolvedFolder) continue;

          const fixedUrl = `/uploads/modules/${resolvedFolder}/${filename}`;
          await query(`UPDATE images SET url = $1 WHERE id = $2`, [fixedUrl, img.id]);
          img.url = fixedUrl;
        }
      }

      data.images = allImages;
      
      // Добавляем данные о цветах
      if (data.primary_color_id) {
        const { rows: primaryColorRows } = await query(
          `SELECT id, name, sku, image_url FROM colors WHERE id = $1`,
          [data.primary_color_id]
        );
        if (primaryColorRows[0]) {
          data.primary_color = primaryColorRows[0];
        }
      } else if (data.facade_color) {
        const { rows: primaryColorRows } = await query(
          `SELECT id, name, sku, image_url FROM colors WHERE sku = $1 LIMIT 1`,
          [data.facade_color]
        );
        if (primaryColorRows[0]) {
          data.primary_color = primaryColorRows[0];
        }
      }
      
      if (data.secondary_color_id) {
        const { rows: secondaryColorRows } = await query(
          `SELECT id, name, sku, image_url FROM colors WHERE id = $1`,
          [data.secondary_color_id]
        );
        if (secondaryColorRows[0]) {
          data.secondary_color = secondaryColorRows[0];
        }
      } else if (data.corpus_color) {
        const { rows: secondaryColorRows } = await query(
          `SELECT id, name, sku, image_url FROM colors WHERE sku = $1 LIMIT 1`,
          [data.corpus_color]
        );
        if (secondaryColorRows[0]) {
          data.secondary_color = secondaryColorRows[0];
        }
      }
    }
    
    // Для готовых решений добавляем данные о цветах
    if (entity.route === "kit-solutions") {
      if (data.primary_color_id) {
        const { rows: primaryColorRows } = await query(
          `SELECT id, name, sku, image_url FROM colors WHERE id = $1`,
          [data.primary_color_id]
        );
        if (primaryColorRows[0]) {
          data.primary_color = primaryColorRows[0];
        }
      }
      
      if (data.secondary_color_id) {
        const { rows: secondaryColorRows } = await query(
          `SELECT id, name, sku, image_url FROM colors WHERE id = $1`,
          [data.secondary_color_id]
        );
        if (secondaryColorRows[0]) {
          data.secondary_color = secondaryColorRows[0];
        }
      }
    }
    
    // Для фурнитуры добавляем данные о цветах
    if (entity.route === "hardware-extended") {
      if (data.primary_color_id) {
        const { rows: primaryColorRows } = await query(
          `SELECT id, name, sku, image_url FROM colors WHERE id = $1`,
          [data.primary_color_id]
        );
        if (primaryColorRows[0]) {
          data.primary_color = primaryColorRows[0];
        }
      }
      
      if (data.secondary_color_id) {
        const { rows: secondaryColorRows } = await query(
          `SELECT id, name, sku, image_url FROM colors WHERE id = $1`,
          [data.secondary_color_id]
        );
        if (secondaryColorRows[0]) {
          data.secondary_color = secondaryColorRows[0];
        }
      }
    }

    if (entity.route === "modules" || entity.route === "catalog-items") {
      const entityType = entity.route;
      data.parameters = await productParametersService.getEntityParameters({ entityType, entityId: data.id });
      data.parameterCategories = await productParameterCategoriesService.getEntityCategories({ entityType, entityId: data.id });
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

    if (entity.route === "modules" || entity.route === "catalog-items") {
      const entityType = entity.route;
      const params = req.body?.parameters;
      if (Array.isArray(params)) {
        data.parameters = await productParametersService.setEntityParameters({
          entityType,
          entityId: data.id,
          items: params,
        });
      } else {
        data.parameters = await productParametersService.getEntityParameters({ entityType, entityId: data.id });
      }

      const cats = req.body?.parameterCategories;
      if (Array.isArray(cats)) {
        data.parameterCategories = await productParameterCategoriesService.setEntityCategories({
          entityType,
          entityId: data.id,
          items: cats,
        });
      } else {
        data.parameterCategories = await productParameterCategoriesService.getEntityCategories({ entityType, entityId: data.id });
      }
    }
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

    if (entity.route === "modules" || entity.route === "catalog-items") {
      const entityType = entity.route;
      const params = req.body?.parameters;
      if (Array.isArray(params)) {
        data.parameters = await productParametersService.setEntityParameters({
          entityType,
          entityId: data.id,
          items: params,
        });
      } else {
        data.parameters = await productParametersService.getEntityParameters({ entityType, entityId: data.id });
      }

      const cats = req.body?.parameterCategories;
      if (Array.isArray(cats)) {
        data.parameterCategories = await productParameterCategoriesService.setEntityCategories({
          entityType,
          entityId: data.id,
          items: cats,
        });
      } else {
        data.parameterCategories = await productParameterCategoriesService.getEntityCategories({ entityType, entityId: data.id });
      }
    }
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

