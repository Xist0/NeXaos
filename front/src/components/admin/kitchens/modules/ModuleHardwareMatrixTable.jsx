import { useMemo } from "react";
import { HARDWARE_TABLE_COLUMNS } from "../../../../constants/catalogFormLayout";
import { formatCurrency } from "../../../../utils/format";

const INPUT_COLUMNS = HARDWARE_TABLE_COLUMNS.filter((col) => col.key !== "price");

/** Колонки, которые автозаполняются из крепежа фурнитуры. */
const AUTO_FILL_COLUMN_KEYS = new Set(["drawer", "hinge", "support"]);

const fmtNum = (value, digits = 2) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: digits });
};

/**
 * Таблица расходников (крепёжная фурнитура).
 * Строки — позиции из категории «Крепежная фурнитура», колонки — статичные.
 * Цены рассчитываются локально: rowPrice = price_per_unit × Σ quantities; total = Σ rowPrices.
 */
const ModuleHardwareMatrixTable = ({
  items = [],
  matrix = {},
  onChange,
  calculatedRows = [],
  total = 0,
  onAutoFill,
}) => {
  /** Compute row price for each item: price_per_unit × sum of all column quantities. */
  const rowPrices = useMemo(() => {
    const prices = {};
    for (const item of items) {
      const itemKey = String(item.id);
      const rowValues = matrix[itemKey] || {};
      const qtySum = INPUT_COLUMNS.reduce((sum, col) => sum + (Number(rowValues[col.key]) || 0), 0);
      prices[itemKey] = Number(item.price_per_unit) * qtySum;
    }
    return prices;
  }, [items, matrix]);

  /** Lookup formula from backend calculatedRows by item key. */
  const formulaLookup = useMemo(() => {
    const map = {};
    for (const row of calculatedRows) {
      map[row.key] = row.formula;
    }
    return map;
  }, [calculatedRows]);

  /** Overall total = sum of all row prices. */
  const computedTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (rowPrices[String(item.id)] || 0), 0);
  }, [items, rowPrices]);

  const updateCell = (itemId, column, rawValue) => {
    const nextValue = rawValue === "" ? "" : Math.max(0, Number(rawValue) || 0);
    onChange?.({
      ...matrix,
      [String(itemId)]: {
        ...(matrix[String(itemId)] || {}),
        [column]: nextValue,
      },
    });
  };

  if (!items.length) {
    return (
      <div className="text-sm text-night-500 py-4">
        В справочнике «Фурнитура → Крепежная фурнитура» пока нет позиций.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-night-800">Расходники (крепёжная фурнитура)</div>
        {onAutoFill ? (
          <button
            type="button"
            onClick={onAutoFill}
            className="px-3 py-1.5 text-xs font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent/10 transition-colors"
          >
            Автозаполнение из фурнитуры
          </button>
        ) : null}
      </div>
      <table className="w-full text-xs border border-night-200 rounded-xl overflow-hidden min-w-[720px]">
        <thead>
          <tr className="bg-night-50 border-b border-night-200">
            <th className="px-2 py-2 text-left font-semibold text-night-700 sticky left-0 bg-night-50 min-w-[160px]">
              Наименование
            </th>
            {HARDWARE_TABLE_COLUMNS.map((col) => (
              <th key={col.key} className="px-2 py-2 text-center font-semibold text-night-700 whitespace-nowrap">
                {col.label}
              </th>
            ))}
            <th className="px-2 py-2 text-left font-semibold text-night-700">Формула</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const itemKey = String(item.id);
            const rowValues = matrix[itemKey] || {};
            const rowPrice = rowPrices[itemKey] ?? 0;

            return (
              <tr key={item.id} className="border-b border-night-100">
                <td className="px-2 py-1.5 text-night-700 whitespace-nowrap sticky left-0 bg-white">
                  <div className="font-medium text-night-800">{item.name}</div>
                  {Number(item.price_per_unit) > 0 ? (
                    <div className="text-[10px] text-night-400">{formatCurrency(Number(item.price_per_unit))} за ед.</div>
                  ) : null}
                </td>
                {INPUT_COLUMNS.map((col) => {
                  const isAutoFill = AUTO_FILL_COLUMN_KEYS.has(col.key);
                  const hasValue = rowValues[col.key] !== undefined && rowValues[col.key] !== "";
                  return (
                    <td key={col.key} className="px-1 py-1">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={rowValues[col.key] ?? ""}
                        onChange={(e) => updateCell(item.id, col.key, e.target.value)}
                        className={`w-full min-w-[44px] h-8 px-1 text-center border rounded-lg text-night-900 focus:outline-none focus:ring-2 focus:ring-accent/20 ${
                          isAutoFill && hasValue
                            ? "border-accent/40 bg-accent/5"
                            : "border-night-200"
                        }`}
                      />
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-center font-medium text-accent whitespace-nowrap">
                  {fmtNum(rowPrice, 2)}
                </td>
                <td className="px-2 py-1.5 text-night-400 text-[11px] font-mono whitespace-normal">
                  {formulaLookup[itemKey] || "—"}
                </td>
              </tr>
            );
          })}
          <tr className="bg-night-50 font-semibold">
            <td className="px-2 py-2 text-night-800">Всего:</td>
            <td colSpan={INPUT_COLUMNS.length} />
            <td className="px-2 py-2 text-center text-accent">{fmtNum(computedTotal, 2)}</td>
            <td className="px-2 py-2 text-night-400 text-[11px] font-mono">—</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ModuleHardwareMatrixTable;
