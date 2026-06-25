import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { formatCurrency } from "../../utils/format";

const DrawerSelectField = ({
  label,
  value,
  onChange,
  onVisibilityChange,
  visible = true,
  items = [],
  disabled = false,
  extra = null,
}) => {
  const [drawerRows, setDrawerRows] = useState(() => parseDrawerValue(value, items));
  const lastSyncedValue = useRef(value);

  useEffect(() => {
    if (value !== lastSyncedValue.current) {
      setDrawerRows(parseDrawerValue(value, items));
      lastSyncedValue.current = value;
    }
  }, [value, items]);

  useEffect(() => {
    if (!items.length) return;
    setDrawerRows((prev) => {
      if (!prev.length) return prev;
      const needsRematch = prev.some((r) => r.itemName && !r.itemId);
      if (!needsRematch) return prev;
      return prev.map((row) => {
        if (row.itemName && !row.itemId) {
          const item = items.find(
            (i) => String(i.name || "").trim().toLowerCase() === String(row.itemName || "").trim().toLowerCase()
          );
          if (item) {
            return { ...row, itemId: String(item.id), itemPrice: Number(item.price_per_unit || 0) };
          }
        }
        return row;
      });
    });
  }, [items]);

  useEffect(() => {
    const parts = drawerRows
      .filter((r) => r.itemName && r.qty > 0)
      .map((r) => `${r.itemName} ×${r.qty}`);
    const nextValue = parts.join("; ");
    if (nextValue !== lastSyncedValue.current) {
      lastSyncedValue.current = nextValue;
      onChange?.(nextValue);
    }
  }, [drawerRows, onChange]);

  const drawerItems = useMemo(() => {
    return items.filter((i) => {
      const name = String(i.name || "").toLowerCase();
      const category = String(i.category || "").toLowerCase();
      return (
        name.includes("ящик") ||
        name.includes("drawer") ||
        name.includes(" выдвиж") ||
        name.includes("slim") ||
        category.includes("ящик") ||
        category.includes("выдвиж") ||
        category.includes("drawer")
      );
    });
  }, [items]);

  const allDrawerItems = useMemo(() => {
    if (drawerItems.length > 0) return drawerItems;
    return items;
  }, [drawerItems, items]);

  const addRow = () => {
    setDrawerRows((prev) => [...prev, { itemId: "", itemName: "", qty: 1 }]);
  };

  const removeRow = (index) => {
    setDrawerRows((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const updateRow = (index, field, val) => {
    setDrawerRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      if (field === "itemId") {
        const item = allDrawerItems.find((i) => String(i.id) === String(val));
        next[index].itemName = item?.name || "";
        next[index].itemPrice = Number(item?.price_per_unit || 0);
      }
      return next;
    });
  };

  const selectedItem = (row) => {
    if (!row.itemId) return null;
    return allDrawerItems.find((i) => String(i.id) === String(row.itemId)) || null;
  };

  const activeRows = drawerRows.filter((r) => r.itemName);

  return (
    <div
      className={clsx(
        "rounded-xl border p-3 space-y-2 min-w-0 overflow-visible",
        visible ? "border-night-100 bg-white" : "border-night-100/60 bg-night-50/60"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-night-800 leading-snug flex items-center">{label}{extra}</div>
        <button
          type="button"
          onClick={() => onVisibilityChange?.(!visible)}
          className={clsx(
            "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent",
            visible ? "bg-accent" : "bg-night-300"
          )}
          aria-pressed={visible}
          title={visible ? "Скрыть характеристику" : "Показать характеристику"}
        >
          <span
            className={clsx(
              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
              visible ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      {visible && !disabled ? (
        <div className="space-y-2">
          {drawerRows.map((row, index) => {
            const item = selectedItem(row);
            return (
              <div key={index} className="flex items-center gap-2">
                <select
                  value={row.itemId || ""}
                  onChange={(e) => updateRow(index, "itemId", e.target.value)}
                  className="flex-1 min-w-0 h-10 px-3 py-2 border border-night-200 bg-white text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  <option value="">— Выберите систему —</option>
                  {allDrawerItems.map((i) => (
                    <option key={i.id} value={String(i.id)}>
                      {i.name} {Number(i.price_per_unit || 0) > 0 ? `(${formatCurrency(Number(i.price_per_unit))} за ед.)` : ""}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={row.qty}
                  min={1}
                  max={10}
                  onChange={(e) => updateRow(index, "qty", Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 h-10 px-2 py-2 border border-night-200 bg-white text-sm text-center rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
                {item ? (
                  <div className="text-xs text-accent font-semibold whitespace-nowrap">
                    {formatCurrency(Number(item.price_per_unit || 0) * row.qty)}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="text-night-400 hover:text-red-500 text-xs p-1"
                  title="Удалить"
                >
                  ✕
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addRow}
            className="w-full text-left px-3 py-2 text-sm text-accent border border-night-200 rounded-xl hover:bg-accent/5 transition-colors"
          >
            + Добавить выдвижную систему
          </button>
          {activeRows.length > 0 ? (
            <div className="text-xs text-night-500 pt-1">
              Итого: {activeRows.reduce((s, r) => s + r.qty, 0)} ящиков
              · {formatCurrency(activeRows.filter((r) => r.itemPrice).reduce((s, r) => s + (r.itemPrice || 0) * r.qty, 0))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-sm text-night-700 min-h-[2.5rem] px-3 py-2 border border-night-200 bg-night-50 rounded-xl">
          {value || "—"}
        </div>
      )}
    </div>
  );
};

function parseDrawerValue(text, items) {
  if (!text) return [];
  const parts = String(text).split(";").map((s) => s.trim()).filter(Boolean);
  return parts.map((part) => {
    const m = part.match(/^(.+?)\s*[×x*]\s*(\d+)$/i);
    if (m) {
      const name = m[1].trim();
      const qty = Number(m[2]) || 1;
      const item = items.find(
        (i) => String(i.name || "").trim().toLowerCase() === name.toLowerCase()
      );
      return {
        itemId: item ? String(item.id) : "",
        itemName: name,
        qty,
        itemPrice: item ? Number(item.price_per_unit || 0) : 0,
      };
    }
    return { itemId: "", itemName: part, qty: 1, itemPrice: 0 };
  });
}

export default DrawerSelectField;