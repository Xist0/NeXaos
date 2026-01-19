const ApiError = require("../utils/api-error");
const { query } = require("../config/db");
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");
const config = require("../config/env");

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
      .split('')
      .map(char => cyrillic[char] || char)
      .join('')
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_');
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

const resolveExistingModuleFolder = (sku) => {
  const candidates = getModuleFolderCandidates(sku);
  for (const folder of candidates) {
    const folderPath = path.join(config.uploadsDir, "modules", folder);
    if (fs.existsSync(folderPath)) {
      return folder;
    }
  }
  return normalizeSkuForFolder(sku);
};

/**
 * Получает полные данные модуля для формирования имени файла
 * @param {number} moduleId - ID модуля
 * @returns {Promise<Object|null>} Объект с данными модуля или null
 */
const getModuleData = async (moduleId) => {
  const { rows } = await query(
    `SELECT name, sku, facade_color, corpus_color FROM modules WHERE id = $1`,
    [moduleId]
  );
  return rows[0] || null;
};

/**
 * Получает путь к папке для сохранения изображений модуля
 * @param {string} sku - Артикул модуля
 * @returns {string} Путь к папке модуля
 */
const getModuleUploadPath = (sku) => {
  const folder = resolveExistingModuleFolder(sku);
  return path.join(config.uploadsDir, "modules", folder);
};

/**
 * Формирует безопасное имя для файловой системы из строки
 * Заменяет все недопустимые символы на подчеркивания
 * @param {string} str - Исходная строка
 * @returns {string} Безопасное имя
 */
const sanitizeFilename = (str) => {
  if (!str) return "";
  // Заменяем пробелы и недопустимые символы на подчеркивания
  return str.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, "_").replace(/\s+/g, "_");
};

/**
 * Формирует имя файла изображения на основе данных модуля
 * Формат: Название_Артикул_цвет_номер.расширение
 * @param {Object} moduleData - Данные модуля (name, sku, facade_color, corpus_color)
 * @param {number} sortOrder - Порядок изображения (0 для превью, затем 1, 2, 3...)
 * @param {string} ext - Расширение файла
 * @returns {string} Имя файла
 */
const getImageFilename = (moduleData, sortOrder, ext) => {
  // Транслитерируем кириллицу в латиницу
  const transliterate = (str) => {
    const cyrillic = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
      'з': 'z', 'и': 'i', 'й': 'j', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
      'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
      'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
      'я': 'ya'
    };
    return str
      .toLowerCase()
      .split('')
      .map(char => cyrillic[char] || char)
      .join('')
      .replace(/[^a-z0-9_-]/g, '_')  // Только безопасные символы
      .replace(/_+/g, '_');           // Убираем многократные подчеркивания
  };

  const parts = [
    transliterate(moduleData.name || 'image'),
    transliterate(moduleData.sku || ''),
    transliterate(moduleData.facade_color || moduleData.corpus_color || ''),
    String(sortOrder + 1)
  ];
  
  return parts.filter(Boolean).join('_') + ext;
};

/**
 * Формирует URL изображения для модуля
 * @param {Object} moduleData - Данные модуля
 * @param {number} sortOrder - Порядок изображения
 * @param {string} ext - Расширение файла
 * @returns {string} URL изображения
 */
const getImageUrl = (moduleData, sortOrder, ext) => {
  if (!moduleData || !moduleData.sku) {
    return `/uploads/image_${Date.now()}${ext}`;
  }
  const safeSku = resolveExistingModuleFolder(moduleData.sku);
  const filename = getImageFilename(moduleData, sortOrder, ext);
  return `/uploads/modules/${safeSku}/${filename}`;
};

/**
 * Переименовывает все изображения модуля после изменения порядка
 * Использует новую схему именования: Название_Артикул_цвет_номер
 * @param {string} entityType - Тип сущности (должно быть "modules")
 * @param {number} entityId - ID модуля
 * @param {Object} moduleData - Данные модуля (name, sku, facade_color, corpus_color)
 */
