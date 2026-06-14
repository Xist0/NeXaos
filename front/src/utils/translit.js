/**
 * Транслитерация кириллицы → латиница + slugify для автогенерации SKU.
 * Используется в MaterialsAdmin / HardwareAdmin для формирования артикула из названия.
 */

const CYRILLIC_MAP = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
  з: "z", и: "i", й: "j", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

/**
 * Транслитерация строки: кириллица → латиница, спецсимволы → `_`.
 * @param {string} input — строка с кириллицей/латиницей
 * @returns {string} — латинская транслитерация
 */
export const transliterate = (input) => {
  const s = String(input || "").trim().toLowerCase();
  return s
    .split("")
    .map((ch) => (CYRILLIC_MAP[ch] != null ? CYRILLIC_MAP[ch] : ch))
    .join("")
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

/**
 * Автогенерация SKU для материала/фурнитуры.
 * Формула: transliterate(category) + "-" + transliterate(name) + "-" + size
 * Если размер не передан — только category + name.
 *
 * @param {object} opts
 * @param {string} opts.category — категория (например "ЛХДФ", "Кромка")
 * @param {string} opts.name — наименование позиции
 * @param {string|number} [opts.size] — размер (например "4100x600x38" или "2800x1220")
 * @returns {string} — автогенерированный SKU
 */
export const buildMaterialSku = ({ category, name, size }) => {
  const catPart = transliterate(category);
  const namePart = transliterate(name);
  const sizePart = size ? String(size).replace(/[^\d.x×х]/gi, "").replace(/[x×х]+/g, "x") : "";

  const parts = [catPart, namePart, sizePart].filter(Boolean);
  if (parts.length === 0) return `mat_${Date.now()}`;
  return parts.join("-");
};