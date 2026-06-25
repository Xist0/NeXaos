import { useMemo, useRef, useState, useEffect } from "react";
import clsx from "clsx";
import { formatCurrency } from "../../utils/format";

const stripAnnotation = (name) => {
  if (!name) return name;
  return String(name)
    .replace(/\s*·\s*Лист:\s*\d+[×x*]\d+\s*мм/i, "")
    .replace(/\s*·\s*\d+[×x*]\d+\s*мм/i, "")
    .trim();
};

/**
 * Карточка характеристики с выпадающим списком материалов.
 * Поле ввода по умолчанию, при фокусе/клике открывается dropdown со списком.
 */
const MaterialSelectField = ({
  label,
  value,
  onChange,
  onVisibilityChange,
  visible = true,
  items = [],
  priceKey = "price_per_m2",
  priceLabel = "за м²",
  disabled = false,
  extra = null,
}) => {
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

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        String(i.name || "").toLowerCase().includes(q) ||
        String(i.category || "").toLowerCase().includes(q) ||
        String(i.sku || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const selectedItem = useMemo(() => {
    if (!value) return null;
    const v = String(value).trim().toLowerCase();
    return items.find(
      (i) =>
        String(i.name || "").trim().toLowerCase() === v ||
        String(i.sku || "").trim().toLowerCase() === v
    ) || null;
  }, [value, items]);

  const selectedPrice = selectedItem ? selectedItem[priceKey] : null;

  const handleSelect = (item) => {
    onChange?.(item.name, item);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onChange?.("", null);
    setSearch("");
  };

  const handleInputChange = (e) => {
    const v = e.target.value;
    setSearch(v);
    onChange?.(v, null);
  };

  const handleFocus = () => {
    if (disabled || !visible) return;
    setSearch("");
    setOpen(true);
  };

  const handleArrowClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || !visible || items.length === 0) return;
    if (open) {
      setOpen(false);
    } else {
      setSearch("");
      setOpen(true);
      inputRef.current?.focus();
    }
  };

  const groupedItems = useMemo(() => {
    const groups = new Map();
    for (const item of filteredItems) {
      const cat = String(item.category || item.purpose || "Без категории").trim();
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(item);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], "ru"));
  }, [filteredItems]);

  const priceDisplay = (item) => {
    const p = Number(item[priceKey] || 0);
    if (!p) return "";
    return formatCurrency(p);
  };

  const inputRounding = open ? "rounded-t-xl rounded-b-none" : "rounded-xl";

  // Текст в input: при открытом dropdown — search, при закрытом — название выбранного или value
  const displayText = selectedItem ? stripAnnotation(selectedItem.name) : (value || "");

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

      <div ref={rootRef} className={clsx("relative", open && "z-50")}>
        <div className="relative">
          <input
            ref={inputRef}
            value={open ? search : displayText}
            onChange={handleInputChange}
            onFocus={handleFocus}
            placeholder="Введите или выберите…"
            disabled={disabled || !visible}
            className={clsx(
              "w-full h-10 px-3 py-2 text-sm border border-night-200 bg-white text-night-900 outline-none",
              "pr-16",
              inputRounding,
              !disabled && visible && "focus:border-accent focus:ring-2 focus:ring-accent/20",
              disabled ? "opacity-60 cursor-not-allowed" : ""
            )}
          />

          {/* Цена выбранного — справа внутри input (видна при закрытом dropdown) */}
          {!open && selectedItem && selectedPrice != null && Number(selectedPrice) > 0 ? (
            <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-accent font-semibold whitespace-nowrap pointer-events-none">
              {formatCurrency(Number(selectedPrice))} {priceLabel}
            </span>
          ) : null}

          {/* ✕ очистить — при наличии значения */}
          {!open && !disabled && visible && selectedItem ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-night-400 hover:text-red-500 text-xs"
              title="Очистить"
            >
              ✕
            </button>
          ) : null}

          {/* ▾ стрелка — всегда */}
          {!disabled && visible && items.length > 0 ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleArrowClick}
              className={clsx(
                "absolute right-2 top-1/2 -translate-y-1/2 text-night-400 text-sm px-1",
                "hover:text-night-600"
              )}
            >
              ▾
            </button>
          ) : null}
        </div>

        {open && items.length > 0 ? (
          <div className="absolute z-50 top-full left-0 right-0 w-full">
            <div className={clsx("border border-t-0 border-night-200 bg-white shadow-xl overflow-hidden", "rounded-b-xl")}>
              <div className="overflow-auto max-h-64">
                {groupedItems.map(([category, groupItems]) => (
                  <div key={category}>
                    <div className="px-3 py-1 text-xs font-semibold text-night-400 bg-night-50 sticky top-0">
                      {category}
                    </div>
                    {groupItems.map((item) => {
                      const isSelected = String(item.name || "").trim().toLowerCase() === String(value || "").trim().toLowerCase();
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelect(item)}
                          className={clsx(
                            "w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2",
                            isSelected ? "bg-accent/5 text-night-900" : "text-night-700 hover:bg-night-50"
                          )}
                        >
                          <span className="flex-1 min-w-0 truncate">{stripAnnotation(item.name)}</span>
                          {Number(item[priceKey] || 0) > 0 ? (
                            <span className="text-xs text-accent font-semibold whitespace-nowrap">
                              {priceDisplay(item)} {priceLabel}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {filteredItems.length === 0 ? (
                  <div className="px-3 py-4 text-center text-night-500 text-sm">Ничего не найдено</div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MaterialSelectField;
