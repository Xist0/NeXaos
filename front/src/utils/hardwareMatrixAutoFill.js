/**
 * Автоматическое заполнение матрицы расходников на основе крепежа,
 * привязанного к выбранным позициям фурнитуры (ящики, петли, опоры).
 *
 * Маппинг: категория фурнитуры → колонка матрицы расходников.
 * Выдвижные системы → drawer (Ящик)
 * Петли             → hinge  (Петля)
 * Опора             → support (Опора)
 *
 * Колонки shelf, bottom, post, rail, lid остаются ручными —
 * для них нет соответствующих категорий фурнитуры с крепежом.
 */

const CATEGORY_TO_COLUMN = {
  "Выдвижные системы": "drawer",
  "Петли": "hinge",
  "Опора": "support",
};

/** Ключи характеристик, из которых берутся выбранные позиции фурнитуры. */
const CHAR_KEY_TO_COLUMN = {
  drawers_detail: "drawer",
  hinges_detail: "hinge",
  supports_type: "support",
};

/** Колонки, подлежащие автозаполнению. */
const AUTO_FILL_COLUMNS = new Set(Object.values(CHAR_KEY_TO_COLUMN));

/**
 * Разбор строки вида "Название ×N; Название2 ×M" в массив {name, qty}.
 */
function parseSelectionString(text) {
  if (!text) return [];
  const parts = String(text).split(";").map((s) => s.trim()).filter(Boolean);
  return parts
    .map((part) => {
      const m = part.match(/^(.+?)\s*[×x*]\s*(\d+)$/i);
      if (m) {
        return { name: m[1].trim(), qty: Number(m[2]) || 1 };
      }
      return { name: part.trim(), qty: 1 };
    })
    .filter((r) => r.name);
}

/**
 * Найти позицию фурнитуры по имени в списке hardwareItems.
 */
function findHardwareItemByName(name, hardwareItems) {
  if (!name) return null;
  const normalized = String(name).trim().toLowerCase();
  return hardwareItems.find(
    (item) =>
      String(item.name || "").trim().toLowerCase() === normalized
  );
}

/**
 * Получить текстовое значение характеристики.
 * Поддерживает формат {value: "...", visible: true} и плоскую строку.
 */
function getCharValueText(charValue) {
  if (!charValue) return "";
  if (typeof charValue === "object" && "value" in charValue) {
    return String(charValue.value ?? "").trim();
  }
  return String(charValue).trim();
}

/**
 * Вычислить матрицу расходников с автозаполнением.
 *
 * Для каждого выбранного типа фурнитуры (ящики, петли, опоры)
 * берётся его поле fasteners из справочника и подставляется
 * в соответствующую колонку матрицы.
 *
 * @param {Object}  characteristics     — текущие характеристики модуля
 * @param {Array}   hardwareItems       — все позиции фурнитуры (с полем fasteners)
 * @param {Object}  existingMatrix      — текущая матрица расходников (сохраняется как есть для ручных колонок)
 * @returns {Object} новая матрица с автозаполненными значениями
 */
export function computeAutoFillMatrix(
  characteristics,
  hardwareItems,
  existingMatrix = {}
) {
  const newMatrix = {};

  // Копируем все существующие строки матрицы (сохраняем ручные колонки)
  for (const [fId, row] of Object.entries(existingMatrix)) {
    newMatrix[fId] = { ...row };
  }

  // Собираем автозаполненные значения по каждой колонке
  const autoFillData = {}; // columnKey → { fastenerId: qty }

  for (const [charKey, columnKey] of Object.entries(CHAR_KEY_TO_COLUMN)) {
    const valueText = getCharValueText(characteristics?.[charKey]);
    if (!valueText) {
      // Выбор пуст — колонка не автозаполняется
      autoFillData[columnKey] = null;
      continue;
    }

    const selections = parseSelectionString(valueText);
    const columnFill = {}; // fastenerId → qty

    for (const sel of selections) {
      const hwItem = findHardwareItemByName(sel.name, hardwareItems);
      if (!hwItem?.fasteners) continue;

      for (const f of hwItem.fasteners) {
        const fId = String(f.id);
        const qty = Number(f.quantity) || 0;
        if (qty > 0) {
          // Если несколько выбранных позиций дают разное кол-во одного крепежа,
          // берём максимум (крепеж нужен для самого «тяжёлого» варианта)
          if (!columnFill[fId] || qty > columnFill[fId]) {
            columnFill[fId] = qty;
          }
        }
      }
    }

    autoFillData[columnKey] = columnFill;
  }

  // Очистить автозаполненные колонки в существующей матрице
  // (выбор мог измениться — старые автозаполненные значения больше не актуальны)
  for (const [fId, row] of Object.entries(newMatrix)) {
    for (const col of AUTO_FILL_COLUMNS) {
      delete row[col];
    }
  }

  // Записать новые автозаполненные значения
  for (const [columnKey, columnFill] of Object.entries(autoFillData)) {
    if (!columnFill) continue;

    for (const [fId, qty] of Object.entries(columnFill)) {
      if (!newMatrix[fId]) {
        newMatrix[fId] = {};
      }
      newMatrix[fId][columnKey] = qty;
    }
  }

  // Удалить пустые строки (без значимых ячеек)
  for (const [fId, row] of Object.entries(newMatrix)) {
    const hasValue = Object.values(row).some(
      (v) => v !== undefined && v !== "" && Number(v) !== 0
    );
    if (!hasValue) {
      delete newMatrix[fId];
    }
  }

  return newMatrix;
}
