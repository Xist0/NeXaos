/**
 * CSV-импорт фурнитуры в hardware_items_extended.
 * Формат CSV: Группа, Наименование позиции, Стоимость [, любой мусор]
 * Строки без наименования пропускаются. Стоимость — число (русский формат: "1 260,00" → 1260).
 * Upsert по name: если позиция существует — обновляем category + price_per_unit, иначе — создаём.
 */
const db = require("../config/db");
const logger = require("../utils/logger");

const parseRussianNumber = (raw) => {
  if (!raw) return null;
  const text = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
};

/**
 * Парсит одну строку CSV с учётом кавычек.
 * Возвращает массив полей (strings).
 */
const splitCsvLine = (line) => {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());

  return fields;
};

/**
 * Извлекает группу, наименование и стоимость из строки CSV.
 * Форматы:
 *   - ,Группа,Наименование,Стоимость,V        (с ведущей пустой колонкой)
 *   - ,Группа,"Наименование, с запятой","1 260,00",V  (кавычки)
 *   - Группа,Наименование,Стоимость            (без ведущей колонки)
 * Стоимость может быть:
 *   - одно число: 600, 2300
 *   - русский формат в кавычках: "1 260,00"
 *   - русский формат без кавычек: тогда запятая части числа разрывает поле
 */
const extractRowFromFields = (fields) => {
  // Убираем ведущие пустые поля
  let start = 0;
  while (start < fields.length && fields[start] === "") start++;

  // Минимум 2 значимых поля: группа + наименование (стоимость может отсутствовать)
  const significant = fields.slice(start);

  if (significant.length < 2) return null;

  // Первое значимое поле — группа
  const group = significant[0];
  // Второе значимое поле — наименование
  const name = significant[1];

  // Наименование не должно быть пустым
  if (!name) return null;

  // Наименование не должно быть заголовком ("Наименование позиции", "Группа")
  const headerWords = ["наименование позиции", "стоимость", "группа"];
  if (headerWords.includes(name.toLowerCase())) return null;

  // Стоимость: третье значимое поле (или объединённое, если русский формат разорван)
  // Если 3-е поле — число или русский формат → это стоимость
  // Если 3-е поле + 4-е поле вместе образуют русский формат → объединяем
  let priceRaw = "";
  let price = null;

  if (significant.length >= 3) {
    // Проверяем: может ли 3+4 поля вместе быть русским числом
    if (significant.length >= 4) {
      const combined = `${significant[2]},${significant[3]}`;
      const parsedCombined = parseRussianNumber(combined);
      if (parsedCombined !== null) {
        price = parsedCombined;
      } else {
        // 3-е поле само — число
        const parsed3 = parseRussianNumber(significant[2]);
        if (parsed3 !== null) {
          price = parsed3;
        }
      }
    } else {
      // Только 3 поля
      const parsed3 = parseRussianNumber(significant[2]);
      if (parsed3 !== null) {
        price = parsed3;
      }
    }
  }

  return { group, name, price };
};

const parseCsvLine = (line) => {
  const fields = splitCsvLine(line);
  return extractRowFromFields(fields);
};

const parseCsv = (text) => {
  const lines = text.split(/\r?\n/);
  const rows = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const parsed = parseCsvLine(line);
    if (!parsed || !parsed.name) continue;
    rows.push(parsed);
  }

  return rows;
};

const importHardwareCsv = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Файл не получен" });
  }

  const text = req.file.buffer.toString("utf-8");
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return res.status(400).json({ message: "CSV не содержит данных для импорта", parsed: 0 });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    // Получить все существующие записи для маппинга name → id
    const { rows: existing } = await db.query(
      "SELECT id, name, category, price_per_unit FROM hardware_items_extended WHERE is_active = TRUE"
    );

    const existingByName = new Map();
    for (const item of existing) {
      existingByName.set(item.name.trim().toLowerCase(), item);
    }

    for (const row of rows) {
      const key = row.name.toLowerCase();
      const existingItem = existingByName.get(key);

      if (existingItem) {
        // Обновляем, если данные изменились
        const newCategory = row.group || existingItem.category;
        const newPrice = row.price !== null ? row.price : existingItem.price_per_unit;

        if (
          String(newCategory || "").trim() !== String(existingItem.category || "").trim() ||
          Number(newPrice || 0) !== Number(existingItem.price_per_unit || 0)
        ) {
          await db.query(
            "UPDATE hardware_items_extended SET category = $1, price_per_unit = $2, updated_at = now() WHERE id = $3",
            [newCategory, newPrice, existingItem.id]
          );
          updated++;
        } else {
          skipped++;
        }
      } else {
        // Создаём новую запись
        await db.query(
          `INSERT INTO hardware_items_extended (name, category, price_per_unit, sku, is_active)
           VALUES ($1, $2, $3, $4, TRUE)`,
          [row.name, row.group || null, row.price, row.group ? `${row.group}-${row.name}` : row.name]
        );
        created++;
      }
    }

    logger.info("CSV hardware import completed", { created, updated, skipped, total: rows.length });

    res.status(200).json({
      message: "Импорт завершён",
      parsed: rows.length,
      created,
      updated,
      skipped,
    });
  } catch (error) {
    logger.error("CSV hardware import failed", { message: error.message });
    throw error;
  }
};

module.exports = { importHardwareCsv, parseCsv, parseCsvLine, splitCsvLine };
