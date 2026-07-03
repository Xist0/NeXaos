import { useMemo } from "react";
import clsx from "clsx";
import SecureInput from "../ui/SecureInput";

/**
 * Множественный выбор «Вид и кол-во Петель».
 * Хранит значение как строку: «Петля 110° × 2; Петля 165° × 1»
 */
const parseHingeDetail = (raw) => {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  return text
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.+?)\s*[×x*]\s*(\d+)$/i);
      if (m) return { type: m[1].trim(), qty: Number(m[2]) || 1 };
      return { type: part, qty: 1 };
    });
};

const serializeHingeDetail = (items) =>
  items
    .filter((x) => x.type && Number(x.qty) > 0)
    .map((x) => `${x.type} × ${Math.max(1, Math.round(Number(x.qty) || 1))}`)
    .join("; ");

const HingeTypesMultiSelect = ({
  label,
  value,
  onChange,
  suggestions = [],
  visible = true,
  onVisibilityChange,
}) => {
  const selected = useMemo(() => parseHingeDetail(value), [value]);

  const toggleType = (type) => {
    const exists = selected.find((x) => x.type === type);
    if (exists) {
      const next = selected.filter((x) => x.type !== type);
      onChange(serializeHingeDetail(next));
      return;
    }
    onChange(serializeHingeDetail([...selected, { type, qty: 1 }]));
  };

  const updateQty = (type, qty) => {
    const q = Math.max(1, Math.round(Number(qty) || 1));
    const next = selected.map((x) => (x.type === type ? { ...x, qty: q } : x));
    onChange(serializeHingeDetail(next));
  };

  const addCustom = (type) => {
    const t = String(type || "").trim();
    if (!t || selected.some((x) => x.type === t)) return;
    onChange(serializeHingeDetail([...selected, { type: t, qty: 1 }]));
  };

  return (
    <div
      className={clsx(
        "rounded-xl border p-3 space-y-3 min-w-0",
        visible ? "border-night-100 bg-white" : "border-night-100/60 bg-night-50/60"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-night-800 leading-snug">{label}</div>
        <button
          type="button"
          onClick={() => onVisibilityChange?.(!visible)}
          className={clsx(
            "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent",
            visible ? "bg-accent" : "bg-night-300"
          )}
          aria-pressed={visible}
        >
          <span
            className={clsx(
              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
              visible ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      <div className={visible ? "space-y-3" : "opacity-50 pointer-events-none space-y-3"}>
        {suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((type) => {
              const active = selected.some((x) => x.type === type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg text-xs border transition-colors",
                    active ? "border-accent bg-accent/10 text-accent font-medium" : "border-night-200 text-night-600 hover:border-night-300"
                  )}
                >
                  {type}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-night-400">Добавьте варианты в «Параметры каталога».</div>
        )}

        {selected.length > 0 ? (
          <div className="space-y-2 max-h-[104px] overflow-y-auto pr-1">
            {selected.map((item) => (
              <div key={item.type} className="flex items-center gap-2 text-xs">
                <span className="flex-1 text-night-700 truncate">{item.type}</span>
                <span className="text-night-400">×</span>
                <SecureInput
                  type="number"
                  value={String(item.qty)}
                  onChange={(v) => updateQty(item.type, v)}
                  className="w-16 text-xs"
                />
                <button
                  type="button"
                  onClick={() => toggleType(item.type)}
                  className="text-night-400 hover:text-red-500 px-1"
                  title="Убрать"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <SecureInput
          placeholder="Другой тип петли + Enter"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            addCustom(e.currentTarget.value);
            e.currentTarget.value = "";
          }}
          className="text-xs"
        />
      </div>
    </div>
  );
};

export { parseHingeDetail, serializeHingeDetail };
export default HingeTypesMultiSelect;
