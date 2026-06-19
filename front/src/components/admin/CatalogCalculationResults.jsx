import { useCallback, useEffect, useRef, useState } from "react";
import { FaSpinner } from "react-icons/fa";
import { HARDWARE_TABLE_COLUMNS, HARDWARE_TABLE_ROWS } from "../../constants/catalogFormLayout";
import { formatCurrency } from "../../utils/format";

const fmtNum = (v, digits = 4) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: digits });
};

const CatalogCalculationResults = ({ post, payload, onPriceCalculated }) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef(null);
  const postRef = useRef(post);

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
    } catch (e) {
      setError(e?.message || "Ошибка расчёта");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [onPriceCalculated]);

  useEffect(() => {
    if (!payload) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runCalculation(payload), 600);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [payload, runCalculation]);

  const areas = result?.areas || {};
  const drawers = result?.drawers || {};
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
            {HARDWARE_TABLE_ROWS.map((rowDef) => {
              const row = hardwareRows.find((r) => r.key === rowDef.key) || {};
              return (
                <tr key={rowDef.key} className="border-b border-night-100">
                  <td className="px-2 py-1.5 text-night-600 whitespace-nowrap sticky left-0 bg-white">{rowDef.label}</td>
                  {HARDWARE_TABLE_COLUMNS.map((col) => (
                    <td key={col.key} className="px-2 py-1.5 text-center text-night-800">
                      {col.key === "price" ? fmtNum(row.price, 2) : row[col.key] ?? ""}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr className="bg-night-50 font-semibold">
              <td className="px-2 py-2 text-night-800">Всего:</td>
              <td colSpan={HARDWARE_TABLE_COLUMNS.length - 1} />
              <td className="px-2 py-2 text-center text-accent">{fmtNum(hardwareTotal, 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {result?.breakdown ? (
        <details className="text-xs text-night-500">
          <summary className="cursor-pointer hover:text-night-700">Детализация блоков</summary>
          <pre className="mt-2 p-3 bg-night-50 rounded-lg overflow-x-auto">{JSON.stringify(result.breakdown, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  );
};

export default CatalogCalculationResults;
