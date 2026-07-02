import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaSpinner } from "react-icons/fa";
import { formatCurrency } from "../../../../utils/format";
import { parseCharacteristicField } from "../../../../utils/characteristics";
import ModuleHardwareMatrixTable from "./ModuleHardwareMatrixTable";

const parseCount = (value) => {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text || text === "нет") return 0;
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
};

const flattenCharacteristics = (chars, formColors = {}) => {
  if (!chars || typeof chars !== "object" || Array.isArray(chars)) return {};
  const flat = {};
  for (const [key, raw] of Object.entries(chars)) {
    flat[key] = parseCharacteristicField(raw).value;
  }

  if (!flat.facade_color && formColors.facade_color) {
    flat.facade_color = formColors.facade_color;
  }
  if (!flat.corpus_color && formColors.corpus_color) {
    flat.corpus_color = formColors.corpus_color;
  }

  return flat;
};

const buildCalcPayload = (form, characteristics, hardwareMatrix) => {
  const flatCharacteristics = flattenCharacteristics(characteristics, {
    facade_color: form.facade_color,
    corpus_color: form.corpus_color,
  });

  const width = Number(form.length_mm) || Number(flatCharacteristics.width_mm) || 0;
  const height = Number(form.height_mm) || Number(flatCharacteristics.height_mm_char) || Number(flatCharacteristics.height_mm) || 0;
  const depth = Number(form.depth_mm) || Number(flatCharacteristics.depth_mm_char) || Number(flatCharacteristics.depth_mm) || 0;

  return {
    width_mm: width,
    height_mm: height,
    depth_mm: depth,
    front_count: parseCount(flatCharacteristics.front_count) || 1,
    characteristics: flatCharacteristics,
    hardwareMatrix: hardwareMatrix || {},
  };
};

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

