/**
 * CSV-импорт материалов (sheet_materials + hardware_items_extended).
 *
 * Multi-section CSV: 3 секции рядом в одной строке + orphan rows (Рамка, Пленка, Фрезы).
 * Парсинг основан на определении секций из header row по ключевым словам.
 */
const db = require("../config/db");
const logger = require("../utils/logger");

const M2_FACTOR = 5.796;

const HW_CATEGORIES = new Set([
  "рамка", "стекло в рамку", "пленка под фрезу", "вид фрезы", "вид резьбы",
  "прокладка",
  "выдвижные системы", "подъемные механизмы", "петли", "опора",
  "решётка вентиляционная", "решетка вентиляционная", "сушка", "лоток",
  "навесы", "расходники", "крепежная фурнитура",
]);

const parseRussianNumber = (raw) => {
  if (!raw) return null;
  const text = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
};

const splitCsvLine = (line) => {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { fields.push(current.trim()); current = ""; }
    else { current += ch; }
  }
  fields.push(current.trim());
  return fields;
};

const isHwCategory = (cat) => {
  if (!cat) return false;
  return HW_CATEGORIES.has(cat.trim().toLowerCase());
};

/**
 * Определяет позиции секий из header row.
 */
const detectSections = (headerFields) => {
  const sections = {};
  const lower = headerFields.map(f => (f || "").toLowerCase().replace(/"/g, ""));

  // Секция 1: "стоимость за м²" / "стоимость за м2" / "стоимость за ед."
  for (let i = 0; i < lower.length; i++) {
    if (lower[i].includes("стоимость за м") || lower[i].includes("стоимость за м2") || lower[i].includes("стоимость за ед")) {
      sections.sheet = {
        groupCol: i - 2,
        nameCol: i - 1,
        priceM2Col: i,
        priceSheetCol: i + 1,
      };
      break;
    }
  }

  // Секция 2: edge — "стоимость за ед" (после секии 1) или "стоимость" рядом с "кромка"
  const sheetEnd = sections.sheet?.priceSheetCol || 0;
  for (let i = sheetEnd + 2; i < lower.length; i++) {
    const val = lower[i];
    // Принимаем: "стоимость за ед" + "м" / "стоимость за м" / "стоимость" (если рядом "кромка")
    if (val.includes("стоимость") || val.includes("цена за")) {
      const prev1 = lower[i - 2] || "";
      const prev2 = lower[i - 1] || "";
      if (prev1.includes("материал") || prev1 === "" || prev2.includes("наименование") || prev2.includes("позиции")) {
        sections.edge = {
          groupCol: i - 2,
          nameCol: i - 1,
          priceCol: i,
        };
        break;
      }
    }
  }

  // Секция 3: столешницы — "цена за ед" / "цена за единицу"
  const edgeEnd = sections.edge?.priceCol || 0;
  for (let i = edgeEnd + 3; i < lower.length; i++) {
    if (lower[i].includes("цена за ед") || lower[i].includes("цена за единицу")) {
      let sizeCol = -1;
      for (let j = i - 1; j >= i - 4; j--) {
        if (j >= 0 && lower[j].includes("размер")) { sizeCol = j; break; }
      }

      if (sizeCol >= 0) {
        let categoryCol = -1;
        for (let j = sizeCol - 1; j >= sizeCol - 3; j--) {
          if (j >= 0 && lower[j].includes("материал")) { categoryCol = j; break; }
        }

        if (categoryCol >= 0) {
          let nameCol = sizeCol - 1;
          let brandCol = -1;
          if (sizeCol - categoryCol >= 3) {
            brandCol = categoryCol + 1;
            nameCol = categoryCol + 2;
            if (!lower[nameCol] && nameCol < sizeCol) {
              nameCol = sizeCol - 1;
              brandCol = -1;
            }
          } else if (sizeCol - categoryCol === 2) {
            nameCol = categoryCol + 1;
          }
          if (!lower[nameCol] && lower[nameCol] === "") {
            nameCol = categoryCol + 1;
          }
          sections.countertop = {
            categoryCol,
            brandCol: brandCol >= 0 ? brandCol : -1,
            nameCol,
            sizeCol,
            priceCol: i,
          };
        } else {
          sections.countertop = {
            categoryCol: -1,
            brandCol: -1,
            nameCol: sizeCol - 1,
            sizeCol,
            priceCol: i,
          };
        }
      } else {
        sections.countertop = {
          categoryCol: i - 3,
          brandCol: -1,
          nameCol: i - 2,
          sizeCol: -1,
          priceCol: i,
        };
      }
      break;
    }
  }

  return sections;
};

/**
 * Парсит одну data row с учётом позиций секций.
 */
const parseDataRow = (fields, sections) => {
  const results = [];

  // === Секция 1: Листовые материалы ===
  if (sections.sheet) {
    const s = sections.sheet;
    const group = fields[s.groupCol] || "";
    const name = fields[s.nameCol] || "";

    if (name && !["наименование позиции", "стоимость за м"].includes(name.toLowerCase())) {
      let priceM2 = parseRussianNumber(fields[s.priceM2Col]);
      let priceSheet = parseRussianNumber(fields[s.priceSheetCol]);

      // Проверяем: priceM2+priceSheet образуют русский формат?
      const rawM2 = fields[s.priceM2Col] || "";
      const rawSheet = fields[s.priceSheetCol] || "";
      const combined = `${rawM2},${rawSheet}`;
      const parsedCombined = parseRussianNumber(combined);

      if (parsedCombined !== null && rawSheet && !parseRussianNumber(rawSheet)) {
        if (priceM2 === null) priceM2 = parsedCombined;
        priceSheet = null;
      }

      results.push({ section: 1, group, name, price_per_m2: priceM2, price_per_sheet: priceSheet });
    }
  }

  // === Секция 2: Кромка ===
  if (sections.edge) {
    const s = sections.edge;
    const group = fields[s.groupCol] || "";
    const name = fields[s.nameCol] || "";

    if (name && !["наименование позиции", "стоимость за м"].includes(name.toLowerCase())) {
      const rawPrice = fields[s.priceCol] || "";
      let edgePrice = parseRussianNumber(rawPrice);

      if (edgePrice === null && s.priceCol + 1 < fields.length) {
        const nextField = fields[s.priceCol + 1] || "";
        const combined = `${rawPrice},${nextField}`;
        if (parseRussianNumber(combined) !== null && !parseRussianNumber(nextField)) {
          edgePrice = parseRussianNumber(combined);
        }
      }

      // Кромка: только если group совпадает с кромочными категориями или цена разумная
      const isEdgeCategory = group.toLowerCase() === "кромка";
      const hasValidPrice = edgePrice !== null && edgePrice > 0;

      if (isEdgeCategory || (hasValidPrice && !isHwCategory(group))) {
        results.push({ section: 2, group, name, edge_price_per_m: edgePrice });
      }
    }
  }

  // === Секция 3: Столешницы ===
  if (sections.countertop) {
    const s = sections.countertop;
    const catCol = s.categoryCol >= 0 ? s.categoryCol : s.nameCol - 2;
    const startScan = catCol;
    const nonEmptyFrom = [];
    for (let i = startScan; i < fields.length; i++) {
      if (fields[i] !== "") nonEmptyFrom.push({ val: fields[i], idx: i });
    }

    let s3Cat = "";
    let s3Brand = "";
    let s3Name = "";
    let s3Size = "";
    let s3PriceRaw = "";
    let s3Found = false;

    if (nonEmptyFrom.length >= 2) {
      s3Cat = nonEmptyFrom[0].val;

      if (nonEmptyFrom.length >= 5) {
        s3Brand = nonEmptyFrom[1].val;
        s3Name = nonEmptyFrom[2].val;
        s3Size = nonEmptyFrom[3].val;
        s3PriceRaw = nonEmptyFrom[4].val;
      } else if (nonEmptyFrom.length >= 4) {
        const third = nonEmptyFrom[2].val;
        if (/\d+[×x*х]\d+/i.test(third)) {
          s3Brand = nonEmptyFrom[1].val;
          s3Name = nonEmptyFrom[1].val;
          s3Size = third;
          s3PriceRaw = nonEmptyFrom[3].val;
        } else {
          s3Brand = nonEmptyFrom[1].val;
          s3Name = nonEmptyFrom[2].val;
          s3Size = "";
          s3PriceRaw = nonEmptyFrom[3].val;
        }
      } else if (nonEmptyFrom.length === 3) {
        const second = nonEmptyFrom[1].val;
        if (/\d+[×x*х]\d+/i.test(second)) {
          s3Name = nonEmptyFrom[0].val;
          s3Size = second;
          s3PriceRaw = nonEmptyFrom[2].val;
        } else {
          s3Cat = nonEmptyFrom[0].val;
          s3Name = second;
          s3PriceRaw = nonEmptyFrom[2].val;
        }
      } else if (nonEmptyFrom.length === 2) {
        s3Cat = nonEmptyFrom[0].val;
        s3Name = nonEmptyFrom[1].val;
      }

      s3Found = true;
    }

    if (s3Found && s3Name) {
      const isCategorySize = /\d+[×x*х]\d+/i.test(s3Cat);
      const isNameNumber = /^[\d.,\s]+$/.test(s3Name.trim()) && parseRussianNumber(s3Name) !== null;
      if (isCategorySize || isNameNumber) return results;

      const headerWords = ["наименование позиции", "фирма", "размер", "цена за ед"];
      if (!headerWords.includes(s3Cat.toLowerCase()) && !headerWords.includes(s3Name.toLowerCase())) {
        let price = null;
        if (s3PriceRaw) {
          price = parseRussianNumber(s3PriceRaw);
        }

        let length = null;
        let width = null;
        if (s3Size) {
          const dims = String(s3Size).match(/(\d+)[×x*х](\d+)/i);
          if (dims) { length = Number(dims[1]); width = Number(dims[2]); }
        }

        results.push({
          section: 3,
          category: s3Cat || "Столешница",
          brand: s3Brand,
          name: s3Name,
          countertop_size: s3Size || null,
          sheet_length_mm: length,
          sheet_width_mm: width,
          price_per_sheet: price,
        });
      }
    }
  }

  // === Orphan rows: строки, не попавшие в секции 1-3, но с HW_CATEGORIES ===
  // Проверяем первые 2-3 колонки — если group/name совпадает с HW_CATEGORIES → hardware
  if (results.length === 0) {
    const firstNonEmpty = fields.findIndex((f) => f && f.trim() !== "");
    if (firstNonEmpty >= 0) {
      const group = fields[firstNonEmpty] || "";
      const name = fields[firstNonEmpty + 1] || "";
      const priceRaw = fields[firstNonEmpty + 2] || "";
      const price = parseRussianNumber(priceRaw);
      if (isHwCategory(group) && name) {
        results.push({
          section: 4,
          group,
          name,
          price_per_m2: price,
        });
      }
    }
  }

  return results;
};

const parseMaterialsCsv = (text) => {
  const lines = text.split(/\r?\n/);
  const allRows = [];

  // First pass: find header row and detect sections
  let sections = null;
  for (const line of lines) {
    const fields = splitCsvLine(line);
    const lower = fields.map(f => (f || "").toLowerCase().replace(/"/g, ""));
    if (lower.some(f => f.includes("стоимость за м") || f.includes("цена за ед"))) {
      sections = detectSections(fields);
      break;
    }
  }

  if (!sections) {
    sections = {
      sheet: { groupCol: 0, nameCol: 1, priceM2Col: 2, priceSheetCol: 3 },
      edge: { groupCol: 6, nameCol: 7, priceCol: 8 },
      countertop: { categoryCol: 11, brandCol: 12, nameCol: 13, sizeCol: 14, priceCol: 15 },
    };
  }

  // Second pass: parse data rows
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = splitCsvLine(line);

    // Skip header row
    const lower = fields.map(f => (f || "").toLowerCase().replace(/"/g, ""));
    if (lower.some(f => f.includes("стоимость за м") || f.includes("цена за ед"))) continue;

    const rows = parseDataRow(fields, sections);
    for (const row of rows) {
      if (!row.name) continue;
      const nameKey = row.name.trim().toLowerCase();
      if (!nameKey) continue;
      allRows.push(row);
    }
  }

  return allRows;
};

/**
 * Основной handler импорта.
 */
const importMaterialsCsv = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Файл не получен" });
  }

  const text = req.file.buffer.toString("utf-8");
  const rows = parseMaterialsCsv(text);

  if (rows.length === 0) {
    return res.status(400).json({ message: "CSV не содержит данных для импорта", parsed: 0 });
  }

  let sheetCreated = 0;
  let sheetUpdated = 0;
  let hwCreated = 0;
  let hwUpdated = 0;
  let skipped = 0;

  try {
    const { rows: existingSheets } = await db.query(
      "SELECT id, name, category, price_per_m2, price_per_sheet, edge_price_per_m, countertop_size, sheet_length_mm, sheet_width_mm FROM sheet_materials WHERE is_active IS NOT FALSE"
    );
    const sheetByName = new Map();
    for (const item of existingSheets) {
      sheetByName.set(item.name.trim().toLowerCase(), item);
    }

    const { rows: existingHw } = await db.query(
      "SELECT id, name, category, price_per_m2 FROM hardware_items_extended WHERE is_active IS NOT FALSE"
    );
    const hwByName = new Map();
    for (const item of existingHw) {
      hwByName.set(item.name.trim().toLowerCase(), item);
    }

    for (const row of rows) {
      const key = row.name.trim().toLowerCase();
      const groupOrCategory = (row.group || row.category || "").trim();

      if (isHwCategory(groupOrCategory)) {
        // → hardware_items_extended (Рамка, Стекло, Пленка, Фрезеровка)
        const existingHwItem = hwByName.get(key);
        const priceVal = row.price_per_m2 ?? row.edge_price_per_m ?? row.price_per_sheet ?? null;

        if (existingHwItem) {
          const newCategory = groupOrCategory || existingHwItem.category;
          const newPrice = priceVal !== null ? priceVal : existingHwItem.price_per_m2;

          if (String(newCategory || "") !== String(existingHwItem.category || "") ||
              Number(newPrice || 0) !== Number(existingHwItem.price_per_m2 || 0)) {
            await db.query(
              "UPDATE hardware_items_extended SET category = $1, price_per_m2 = $2, updated_at = now() WHERE id = $3",
              [newCategory, newPrice, existingHwItem.id]
            );
            hwUpdated++;
          } else {
            skipped++;
          }
        } else {
          await db.query(
            `INSERT INTO hardware_items_extended (name, category, price_per_m2, sku, is_active)
             VALUES ($1, $2, $3, $4, TRUE)`,
            [row.name, groupOrCategory, priceVal, `${groupOrCategory}-${row.name}`]
          );
          hwCreated++;
        }
      } else if (row.section === 1) {
        // → sheet_materials (листовые)
        const category = groupOrCategory;
        const priceM2 = row.price_per_m2;
        const priceSheet = row.price_per_sheet;
        const existingSheet = sheetByName.get(key);

        if (existingSheet) {
          const updates = [];
          const params = [];
          let pi = 1;

          if (category && category !== existingSheet.category) { updates.push(`category = $${pi++}`); params.push(category); }
          if (priceM2 !== null && Number(priceM2) !== Number(existingSheet.price_per_m2 || 0)) { updates.push(`price_per_m2 = $${pi++}`); params.push(priceM2); }
          if (priceSheet !== null && Number(priceSheet) !== Number(existingSheet.price_per_sheet || 0)) { updates.push(`price_per_sheet = $${pi++}`); params.push(priceSheet); }

          if (updates.length > 0) {
            updates.push(`updated_at = now()`);
            params.push(existingSheet.id);
            await db.query(`UPDATE sheet_materials SET ${updates.join(", ")} WHERE id = $${pi}`, params);
            sheetUpdated++;
          } else { skipped++; }
        } else {
          await db.query(
            `INSERT INTO sheet_materials (name, category, price_per_m2, price_per_sheet, sku, is_active)
             VALUES ($1, $2, $3, $4, $5, TRUE)`,
            [row.name, category || null, priceM2, priceSheet, `${category}-${row.name}`]
          );
          sheetCreated++;
        }
      } else if (row.section === 2) {
        // → sheet_materials (кромка, edge_price_per_m)
        const category = groupOrCategory || "Кромка";
        const existingSheet = sheetByName.get(key);
        const edgePrice = row.edge_price_per_m;

        if (existingSheet) {
          if (edgePrice !== null && Number(edgePrice) !== Number(existingSheet.edge_price_per_m || 0)) {
            await db.query(
              "UPDATE sheet_materials SET edge_price_per_m = $1, category = $2, updated_at = now() WHERE id = $3",
              [edgePrice, category, existingSheet.id]
            );
            sheetUpdated++;
          } else { skipped++; }
        } else {
          await db.query(
            `INSERT INTO sheet_materials (name, category, edge_price_per_m, sku, is_active)
             VALUES ($1, $2, $3, $4, TRUE)`,
            [row.name, category, edgePrice, `${category}-${row.name}`]
          );
          sheetCreated++;
        }
      } else if (row.section === 3) {
        // → sheet_materials (столешницы)
        const category = row.category || "Столешница";
        const existingSheet = sheetByName.get(key);

        // Auto-calc price_per_m2
        let ppm2 = null;
        if (row.price_per_sheet && row.sheet_length_mm && row.sheet_width_mm) {
          const area = (row.sheet_length_mm * row.sheet_width_mm) / 1_000_000;
          ppm2 = Math.round(row.price_per_sheet / area * 100) / 100;
        }

        if (existingSheet) {
          const updates = [];
          const params = [];
          let pi = 1;

          if (category !== existingSheet.category) { updates.push(`category = $${pi++}`); params.push(category); }
          if (row.countertop_size && row.countertop_size !== existingSheet.countertop_size) { updates.push(`countertop_size = $${pi++}`); params.push(row.countertop_size); }
          if (row.sheet_length_mm !== null) { updates.push(`sheet_length_mm = $${pi++}`); params.push(row.sheet_length_mm); }
          if (row.sheet_width_mm !== null) { updates.push(`sheet_width_mm = $${pi++}`); params.push(row.sheet_width_mm); }
          if (row.price_per_sheet !== null && Number(row.price_per_sheet) !== Number(existingSheet.price_per_sheet || 0)) {
            updates.push(`price_per_sheet = $${pi++}`); params.push(row.price_per_sheet);
            if (ppm2 !== null) { updates.push(`price_per_m2 = $${pi++}`); params.push(ppm2); }
          }

          if (updates.length > 0) {
            updates.push(`updated_at = now()`);
            params.push(existingSheet.id);
            await db.query(`UPDATE sheet_materials SET ${updates.join(", ")} WHERE id = $${pi}`, params);
            sheetUpdated++;
          } else { skipped++; }
        } else {
          await db.query(
            `INSERT INTO sheet_materials (name, category, countertop_size, sheet_length_mm, sheet_width_mm, price_per_sheet, price_per_m2, sku, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)`,
            [row.name, category, row.countertop_size, row.sheet_length_mm, row.sheet_width_mm, row.price_per_sheet, ppm2, `${category}-${row.name}`]
          );
          sheetCreated++;
        }
      } else if (row.section === 4) {
        // → hardware_items_extended (orphan HW items: Рамка, Пленка, Фрезы)
        const existingHwItem = hwByName.get(key);
        const priceVal = row.price_per_m2 ?? null;

        if (existingHwItem) {
          const newCategory = row.group || existingHwItem.category;
          const newPrice = priceVal !== null ? priceVal : existingHwItem.price_per_m2;

          if (String(newCategory || "") !== String(existingHwItem.category || "") ||
              Number(newPrice || 0) !== Number(existingHwItem.price_per_m2 || 0)) {
            await db.query(
              "UPDATE hardware_items_extended SET category = $1, price_per_m2 = $2, updated_at = now() WHERE id = $3",
              [newCategory, newPrice, existingHwItem.id]
            );
            hwUpdated++;
          } else {
            skipped++;
          }
        } else {
          await db.query(
            `INSERT INTO hardware_items_extended (name, category, price_per_m2, sku, is_active)
             VALUES ($1, $2, $3, $4, TRUE)`,
            [row.name, row.group, priceVal, `${row.group}-${row.name}`]
          );
          hwCreated++;
        }
      }
    }

    logger.info("CSV materials import completed", { sheetCreated, sheetUpdated, hwCreated, hwUpdated, skipped, total: rows.length });
    res.status(200).json({
      message: "Импорт завершён",
      parsed: rows.length,
      sheetCreated, sheetUpdated, hwCreated, hwUpdated, skipped,
    });
  } catch (error) {
    logger.error("CSV materials import failed", { message: error.message });
    throw error;
  }
};

module.exports = { importMaterialsCsv, parseMaterialsCsv };
