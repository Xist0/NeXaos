import { useCallback, useEffect, useRef, useState } from "react";
import { FaSpinner } from "react-icons/fa";
import { HARDWARE_TABLE_COLUMNS } from "../../constants/catalogFormLayout";
import { formatCurrency } from "../../utils/format";

const fmtNum = (v, digits = 4) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: digits });
};

const BREAKDOWN_ROWS = [
  { key: "H5", label: "Задняя стенка" },
  { key: "E11", label: "Цвет задней стенки витрины" },
  { key: "H7", label: "Корпус" },
  { key: "H9", label: "Фасад" },
  { key: "H18", label: "Подъёмные механизмы" },
  { key: "H22", label: "Петли" },
  { key: "H24", label: "Полки" },
  { key: "H26", label: "Навесы" },
  { key: "H28", label: "Опоры" },
  { key: "L20", label: "Ящик 84 мм" },
  { key: "L21", label: "Ящик 116 мм" },
  { key: "L22", label: "Ящик 199 мм" },
  { key: "U37", label: "Расходники" },
];

/** Сериализует payload в стабильную строку для сравнения. */
const serializePayload = (payload) => {
  if (!payload) return "";
  const { width_mm, height_mm, depth_mm, front_count, characteristics, hardwareMatrix } = payload;
  const charsSorted = Object.entries(characteristics || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v ?? "")}`);
  const hwSorted = Object.entries(hardwareMatrix || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${Object.entries(v || {}).sort(([a], [b]) => a.localeCompare(b)).map(([c, n]) => `${c}=${n}`).join(",")}`);
  return `w=${width_mm}|h=${height_mm}|d=${depth_mm}|f=${front_count}|c=${charsSorted.join("&")}|hw=${hwSorted.join("&")}`;
};