const ModuleCalculationTables = ({
  form,
  characteristics,
  post,
  onAreasCalculated,
  onFieldBreakdown,
  onPriceCalculated,
  hardwareMatrix = {},
  onHardwareMatrixChange,
  fasteningItems = [],
}) => {
  const [calcData, setCalcData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const postRef = useRef(post);
  const onAreasRef = useRef(onAreasCalculated);
  const onFieldBreakdownRef = useRef(onFieldBreakdown);
  const onPriceCalculatedRef = useRef(onPriceCalculated);
  const timerRef = useRef(null);
  const lastPayloadKeyRef = useRef("");
  const calcPayloadRef = useRef(null);

  useEffect(() => { postRef.current = post; }, [post]);
  useEffect(() => { onAreasRef.current = onAreasCalculated; }, [onAreasCalculated]);
  useEffect(() => { onFieldBreakdownRef.current = onFieldBreakdown; }, [onFieldBreakdown]);
  useEffect(() => { onPriceCalculatedRef.current = onPriceCalculated; }, [onPriceCalculated]);

  const calcPayload = useMemo(
    () => buildCalcPayload(form, characteristics, hardwareMatrix),
    [form, characteristics, hardwareMatrix]
  );

  const payloadKey = useMemo(
    () => serializePayload(calcPayload),
    [calcPayload]
  );

  useEffect(() => { calcPayloadRef.current = calcPayload; }, [calcPayload]);

  const hasDimensions =
    calcPayload.width_mm > 0 && calcPayload.height_mm > 0 && calcPayload.depth_mm > 0;

  const runCalculation = useCallback(async (payload) => {
    if (!payload || !hasDimensions) {
      setCalcData(null);
      onFieldBreakdownRef.current?.({});
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await postRef.current("/modules/calculate-price", payload);
      const data = res?.data;
      if (!data) throw new Error("API не вернул данные расчёта");
      setCalcData(data);

      if (data.areas && onAreasRef.current) {
        onAreasRef.current({
          s_corpus: String(data.areas.corpusArea || ""),
          p_corpus: String(data.areas.corpusPerimeter || ""),
          s_drawers: String(data.areas.drawersArea || ""),
          p_drawers: String(data.areas.drawersPerimeter || ""),
          s_facade: String(data.areas.facadeArea || ""),
          p_facade: String(data.areas.facadePerimeter || ""),
        });
      }

      if (data.fieldBreakdown && onFieldBreakdownRef.current) {
        onFieldBreakdownRef.current(data.fieldBreakdown);
      }

      if (data.price != null && onPriceCalculatedRef.current) {
        onPriceCalculatedRef.current(data.price);
      }
    } catch (e) {
      setError(e?.message || "Ошибка расчёта");
      setCalcData(null);
      onFieldBreakdownRef.current?.({});
    } finally {
      setLoading(false);
    }
  }, [hasDimensions]);

  useEffect(() => {
    if (payloadKey === lastPayloadKeyRef.current) return;
    lastPayloadKeyRef.current = payloadKey;

    if (!hasDimensions) {
      setCalcData(null);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void runCalculation(calcPayloadRef.current);
    }, 600);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [payloadKey, runCalculation, hasDimensions]);

  const fmt = (val, digits = 4) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return "—";
    return n.toFixed(digits);
  };

  const areas = calcData?.areas || {};
  const drawers = calcData?.drawers || {};
  const breakdown = calcData?.breakdown || {};
  const hardware = calcData?.hardware || {};
  const details = calcData?.details || {};

  const breakdownRows = [
    { key: "H5", label: "Задняя стенка" },
    { key: "E11", label: "Цвет задней стенки витрины" },
    { key: "H7_sheet", label: "Корпус — плитный", indent: true },
    { key: "H7_edge", label: "Корпус — кромка", indent: true },
    { key: "H7", label: "Корпус" },
    { key: "H9_sheet", label: "Фасад — плитный", indent: true },
    { key: "H9_edge", label: "Фасад — кромка", indent: true },
    { key: "H9", label: "Фасад" },
    { key: "H18", label: "Подъёмный механизм" },
    { key: "H22", label: "Петли" },
    { key: "H24", label: "Полки" },
    { key: "H26", label: "Навесы" },
    { key: "H28", label: "Опоры" },
    { key: "L20", label: "Ящик 84 мм", hideWhenZero: true },
    { key: "L21", label: "Ящик 116 мм", hideWhenZero: true },
    { key: "L22", label: "Ящик 199 мм", hideWhenZero: true },
    { key: "sumL", label: "Ящики (итого)" },
    { key: "sumH", label: "Корпус + фурнитура (итого)" },
    { key: "U37", label: "Расходники" },
  ];

  const markupRows = [
    { key: "markupSheet", label: `Наценка на плитный (×${Number(breakdown.addSheet || 0).toFixed(2)})` },
    { key: "markupEdge", label: `Наценка на кромку (×${Number(breakdown.addEdge || 0).toFixed(2)})` },
    { key: "markupGeneral", label: `Наценка общий коэф. (×${(Number(breakdown.coefficient || 0) - 1).toFixed(2)})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h3 className="text-base font-bold text-night-900 border-b border-night-200 pb-2 flex-1">
          Расчёт площадей и стоимости
        </h3>
        {loading ? (
          <span className="text-xs text-night-400 flex items-center gap-1">
            <FaSpinner className="animate-spin" /> Считаем…
          </span>
        ) : null}
      </div>

      {!hasDimensions ? (
        <div className="text-sm text-night-500 py-2">
          Укажите длину, глубину и высоту модуля на шаге «Характеристики», чтобы запустить расчёт.
        </div>
      ) : null}

      {error ? (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>
      ) : null}

      {/* Таблица площадей — всегда показывается, при отсутствии данных — нули */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border border-night-200 rounded-xl">
          <thead>
            <tr className="bg-night-50 text-night-600">
              <th className="px-4 py-2 text-left font-semibold">Параметр</th>
              <th className="px-4 py-2 text-right font-semibold">Значение</th>
              <th className="px-4 py-2 text-left font-semibold">Ед.</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-night-100">
              <td className="px-4 py-2 text-night-900 font-medium bg-night-50/50">Корпус</td>
              <td className="px-4 py-2 text-right text-night-900">&nbsp;</td>
              <td className="px-4 py-2 text-night-500">&nbsp;</td>
            </tr>
            <tr className="border-t border-night-100">
              <td className="px-4 py-2 pl-8 text-night-700">S корпуса</td>
              <td className="px-4 py-2 text-right font-mono text-accent">{fmt(areas.corpusArea)}</td>
              <td className="px-4 py-2 text-night-500">м²</td>
            </tr>
            <tr className="border-t border-night-100">
              <td className="px-4 py-2 pl-8 text-night-700">P корпуса</td>
              <td className="px-4 py-2 text-right font-mono text-accent">{fmt(areas.corpusPerimeter)}</td>
              <td className="px-4 py-2 text-night-500">м</td>
            </tr>
            <tr className="border-t border-night-100">
              <td className="px-4 py-2 text-night-900 font-medium bg-night-50/50">Ящики (всего)</td>
              <td className="px-4 py-2 text-right text-night-900">&nbsp;</td>
              <td className="px-4 py-2 text-night-500">&nbsp;</td>
            </tr>
            <tr className="border-t border-night-100">
              <td className="px-4 py-2 pl-8 text-night-700">S ящиков</td>
              <td className="px-4 py-2 text-right font-mono text-accent">{fmt(areas.drawersArea)}</td>
              <td className="px-4 py-2 text-night-500">м²</td>
            </tr>
            <tr className="border-t border-night-100">
              <td className="px-4 py-2 pl-8 text-night-700">P ящиков</td>
              <td className="px-4 py-2 text-right font-mono text-accent">{fmt(areas.drawersPerimeter)}</td>
              <td className="px-4 py-2 text-night-500">м</td>
            </tr>
            <tr className="border-t border-night-100">
              <td className="px-4 py-2 text-night-900 font-medium bg-night-50/50">Фасад</td>
              <td className="px-4 py-2 text-right text-night-900">&nbsp;</td>
              <td className="px-4 py-2 text-night-500">&nbsp;</td>
            </tr>
            <tr className="border-t border-night-100">
              <td className="px-4 py-2 pl-8 text-night-700">S фасада</td>
              <td className="px-4 py-2 text-right font-mono text-accent">{fmt(areas.facadeArea)}</td>
              <td className="px-4 py-2 text-night-500">м²</td>
            </tr>
            <tr className="border-t border-night-100">
              <td className="px-4 py-2 pl-8 text-night-700">P фасада</td>
              <td className="px-4 py-2 text-right font-mono text-accent">{fmt(areas.facadePerimeter)}</td>
              <td className="px-4 py-2 text-night-500">м</td>
            </tr>
          </tbody>
        </table>
        {/* Пояснения — формулы с подставленными значениями */}
        {calcData?.details && hasDimensions ? (
        <div className="mt-2 text-[11px] text-night-400/70 leading-relaxed space-y-0.5 select-none border-t border-night-100 pt-2">
          <p>Ш = {details.D31} мм, В = {details.D33} мм, Г = {details.D35} мм, Фасадов = {details.D16 || 1}, Высота опор = {details.supportsH || 100} мм</p>
          <p>S корпуса = [2×(Ш×Г) + 2×((В−Высота опор)×Г)] / 10⁶ × {Number(details.O4 || 0).toFixed(2)} = [2×({details.D31}×{details.D35}) + 2×({details.D33 - (details.supportsH || 100)}×{details.D35})] / 10⁶ × {Number(details.O4 || 0).toFixed(2)} = {fmt(areas.corpusArea)}</p>
          <p>P корпуса = [4×(Ш+Г) + 4×((В−Высота опор)+Г)] / 1000 × {Number(details.O5 || 0).toFixed(2)} = [4×({details.D31}+{details.D35}) + 4×({details.D33 - (details.supportsH || 100)}+{details.D35})] / 1000 × {Number(details.O5 || 0).toFixed(2)} = {fmt(areas.corpusPerimeter)}</p>
          <p>S фасада = Ш × (В−Высота опор) / 10⁶ × {Number(details.O4 || 0).toFixed(2)} = {details.D31} × {details.D33 - (details.supportsH || 100)} / 10⁶ × {Number(details.O4 || 0).toFixed(2)} = {fmt(areas.facadeArea)}</p>
          <p>P фасада = (Ш/Фасадов + (В−Высота опор)) × 2 / 1000 × Фасадов × {Number(details.O5 || 0).toFixed(2)} = {fmt(areas.facadePerimeter)}</p>
          {Number(details.K20 || 0) + Number(details.K21 || 0) + Number(details.K22 || 0) > 0 ? (
            <p>Ящики: 84мм × {details.K20 || 0}, 116мм × {details.K21 || 0}, 199мм × {details.K22 || 0}</p>
          ) : null}
          {Number(details.addSheet || 0) > 0 ? (
            <p>Добавочный коэф. на плитный: +{details.addSheet} ₽/м²</p>
          ) : null}
          {Number(details.addEdge || 0) > 0 ? (
            <p>Добавочный коэф. на кромку: +{details.addEdge} ₽/м</p>
          ) : null}
        </div>
        ) : null}
      </div>

      {/* Детализация ящиков — только при наличии */}
      {drawers.types && drawers.types.length > 0 && drawers.types.some((d) => d.count > 0) ? (
        <div className="overflow-x-auto">
          <div className="text-sm font-semibold text-night-800 mb-2">Детализация ящиков</div>
          <table className="min-w-full text-sm border border-night-200 rounded-xl">
            <thead>
              <tr className="bg-night-50 text-night-600">
                <th className="px-4 py-2 text-left font-semibold">Тип ящика</th>
                <th className="px-4 py-2 text-right font-semibold">Кол-во</th>
                <th className="px-4 py-2 text-right font-semibold">Цена ящика</th>
                <th className="px-4 py-2 text-right font-semibold">S ящика, м²</th>
                <th className="px-4 py-2 text-right font-semibold">P ящика, м</th>
                <th className="px-4 py-2 text-right font-semibold">P фасада ящика, м</th>
              </tr>
            </thead>
            <tbody>
              {drawers.types.filter((d) => d.count > 0).map((d) => (
                <tr key={d.key} className="border-t border-night-100">
                  <td className="px-4 py-2 text-night-900">{d.label}</td>
                  <td className="px-4 py-2 text-right font-mono text-night-900">{d.count}</td>
                  <td className="px-4 py-2 text-right font-mono text-accent">{formatCurrency(Number(d.price || 0))}</td>
                  <td className="px-4 py-2 text-right font-mono text-accent">{fmt(d.area)}</td>
                  <td className="px-4 py-2 text-right font-mono text-accent">{fmt(d.perimeter)}</td>
                  <td className="px-4 py-2 text-right font-mono text-accent">{fmt(d.facadePerimeter)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-night-300 bg-night-50/50 font-semibold">
                <td className="px-4 py-2 text-night-900">Итого ящики</td>
                <td className="px-4 py-2 text-right font-mono text-night-900">
                  {drawers.types.filter((d) => d.count > 0).reduce((s, d) => s + d.count, 0)}
                </td>
                <td className="px-4 py-2 text-right font-mono text-accent">
                  {formatCurrency(Number(breakdown.sumL?.value || 0))}
                </td>
                <td className="px-4 py-2 text-right font-mono text-accent">
                  {fmt(drawers.types.filter((d) => d.count > 0).reduce((s, d) => s + Number(d.area || 0), 0))}
                </td>
                <td className="px-4 py-2 text-right font-mono text-accent">
                  {fmt(drawers.types.filter((d) => d.count > 0).reduce((s, d) => s + Number(d.perimeter || 0), 0))}
                </td>
                <td className="px-4 py-2 text-right font-mono text-accent">
                  {fmt(drawers.types.filter((d) => d.count > 0).reduce((s, d) => s + Number(d.facadePerimeter || 0), 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Матрица расходников — всегда показывается */}
      <ModuleHardwareMatrixTable
        items={fasteningItems}
        matrix={hardwareMatrix}
        onChange={onHardwareMatrixChange}
        calculatedRows={hardware.rows || []}
        total={hardware.total ?? breakdown.U37 ?? 0}
      />

      {/* Разбивка стоимости — всегда показывается */}
      <div className="overflow-x-auto">
        <div className="text-sm font-semibold text-night-800 mb-2">Разбивка стоимости</div>
        <table className="min-w-full text-sm border border-night-200 rounded-xl">
          <thead>
            <tr className="bg-night-50 text-night-600">
              <th className="px-4 py-2 text-left font-semibold">Компонент</th>
              <th className="px-4 py-2 text-right font-semibold">Стоимость</th>
              <th className="px-4 py-2 text-left font-semibold">Формула</th>
            </tr>
          </thead>
          <tbody>
            {breakdownRows.filter((row) => {
              if (!row.hideWhenZero) return true;
              const entry = breakdown[row.key];
              const val = entry?.value ?? entry ?? 0;
              return Number(val) !== 0;
            }).map((row) => {
              const entry = breakdown[row.key];
              const val = entry?.value ?? entry ?? 0;
              const formula = entry?.formula ?? null;
              return (
                <tr key={row.key} className={`border-t border-night-100${row.indent ? " bg-night-50/30" : ""}`}>
                  <td className={`px-4 py-2 text-night-700${row.indent ? " pl-8 text-[12px]" : ""}`}>{row.label}</td>
                  <td className="px-4 py-2 text-right font-mono text-accent">
                    {formatCurrency(Number(val || 0))}
                  </td>
                  <td className="px-4 py-2 text-night-400 text-[11px] font-mono">
                    {formula || "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-night-300 bg-night-50/50 font-semibold">
              <td className="px-4 py-2 text-night-900">Себестоимость (до наценок)</td>
              <td className="px-4 py-2 text-right font-mono text-accent">
                {formatCurrency(Number(breakdown.S?.value || 0))}
              </td>
              <td className="px-4 py-2 text-night-400 text-[11px] font-mono">
                {breakdown.S?.formula || "—"}
              </td>
            </tr>
            {markupRows.map((row) => {
              const entry = breakdown[row.key];
              const val = entry?.value ?? entry ?? 0;
              const formula = entry?.formula ?? null;
              return Number(val || 0) > 0 ? (
                <tr key={row.key} className="border-t border-night-100 bg-yellow-50/50">
                  <td className="px-4 py-2 text-night-700">{row.label}</td>
                  <td className="px-4 py-2 text-right font-mono text-yellow-600">
                    + {formatCurrency(Number(val || 0))}
                  </td>
                  <td className="px-4 py-2 text-night-400 text-[11px] font-mono">
                    {formula || "—"}
                  </td>
                </tr>
              ) : null;
            })}
            <tr className="border-t border-night-100 bg-night-50/50 font-semibold">
              <td className="px-4 py-2 text-night-900">Итого с наценками (×{Number(breakdown.coefficient || 0).toFixed(2)})</td>
              <td className="px-4 py-2 text-right font-mono text-accent font-bold">
                {formatCurrency(Number(calcData?.price || 0))}
              </td>
              <td className="px-4 py-2 text-night-400 text-[11px] font-mono">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ModuleCalculationTables;
