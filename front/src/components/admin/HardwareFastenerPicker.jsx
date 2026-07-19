import { useMemo, useRef, useState, useEffect } from "react";
import clsx from "clsx";
import { formatCurrency } from "../../utils/format";

const FASTENER_GROUP_LABELS = {
  "Крепежная фурнитура": "Крепеж",
  "Расходники": "Расходники",
};

const FASTENER_CATEGORIES = Object.keys(FASTENER_GROUP_LABELS);

const HW_CATEGORIES_WITH_FASTENERS = [
  "Выдвижные системы",
  "Подъемные механизмы",
  "Петли",
  "Опора",
  "Решётка вентиляционная",
  "Сушка",
  "Лоток",
  "Навесы",
];

const HardwareFastenerPicker = ({ hardwareItems = [], value = [], onChange }) => {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      setOpen(false);
      setSearch("");
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const fastenerItems = useMemo(
    () => hardwareItems.filter((i) => FASTENER_CATEGORIES.includes(i.category) && i.is_active),
    [hardwareItems]
  );

  const filteredItems = useMemo(() => {
    if (!search.trim()) return fastenerItems;
    const q = search.trim().toLowerCase();
    return fastenerItems.filter(
      (i) =>
        String(i.name || "").toLowerCase().includes(q) ||
        String(i.category || "").toLowerCase().includes(q) ||
        String(i.sku || "").toLowerCase().includes(q)
    );
  }, [fastenerItems, search]);

  const groupedItems = useMemo(() => {
    const groups = new Map();
    for (const cat of FASTENER_CATEGORIES) {
      const label = FASTENER_GROUP_LABELS[cat];
      const items = filteredItems.filter((i) => i.category === cat);
      if (items.length > 0) groups.set(label, items);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], "ru"));
  }, [filteredItems]);

  const selectedIds = useMemo(() => new Set(value.map((f) => f.id)), [value]);

  const handleSelect = (item) => {
    if (selectedIds.has(item.id)) return;
    onChange([...value, { id: item.id, name: item.name, category: item.category, quantity: 1 }]);
    setSearch("");
    inputRef.current?.focus();
  };

  const handleRemove = (id) => {
    onChange(value.filter((f) => f.id !== id));
  };

  const handleQuantityChange = (id, qty) => {
    const num = parseInt(qty, 10);
    if (!Number.isFinite(num) || num < 1) return;
    onChange(value.map((f) => (f.id === id ? { ...f, quantity: num } : f)));
  };

  const handleOpen = () => {
    setSearch("");
    setOpen(true);
    inputRef.current?.focus();
  };

  const handleArrowClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (open) {
      setOpen(false);
      setSearch("");
    } else {
      handleOpen();
    }
  };

  const totalQty = value.reduce((s, f) => s + f.quantity, 0);

  const inputRounding = open ? "rounded-t-xl rounded-b-none" : "rounded-xl";

  const displayText = value.length === 0
    ? ""
    : value.length === 1
      ? `${value[0].name} × ${value[0].quantity} шт.`
      : `${value.length} поз. · ${totalQty} шт.`;

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="space-y-1">
          {FASTENER_CATEGORIES.map((cat) => {
            const label = FASTENER_GROUP_LABELS[cat];
            const inGroup = value.filter((f) => f.category === cat);
            if (inGroup.length === 0) return null;
            return (
              <div key={cat}>
                <div className="px-3 py-1 text-xs font-semibold text-night-400 bg-night-50 sticky top-0">
                  {label}
                </div>
                {inGroup.map((f) => {
                  const priceItem = fastenerItems.find((i) => i.id === f.id);
                  const price = priceItem?.price_per_unit;
                  const rowTotal = price != null ? Number(price) * f.quantity : null;
                  return (
                    <div key={f.id} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="flex-1 min-w-0 truncate text-sm text-night-900">{f.name}</span>
                      <input
                        type="number"
                        min="1"
                        value={f.quantity}
                        onChange={(e) => handleQuantityChange(f.id, e.target.value)}
                        className="w-16 h-8 px-2 text-sm text-center border border-night-200 bg-white rounded-lg focus:ring-2 focus:ring-accent/20"
                      />
                      <span className="text-xs text-night-400">шт.</span>
                      {rowTotal != null && rowTotal > 0 && (
                        <span className="text-xs text-accent font-semibold whitespace-nowrap">
                          {formatCurrency(rowTotal)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemove(f.id)}
                        className="text-night-400 hover:text-red-500 text-xs p-1 transition-colors"
                        title="Удалить"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div className="text-xs text-night-500 pt-1 px-3">
            Итого: {value.length} поз. · {totalQty} шт.
          </div>
        </div>
      )}

      <div ref={rootRef} className={clsx("relative", open && "z-50")}>
        <div className="relative">
          <input
            ref={inputRef}
            value={open ? search : displayText}
            onChange={(e) => { setSearch(e.target.value); if (!open) handleOpen(); }}
            onFocus={handleOpen}
            placeholder="Выберите крепеж / расходник…"
            readOnly={!open}
            className={clsx(
              "w-full h-10 px-3 py-2 text-sm border border-night-200 bg-white text-night-900 outline-none",
              "pr-16",
              inputRounding,
              "focus:border-accent focus:ring-2 focus:ring-accent/20"
            )}
          />
          {!open && value.length > 0 && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange([]); }}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-night-400 hover:text-red-500 text-xs"
              title="Очистить"
            >
              ✕
            </button>
          )}
          {fastenerItems.length > 0 && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleArrowClick}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-night-400 text-sm px-1 hover:text-night-600"
            >
              ▾
            </button>
          )}
        </div>

        {open && fastenerItems.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 w-full">
            <div className="border border-t-0 border-night-200 bg-white shadow-xl overflow-hidden rounded-b-xl">
              <div className="overflow-auto max-h-64">
                {groupedItems.map(([label, items]) => (
                  <div key={label}>
                    <div className="px-3 py-1 text-xs font-semibold text-night-400 bg-night-50 sticky top-0">
                      {label}
                    </div>
                    {items.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={isSelected}
                          onClick={() => handleSelect(item)}
                          className={clsx(
                            "w-full text-left px-3 py-2 text-sm transition-colors",
                            isSelected
                              ? "bg-accent/5 text-night-900 cursor-not-allowed"
                              : "text-night-700 hover:bg-night-50"
                          )}
                        >
                          {Number(item.price_per_unit || 0) > 0 && (
                            <div className="text-xs text-accent font-semibold mb-0.5">
                              {formatCurrency(Number(item.price_per_unit))} шт.
                            </div>
                          )}
                          <div className="min-w-0 truncate">{item.name}</div>
                        </button>
                      );
                    })}
                  </div>
                ))}
                {filteredItems.length === 0 && (
                  <div className="px-3 py-4 text-center text-night-500 text-sm">Ничего не найдено</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { HW_CATEGORIES_WITH_FASTENERS };
export default HardwareFastenerPicker;