const CatalogCalculationResults = ({ post, payload, onPriceCalculated, onAreasCalculated, onFieldBreakdown, onHardwareCalculated }) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef(null);
  const postRef = useRef(post);
  const lastPayloadKeyRef = useRef("");

  useEffect(() => {
    postRef.current = post;
  }, [post]);

  const runCalculation = useCallback(async (body) => {
    if (!body) return;
    setLoading(true);
    setError("");
    try {
      const res = await postRef.current("/modules/calculate-price", body);
      const data = res?.data;
      setResult(data || null);
      if (data?.price != null) onPriceCalculated?.(data.price);
      if (data?.areas) onAreasCalculated?.(data.areas);
      if (data?.fieldBreakdown) onFieldBreakdown?.(data.fieldBreakdown);
      if (data?.hardware) onHardwareCalculated?.(data.hardware);
    } catch (e) {
      setError(e?.message || "Ошибка расчёта");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [onPriceCalculated, onAreasCalculated]);

  useEffect(() => {
    if (!payload) return;

    const key = serializePayload(payload);
    if (key === lastPayloadKeyRef.current) return;
    lastPayloadKeyRef.current = key;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runCalculation(payload), 2000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [payload, runCalculation]);

  const areas = result?.areas || {};
  const drawers = result?.drawers || {};
  const breakdown = result?.breakdown || {};
  const hardware = result?.hardware || {};
  const hardwareRows = hardware.rows || [];
  const hardwareTotal = hardware.total ?? 0;

  return (
    <div className="space-y-6 pt-4 border-t border-night-200">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-night-900">Расчёт стоимости</h3>
        {loading ? (
          <span className="text-xs text-night-400 flex items-center gap-1">
            <FaSpinner className="animate-spin" /> Считаем…
          </span>
        ) : null}
        {error ? <span className="text-xs text-red-500">{error}</span> : null}
        {result?.price != null ? (
          <span className="text-sm font-bold text-accent">Итого: {formatCurrency(result.price)}</span>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <div className="text-sm font-semibold text-night-800 mb-2">Разбивка стоимости</div>
        <table className="w-full text-xs border border-night-200 rounded-xl overflow-hidden min-w-[320px]">
          <thead>
            <tr className="bg-night-50 border-b border-night-200">
              <th className="px-3 py-2 text-left font-semibold text-night-700">Компонент</th>
              <th className="px-3 py-2 text-right font-semibold text-night-700">Стоимость</th>
            </tr>
          </thead>
          <tbody>
            {BREAKDOWN_ROWS.map((row) => (
              <tr key={row.key} className="border-b border-night-100">
                <td className="px-3 py-2 text-night-600">{row.label}</td>
                <td className="px-3 py-2 text-right font-mono text-accent">
                  {formatCurrency(Number(breakdown[row.key] || 0))}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-night-300 bg-night-50/50 font-semibold">
              <td className="px-3 py-2 text-night-900">Себестоимость (до наценок)</td>
              <td className="px-3 py-2 text-right font-mono text-accent">
                {formatCurrency(Number(breakdown.S || 0))}
              </td>
            </tr>
            {Number(breakdown.markupSheet || 0) > 0 ? (
              <tr className="border-b border-night-100 bg-yellow-50/50">
                <td className="px-3 py-2 text-night-700">Наценка на плитный (×{Number(breakdown.addSheet || 0).toFixed(2)})</td>
                <td className="px-3 py-2 text-right font-mono text-yellow-600">
                  + {formatCurrency(Number(breakdown.markupSheet || 0))}
                </td>
              </tr>
            ) : null}
            {Number(breakdown.markupEdge || 0) > 0 ? (
              <tr className="border-b border-night-100 bg-yellow-50/50">
                <td className="px-3 py-2 text-night-700">Наценка на кромку (×{Number(breakdown.addEdge || 0).toFixed(2)})</td>
                <td className="px-3 py-2 text-right font-mono text-yellow-600">
                  + {formatCurrency(Number(breakdown.markupEdge || 0))}
                </td>
              </tr>
            ) : null}
            {Number(breakdown.markupGeneral || 0) > 0 ? (
              <tr className="border-b border-night-100 bg-yellow-50/50">
                <td className="px-3 py-2 text-night-700">Наценка общий коэф. (×{(Number(breakdown.coefficient || 0) - 1).toFixed(2)})</td>
                <td className="px-3 py-2 text-right font-mono text-yellow-600">
                  + {formatCurrency(Number(breakdown.markupGeneral || 0))}
                </td>
              </tr>
            ) : null}
            <tr className="border-b border-night-100 bg-night-50/50 font-semibold">
              <td className="px-3 py-2 text-night-900">Итого с наценками (×{Number(breakdown.coefficient || 0).toFixed(2)})</td>
              <td className="px-3 py-2 text-right font-mono text-accent font-bold">
                {formatCurrency(Number(result?.price || 0))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <table className="w-full text-xs border border-night-200 rounded-xl overflow-hidden">
          <tbody>
            <tr className="border-b border-night-100">
              <td className="px-3 py-2 text-night-600">S корпуса, м²</td>
              <td className="px-3 py-2 text-right font-medium">{fmtNum(areas.corpusArea)}</td>
            </tr>
            <tr className="border-b border-night-100">
              <td className="px-3 py-2 text-night-600">P корпуса, м</td>
              <td className="px-3 py-2 text-right font-medium">{fmtNum(areas.corpusPerimeter)}</td>
            </tr>
            <tr className="border-b border-night-100">
              <td className="px-3 py-2 text-night-600">S ящиков, м²</td>
              <td className="px-3 py-2 text-right font-medium">{fmtNum(areas.drawersArea)}</td>
            </tr>
            <tr className="border-b border-night-100">
              <td className="px-3 py-2 text-night-600">P ящиков, м</td>
              <td className="px-3 py-2 text-right font-medium">{fmtNum(areas.drawersPerimeter)}</td>
            </tr>
            <tr className="border-b border-night-100">
              <td className="px-3 py-2 text-night-600">S фасада, м²</td>
              <td className="px-3 py-2 text-right font-medium">{fmtNum(areas.facadeArea)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-night-600">P фасада, м</td>
              <td className="px-3 py-2 text-right font-medium">{fmtNum(areas.facadePerimeter)}</td>
            </tr>
          </tbody>
        </table>

        <table className="w-full text-xs border border-night-200 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-night-50 border-b border-night-200">
              <th className="px-3 py-2 text-left font-semibold text-night-700" />
              <th className="px-3 py-2 text-right font-semibold text-night-700">Цена ящика</th>
              <th className="px-3 py-2 text-right font-semibold text-night-700">S ящика</th>
              <th className="px-3 py-2 text-right font-semibold text-night-700">P ящика</th>
              <th className="px-3 py-2 text-right font-semibold text-night-700">P фасада ящика</th>
            </tr>
          </thead>
          <tbody>
            {(drawers.types || []).map((row) => (
              <tr key={row.key} className="border-b border-night-100">
                <td className="px-3 py-2 text-night-600">{row.label}</td>
                <td className="px-3 py-2 text-right">{fmtNum(row.price)}</td>
                <td className="px-3 py-2 text-right">{fmtNum(row.area)}</td>
                <td className="px-3 py-2 text-right">{fmtNum(row.perimeter)}</td>
                <td className="px-3 py-2 text-right">{fmtNum(row.facadePerimeter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-night-200 rounded-xl overflow-hidden min-w-[640px]">
          <thead>
            <tr className="bg-night-50 border-b border-night-200">
              <th className="px-2 py-2 text-left font-semibold text-night-700 sticky left-0 bg-night-50" />
              {HARDWARE_TABLE_COLUMNS.map((col) => (
                <th key={col.key} className="px-2 py-2 text-center font-semibold text-night-700 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hardwareRows.map((row) => (
              <tr key={row.key || row.id || row.label} className="border-b border-night-100">
                <td className="px-2 py-1.5 text-night-600 whitespace-nowrap sticky left-0 bg-white">{row.label}</td>
                {HARDWARE_TABLE_COLUMNS.map((col) => (
                  <td key={col.key} className="px-2 py-1.5 text-center text-night-800">
                    {col.key === "price" ? fmtNum(row.price, 2) : row[col.key] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-night-50 font-semibold">
              <td className="px-2 py-2 text-night-800">Всего:</td>
              <td colSpan={HARDWARE_TABLE_COLUMNS.length - 1} />
              <td className="px-2 py-2 text-center text-accent">{fmtNum(hardwareTotal, 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CatalogCalculationResults;
