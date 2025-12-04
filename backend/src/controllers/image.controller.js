const ApiError = require("../utils/api-error");
const { query } = require("../config/db");
const path = require("path");
const fs = require("fs");

// Получить все изображения для сущности (модуля, материала и т.д.)
const getImages = async (req, res) => {
  const { entityType, entityId } = req.params;
  
  if (!entityType || !entityId) {
    throw ApiError.badRequest("Не указаны тип сущности или ID");
  }

  const parsedId = parseInt(entityId, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    throw ApiError.badRequest("Некорректный ID сущности");
  }

  const { rows } = await query(
    `SELECT id, url, alt, sort_order, 
     (sort_order = 0) as is_preview
     FROM images 
     WHERE entity_type = $1 AND entity_id = $2 
     ORDER BY sort_order ASC, id ASC`,
    [entityType, parsedId]
  );

  res.status(200).json({ data: rows });
};

// Загрузить изображение
const uploadImage = async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest("Файл не получен");
  }

  const { entityType, entityId } = req.body;
  
  if (!entityType || !entityId) {
    // Удаляем загруженный файл если нет данных
    fs.unlinkSync(req.file.path);
    throw ApiError.badRequest("Не указаны тип сущности или ID");
  }

  const parsedId = parseInt(entityId, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    fs.unlinkSync(req.file.path);
    throw ApiError.badRequest("Некорректный ID сущности");
  }

  // Определяем sort_order (максимальный + 1, или 0 если первое)
  const { rows: existing } = await query(
    `SELECT MAX(sort_order) as max_order FROM images 
     WHERE entity_type = $1 AND entity_id = $2`,
    [entityType, parsedId]
  );
  
  const sortOrder = existing[0]?.max_order != null ? existing[0].max_order + 1 : 0;

  const urlPath = `/uploads/${req.file.filename}`;

  const { rows } = await query(
    `INSERT INTO images (entity_type, entity_id, url, alt, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, url, alt, sort_order`,
    [entityType, parsedId, urlPath, req.body.alt || null, sortOrder]
  );

  res.status(201).json({ data: rows[0] });
};

// Удалить изображение
const deleteImage = async (req, res) => {
  const { id } = req.params;
  
  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    throw ApiError.badRequest("Некорректный ID изображения");
  }

  // Получаем информацию об изображении для удаления файла
  const { rows: imageRows } = await query(
    `SELECT url FROM images WHERE id = $1`,
    [parsedId]
  );

  if (!imageRows[0]) {
    throw ApiError.notFound("Изображение не найдено");
  }

  // Удаляем файл
  const urlPath = imageRows[0].url.startsWith("/") ? imageRows[0].url.slice(1) : imageRows[0].url;
  const filePath = path.join(__dirname, "..", "public", urlPath);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      // Игнорируем ошибки удаления файла
    }
  }

  // Удаляем запись из БД
  await query(`DELETE FROM images WHERE id = $1`, [parsedId]);

  res.status(204).send();
};

// Изменить порядок изображений
const reorderImages = async (req, res) => {
  const { imageIds } = req.body; // массив ID в нужном порядке

  if (!Array.isArray(imageIds) || imageIds.length === 0) {
    throw ApiError.badRequest("Не указан массив ID изображений");
  }

  // Обновляем sort_order для каждого изображения
  for (let i = 0; i < imageIds.length; i++) {
    const imgId = parseInt(imageIds[i], 10);
    if (isNaN(imgId) || imgId <= 0) continue;
    
    await query(
      `UPDATE images SET sort_order = $1 WHERE id = $2`,
      [i, imgId]
    );
  }

  res.status(200).json({ message: "Порядок изображений обновлен" });
};

// Установить изображение как превью (sort_order = 0)
const setPreview = async (req, res) => {
  const { id } = req.params;
  
  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    throw ApiError.badRequest("Некорректный ID изображения");
  }

  // Получаем информацию об изображении
  const { rows: imageRows } = await query(
    `SELECT entity_type, entity_id FROM images WHERE id = $1`,
    [parsedId]
  );

  if (!imageRows[0]) {
    throw ApiError.notFound("Изображение не найдено");
  }

  const { entity_type, entity_id } = imageRows[0];

  // Сбрасываем все превью этой сущности (sort_order = 0 -> 1)
  await query(
    `UPDATE images SET sort_order = sort_order + 1 
     WHERE entity_type = $1 AND entity_id = $2 AND sort_order = 0`,
    [entity_type, entity_id]
  );

  // Устанавливаем выбранное изображение как превью
  await query(
    `UPDATE images SET sort_order = 0 WHERE id = $1`,
    [parsedId]
  );

  res.status(200).json({ message: "Превью установлено" });
};

module.exports = {
  getImages,
  uploadImage,
  deleteImage,
  reorderImages,
  setPreview,
};