const renameModuleImages = async (entityType, entityId, moduleData) => {
  if (entityType !== "modules" || !moduleData || !moduleData.sku) {
    return;
  }

  // Получаем все изображения модуля, отсортированные по sort_order
  const { rows: images } = await query(
    `SELECT id, url, sort_order FROM images 
     WHERE entity_type = $1 AND entity_id = $2 
     ORDER BY sort_order ASC, id ASC`,
    [entityType, entityId]
  );

  if (images.length === 0) {
    return;
  }

  // Получаем путь к папке модуля на основе SKU
  const moduleDir = getModuleUploadPath(moduleData.sku);
  if (!fs.existsSync(moduleDir)) {
    fs.mkdirSync(moduleDir, { recursive: true });
  }

  // Сначала переименовываем все файлы во временные имена, чтобы избежать конфликтов
  const tempRenames = [];
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const oldUrl = image.url;
    let oldPath = oldUrl.startsWith("/") 
      ? path.join(config.uploadsDir, oldUrl.replace(/^\/?uploads\//, ""))
      : path.join(config.uploadsDir, String(oldUrl).replace(/^uploads\//, ""));

    if (!fs.existsSync(oldPath)) {
      const candidate = path.join(moduleDir, path.basename(oldPath));
      if (fs.existsSync(candidate)) {
        oldPath = candidate;
      } else {
        continue; // Файл не существует, пропускаем
      }
    }

    // Определяем расширение файла
    const ext = path.extname(oldPath) || ".jpg";
    // Первое изображение - превью (sort_order = 0), остальные по порядку
    const newSortOrder = i === 0 ? 0 : i;
    // Формируем новое имя файла на основе данных модуля
    const newFilename = getImageFilename(moduleData, newSortOrder, ext);
    const newPath = path.join(moduleDir, newFilename);
    const newUrl = getImageUrl(moduleData, newSortOrder, ext);

    // Если файл уже на правильном месте, пропускаем переименование
    if (oldPath === newPath && oldUrl === newUrl && image.sort_order === newSortOrder) {
      continue;
    }

    // Создаем временное имя для безопасного переименования
    const tempPath = path.join(moduleDir, `temp_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 9)}${ext}`);
    
    try {
      // Перемещаем во временный файл
      fs.renameSync(oldPath, tempPath);
      tempRenames.push({
        imageId: image.id,
        tempPath,
        newPath,
        newUrl,
        newSortOrder,
        oldUrl
      });
    } catch (err) {
      console.warn(`Не удалось переместить файл ${oldPath} во временный:`, err.message);
      // Пытаемся вернуть файл на место
      if (fs.existsSync(tempPath)) {
        try {
          fs.renameSync(tempPath, oldPath);
        } catch (restoreErr) {
          console.error(`Не удалось восстановить файл ${oldPath}:`, restoreErr.message);
        }
      }
    }
  }

  // Теперь переименовываем временные файлы в финальные имена
  for (const rename of tempRenames) {
    try {
      // Если целевой файл уже существует (старое изображение), удаляем его
      if (fs.existsSync(rename.newPath) && rename.tempPath !== rename.newPath) {
        fs.unlinkSync(rename.newPath);
      }
      // Переименовываем временный файл в финальный
      fs.renameSync(rename.tempPath, rename.newPath);
      
      // Обновляем URL и sort_order в БД
      await query(`UPDATE images SET url = $1, sort_order = $2 WHERE id = $3`, 
        [rename.newUrl, rename.newSortOrder, rename.imageId]);
    } catch (err) {
      console.warn(`Не удалось переименовать временный файл ${rename.tempPath} в ${rename.newPath}:`, err.message);
      // Пытаемся вернуть файл на старое место
      const oldPath = rename.oldUrl.startsWith("/") 
        ? path.join(config.uploadsDir, rename.oldUrl.replace(/^\/?uploads\//, ""))
        : path.join(config.uploadsDir, String(rename.oldUrl).replace(/^uploads\//, ""));
      try {
        if (fs.existsSync(rename.tempPath)) {
          fs.renameSync(rename.tempPath, oldPath);
        }
      } catch (restoreErr) {
        console.error(`Не удалось восстановить файл:`, restoreErr.message);
      }
    }
  }
};

/**
 * Получить все изображения для сущности (модуля, материала и т.д.)
 * @param {Object} req - Объект запроса Express
 * @param {Object} res - Объект ответа Express
 */
const getImages = async (req, res) => {
  const { entityType, entityId } = req.params;
  
  if (!entityType || !entityId) {
    logger.warn("Попытка получить изображения без указания типа сущности или ID", {
      entityType,
      entityId,
      user: req.user?.id || 'guest',
    });
    throw ApiError.badRequest("Не указаны тип сущности или ID");
  }

  const parsedId = parseInt(entityId, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    logger.warn("Некорректный ID сущности при запросе изображений", {
      entityType,
      entityId,
      user: req.user?.id || 'guest',
    });
    throw ApiError.badRequest("Некорректный ID сущности");
  }

  // Получаем все изображения для указанной сущности
  const { rows } = await query(
    `SELECT id, url, alt, sort_order, 
     (sort_order = 0) as is_preview
     FROM images 
     WHERE entity_type = $1 AND entity_id = $2 
     ORDER BY (sort_order IS NULL) ASC, sort_order ASC, id ASC`,
    [entityType, parsedId]
  );

  if (entityType === "modules") {
    try {
      const moduleData = await getModuleData(parsedId);
      if (moduleData?.sku) {
        const folderCandidates = getModuleFolderCandidates(moduleData.sku);
        await Promise.all(
          rows.map(async (row) => {
            if (!row?.url || !row.url.startsWith("/uploads/modules/")) return;

            const match = row.url.match(/^\/uploads\/modules\/([^/]+)\/(.+)$/);
            if (!match) return;

            const currentFolder = match[1];
            const filename = match[2];
            if (!filename) return;

            let resolvedFolder = null;
            for (const candidate of folderCandidates) {
              const candidatePath = path.join(
                __dirname,
                "..",
                "public",
                "uploads",
                "modules",
                candidate,
                filename
              );
              if (fs.existsSync(candidatePath)) {
                resolvedFolder = candidate;
                break;
              }
            }

            if (!resolvedFolder) return;
            if (currentFolder === resolvedFolder) return;

            const fixedUrl = `/uploads/modules/${resolvedFolder}/${filename}`;
            await query(`UPDATE images SET url = $1 WHERE id = $2`, [fixedUrl, row.id]);
            row.url = fixedUrl;
          })
        );
      }
    } catch (e) {
      logger.warn("Не удалось автоматически исправить URL изображений модуля", {
        moduleId: parsedId,
        error: e?.message,
      });
    }
  }

  // Логируем успешное получение списка изображений
  logger.info("Получен список изображений", {
    entityType,
    entityId: parsedId,
    count: rows.length,
    user: req.user?.id || 'guest',
  });

  res.status(200).json({ data: rows });
};

/**
 * Загрузить новое изображение для сущности
 * Для модулей использует схему именования: Название_Артикул_цвет_номер
 * @param {Object} req - Объект запроса Express с файлом в req.file
 * @param {Object} res - Объект ответа Express
 */
const uploadImage = async (req, res) => {
  // Проверяем наличие загруженного файла
  if (!req.file) {
    logger.warn("Попытка загрузки изображения без файла", {
      user: req.user?.id,
      role: req.user?.roleName,
    });
    throw ApiError.badRequest("Файл не получен");
  }

  const { entityType, entityId } = req.body;
  
  // Валидация обязательных полей
  if (!entityType || !entityId) {
    // Удаляем загруженный файл если нет данных
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    logger.warn("Попытка загрузки изображения без указания типа сущности или ID", {
      entityType,
      entityId,
      user: req.user?.id,
      role: req.user?.roleName,
      filename: req.file?.originalname,
    });
    throw ApiError.badRequest("Не указаны тип сущности или ID");
  }

  // Валидация ID сущности
  const parsedId = parseInt(entityId, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    logger.warn("Попытка загрузки изображения с некорректным ID сущности", {
      entityType,
      entityId,
      user: req.user?.id,
      role: req.user?.roleName,
      filename: req.file?.originalname,
    });
    throw ApiError.badRequest("Некорректный ID сущности");
  }

  // Для модулей получаем полные данные (название, артикул, цвета)
  let moduleData = null;
  let uploadDir = config.uploadsDir;
  let urlPath = "";

  if (entityType === "modules") {
    moduleData = await getModuleData(parsedId);
    if (!moduleData) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      throw ApiError.badRequest("Модуль не найден");
    }
    
    // Если у модуля нет SKU, используем ID как временный идентификатор
    if (!moduleData.sku) {
      logger.warn("Модуль не имеет артикула, используем ID для имени файла", {
        moduleId: parsedId,
        moduleName: moduleData.name,
      });
      // Создаем временный SKU на основе ID
      moduleData.sku = `MODULE_${parsedId}`;
    }
    
    const resolvedFolder = resolveExistingModuleFolder(moduleData.sku);
    uploadDir = path.join(config.uploadsDir, "modules", resolvedFolder);
    // Создаем папку если её нет
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    logger.info("Получены данные модуля для загрузки изображения", {
      moduleId: parsedId,
      sku: moduleData.sku,
      name: moduleData.name,
      facadeColor: moduleData.facade_color,
      corpusColor: moduleData.corpus_color,
    });
  }

  // Определяем порядок изображения (sort_order)
  // Если это первое изображение сущности - sort_order = 0 (превью)
  // Иначе - максимальный sort_order + 1
  const { rows: existing } = await query(
    `SELECT MAX(sort_order) as max_order FROM images 
     WHERE entity_type = $1 AND entity_id = $2`,
    [entityType, parsedId]
  );
  
  const sortOrder = existing[0]?.max_order != null ? existing[0].max_order + 1 : 0;

  // Определяем расширение файла
  const ext = path.extname(req.file.originalname) || path.extname(req.file.filename) || ".jpg";
  
  // Формируем имя файла в зависимости от типа сущности
  let newFilename;
  if (entityType === "modules" && moduleData) {
    // Для модулей используем новую схему: Название_Артикул_цвет_номер
    newFilename = getImageFilename(moduleData, sortOrder, ext);
    const folder = resolveExistingModuleFolder(moduleData.sku);
    urlPath = `/uploads/modules/${folder}/${newFilename}`;
  } else {
    // Для других типов сущностей используем старую схему
    const timestamp = Date.now();
    newFilename = `${entityType}_${parsedId}_${sortOrder}_${timestamp}${ext}`;
    urlPath = `/uploads/${newFilename}`;
  }

  const newPath = path.join(uploadDir, newFilename);
  
  // Перемещаем файл в нужную папку с правильным именем
  try {
    if (fs.existsSync(req.file.path)) {
      // Если целевой файл уже существует, удаляем его
      if (fs.existsSync(newPath) && req.file.path !== newPath) {
        logger.warn("Целевой файл уже существует, удаляем его", { newPath });
        fs.unlinkSync(newPath);
      }
      
      // Переименовываем файл
      fs.renameSync(req.file.path, newPath);
      logger.info("Файл успешно переименован", {
        oldPath: req.file.path,
        newPath,
        newFilename,
      });
    } else {
      logger.warn("Исходный файл не найден", { path: req.file.path });
    }
  } catch (err) {
    logger.error("Ошибка при переименовании файла", {
      oldPath: req.file.path,
      newPath,
      error: err.message,
      stack: err.stack,
    });
    // Если не удалось переименовать, удаляем временный файл
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    throw ApiError.internal(`Не удалось сохранить файл: ${err.message}`);
  }

  // Сохраняем запись в БД
  const { rows } = await query(
    `INSERT INTO images (entity_type, entity_id, url, alt, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, url, alt, sort_order`,
    [entityType, parsedId, urlPath, req.body.alt || null, sortOrder]
  );

  // Логируем успешную загрузку
  logger.info("Изображение успешно загружено", {
    imageId: rows[0].id,
    entityType,
    entityId: parsedId,
    sku: moduleData?.sku || null,
    name: moduleData?.name || null,
    color: moduleData?.facade_color || moduleData?.corpus_color || null,
    url: urlPath,
    sortOrder,
    isPreview: sortOrder === 0,
    fileSize: req.file.size,
    mimetype: req.file.mimetype,
    user: req.user?.id,
    role: req.user?.roleName,
    userName: req.user?.fullName || req.user?.email,
  });

  res.status(201).json({ data: rows[0] });
};

/**
 * Удалить изображение
 * @param {Object} req - Объект запроса Express
 * @param {Object} res - Объект ответа Express
 */
const deleteImage = async (req, res) => {
  const { id } = req.params;
  
  // Валидация ID изображения
  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    logger.warn("Попытка удаления изображения с некорректным ID", {
      imageId: id,
      user: req.user?.id,
      role: req.user?.roleName,
    });
    throw ApiError.badRequest("Некорректный ID изображения");
  }

  // Получаем информацию об изображении для удаления файла
  const { rows: imageRows } = await query(
    `SELECT url, entity_type, entity_id FROM images WHERE id = $1`,
    [parsedId]
  );

  if (!imageRows[0]) {
    logger.warn("Попытка удаления несуществующего изображения", {
      imageId: parsedId,
      user: req.user?.id,
      role: req.user?.roleName,
    });
    throw ApiError.notFound("Изображение не найдено");
  }

  const { url, entity_type, entity_id } = imageRows[0];

  // Удаляем файл из файловой системы
  const urlPath = url.startsWith("/") ? url.slice(1) : url;
  const filePath = path.join(config.uploadsDir, urlPath.replace(/^uploads\//, ""));
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.warn(`Не удалось удалить файл ${filePath}:`, err.message);
    }
  }

  // Удаляем запись из БД
  await query(`DELETE FROM images WHERE id = $1`, [parsedId]);

  // Если это модуль, переименовываем оставшиеся изображения
  // для сохранения правильной нумерации
  if (entity_type === "modules") {
    const moduleData = await getModuleData(entity_id);
    if (moduleData && moduleData.sku) {
      await renameModuleImages(entity_type, entity_id, moduleData);
    }
  }

  logger.info("Изображение успешно удалено", {
    imageId: parsedId,
    entityType: entity_type,
    entityId: entity_id,
    url,
    user: req.user?.id,
    role: req.user?.roleName,
    userName: req.user?.fullName || req.user?.email,
  });

  res.status(204).send();
};

/**
 * Изменить порядок изображений
 * @param {Object} req - Объект запроса Express с массивом imageIds в теле
 * @param {Object} res - Объект ответа Express
 */
const reorderImages = async (req, res) => {
  const { imageIds } = req.body; // массив ID в нужном порядке

  if (!Array.isArray(imageIds) || imageIds.length === 0) {
    logger.warn("Попытка изменения порядка изображений без массива ID", {
      imageIds,
      user: req.user?.id,
      role: req.user?.roleName,
    });
    throw ApiError.badRequest("Не указан массив ID изображений");
  }

  // Валидация: все элементы массива должны быть положительными числами
  const invalidIds = imageIds.filter(id => {
    const parsed = parseInt(id, 10);
    return isNaN(parsed) || parsed <= 0;
  });
  
  if (invalidIds.length > 0) {
    logger.warn("Попытка изменения порядка с некорректными ID изображений", {
      invalidIds,
      user: req.user?.id,
      role: req.user?.roleName,
    });
    throw ApiError.badRequest("Массив содержит некорректные ID изображений");
  }

  // Получаем информацию о первом изображении для определения entity_type и entity_id
  const firstImgId = parseInt(imageIds[0], 10);
  if (isNaN(firstImgId) || firstImgId <= 0) {
    throw ApiError.badRequest("Некорректный ID изображения");
  }

  const { rows: firstImage } = await query(
    `SELECT entity_type, entity_id FROM images WHERE id = $1`,
    [firstImgId]
  );

  if (!firstImage[0]) {
    throw ApiError.notFound("Изображение не найдено");
  }

  const { entity_type, entity_id } = firstImage[0];

  // Обновляем sort_order для каждого изображения
  for (let i = 0; i < imageIds.length; i++) {
    const imgId = parseInt(imageIds[i], 10);
    if (isNaN(imgId) || imgId <= 0) continue;
    
    const newSortOrder = i === 0 ? 0 : i; // Первое изображение - превью (0)
    await query(
      `UPDATE images SET sort_order = $1 WHERE id = $2`,
      [newSortOrder, imgId]
    );
  }

  // Если это модуль, переименовываем файлы в соответствии с новым порядком
  if (entity_type === "modules") {
    const moduleData = await getModuleData(entity_id);
    if (moduleData && moduleData.sku) {
      await renameModuleImages(entity_type, entity_id, moduleData);
    }
  }

  // Логируем изменение порядка
  logger.info("Порядок изображений изменен", {
    entityType: entity_type,
    entityId: entity_id,
    imageIds,
    count: imageIds.length,
    user: req.user?.id,
    role: req.user?.roleName,
    userName: req.user?.fullName || req.user?.email,
  });

  res.status(200).json({ message: "Порядок изображений обновлен" });
};

/**
 * Установить изображение как превью (sort_order = 0)
 * @param {Object} req - Объект запроса Express
 * @param {Object} res - Объект ответа Express
 */
const setPreview = async (req, res) => {
  const { id } = req.params;
  
  // Валидация ID изображения
  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    throw ApiError.badRequest("Некорректный ID изображения");
  }

  // Получаем информацию об изображении (тип сущности и ID сущности)
  const { rows: imageRows } = await query(
    `SELECT entity_type, entity_id FROM images WHERE id = $1`,
    [parsedId]
  );

  if (!imageRows[0]) {
    throw ApiError.notFound("Изображение не найдено");
  }

  const { entity_type, entity_id } = imageRows[0];

  // Получаем текущий sort_order выбранного изображения
  const { rows: currentImage } = await query(
    `SELECT sort_order FROM images WHERE id = $1`,
    [parsedId]
  );
  const currentSortOrder = currentImage[0]?.sort_order;

  // Если изображение уже является превью, ничего не делаем
  if (currentSortOrder === 0) {
    return res.status(200).json({ message: "Изображение уже является превью" });
  }

  // Получаем все изображения сущности для правильного переупорядочивания
  const { rows: allImages } = await query(
    `SELECT id, sort_order FROM images 
     WHERE entity_type = $1 AND entity_id = $2 
     ORDER BY sort_order ASC, id ASC`,
    [entity_type, entity_id]
  );

  // Находим индекс выбранного изображения в списке
  const selectedIndex = allImages.findIndex(img => img.id === parsedId);
  if (selectedIndex === -1) {
    throw ApiError.notFound("Изображение не найдено");
  }

  // Переупорядочиваем: выбранное изображение становится первым (превью)
  // Остальные изображения сдвигаются вниз
  const reorderedImages = [
    allImages[selectedIndex],
    ...allImages.filter((_, idx) => idx !== selectedIndex)
  ];

  // Обновляем sort_order для всех изображений в соответствии с новым порядком
  for (let i = 0; i < reorderedImages.length; i++) {
    const newSortOrder = i === 0 ? 0 : i; // Первое изображение - превью (0)
    await query(
      `UPDATE images SET sort_order = $1 WHERE id = $2`,
      [newSortOrder, reorderedImages[i].id]
    );
  }

  // Если это модуль, переименовываем файлы в соответствии с новым порядком
  if (entity_type === "modules") {
    const moduleData = await getModuleData(entity_id);
    if (moduleData && moduleData.sku) {
      await renameModuleImages(entity_type, entity_id, moduleData);
    }
  }

  // Логируем установку превью
  logger.info("Превью изображения установлено", {
    imageId: parsedId,
    entityType: entity_type,
    entityId: entity_id,
    user: req.user?.id,
    role: req.user?.roleName,
    userName: req.user?.fullName || req.user?.email,
  });

  res.status(200).json({ message: "Превью установлено" });
};

module.exports = {
  getImages,
  uploadImage,
  deleteImage,
  reorderImages,
  setPreview,
};

