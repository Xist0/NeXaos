import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

const PopoverSelect = ({
  items,
  value,
  onChange,
  getKey,
  getLabel,
  placeholder = "Выберите…",
  disabled = false,
  searchable = true,
  searchPlaceholder = "Поиск…",
  size = "md",
  allowClear = false,
  clearLabel = "Сбросить",
  buttonClassName = "",
  popoverClassName = "",
  optionClassName = "",
  emptyText = "Ничего не найдено",
  maxHeightClassName = "max-h-72",
  align = "left",
}) => {
  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef(null);

  const selected = useMemo(() => {
    if (value === null || value === undefined || value === "") return null;
    const v = String(value);
    for (const it of safeItems) {
      const k = String(getKey(it));
      if (k === v) return it;
    }
    return null;
  }, [getKey, safeItems, value]);

  const selectedLabel = useMemo(() => {
    if (!selected) return "";
    return String(getLabel(selected) ?? "");
  }, [getLabel, selected]);

  const filtered = useMemo(() => {
    const term = String(q || "").trim().toLowerCase();
    if (!term) return safeItems;
    return safeItems.filter((it) => String(getLabel(it) ?? "").toLowerCase().includes(term));
  }, [getLabel, q, safeItems]);

  const canClear = allowClear && value !== null && value !== undefined && value !== "";

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e) => {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(e.target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const handleSelect = useCallback(
    (it) => {
      const nextKey = getKey(it);
      onChange?.(nextKey, it);
      setQ("");
      setOpen(false);
    },
    [getKey, onChange]
  );

  const sideClass = align === "right" ? "right-0" : "left-0";

  const sizeStyles = useMemo(() => {
    switch (size) {
      case "sm":
        return {
          button: "rounded-xl px-3 py-2 text-sm",
          caret: "text-sm",
          popover: "mt-0",
          searchWrap: "p-2",
          searchInput: "px-3 py-2 rounded-lg text-sm",
          option: "px-3 py-2 text-sm",
        };
      case "lg":
        return {
          button: "rounded-2xl px-4 py-3 text-base",
          caret: "text-base",
          popover: "mt-0",
          searchWrap: "p-3",
          searchInput: "px-4 py-3 rounded-xl text-base",
          option: "px-4 py-3 text-base",
        };
      case "md":
      default:
        return {
          button: "rounded-2xl px-3 py-2 text-sm",
          caret: "text-sm",
          popover: "mt-0",
          searchWrap: "p-2",
          searchInput: "px-3 py-2 rounded-xl text-sm",
          option: "px-3 py-2 text-sm",
        };
    }
  }, [size]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => {
            const next = !v;
            if (!next) setQ("");
            return next;
          });
        }}
        className={clsx(
          "w-full flex items-center justify-between gap-3 border border-night-200 bg-white text-night-900",
          "focus:outline-none focus:ring-2 focus:ring-accent/20",
          disabled ? "opacity-60 cursor-not-allowed" : "hover:border-night-400",
          sizeStyles.button,
          buttonClassName
        )}
      >
        <span className={clsx("min-w-0 flex-1 truncate text-left", !selectedLabel && "text-night-500")}>
          {selectedLabel || placeholder}
        </span>
        <span className={clsx("text-night-400 shrink-0", sizeStyles.caret)}>▾</span>
      </button>

      {open ? (
        <div className={clsx("absolute z-50 top-full w-full", sizeStyles.popover, sideClass, popoverClassName)}>
          <div className={clsx("border border-night-200 bg-white shadow-xl overflow-hidden", sizeStyles.button.split(" ").find((c) => c.startsWith("rounded-")))}>
            {searchable ? (
              <div className={clsx("border-b border-night-100", sizeStyles.searchWrap)}>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={searchPlaceholder}
                  className={clsx(
                    "w-full border border-night-200 bg-white text-night-800 outline-none focus:ring-2 focus:ring-accent/20",
                    sizeStyles.searchInput
                  )}
                  autoFocus
                />
              </div>
            ) : null}

            <div className={clsx("overflow-auto", maxHeightClassName)}>
              {canClear ? (
                <button
                  type="button"
                  className={clsx(
                    "w-full text-left border-b border-night-100 hover:bg-night-50 transition-colors",
                    sizeStyles.option,
                    optionClassName
                  )}
                  onClick={() => {
                    onChange?.("", null);
                    setQ("");
                    setOpen(false);
                  }}
                >
                  <div className="truncate text-night-600">{clearLabel}</div>
                </button>
              ) : null}

              {filtered.length === 0 ? (
                <div className={clsx("text-night-500", sizeStyles.option)}>{emptyText}</div>
              ) : (
                filtered.map((it) => {
                  const k = String(getKey(it));
                  const isSelected = value !== null && value !== undefined && value !== "" && String(value) === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      className={clsx(
                        "w-full text-left border-b border-night-100 last:border-b-0",
                        "hover:bg-night-50 transition-colors",
                        isSelected && "bg-accent/5",
                        sizeStyles.option,
                        optionClassName
                      )}
                      onClick={() => handleSelect(it)}
                    >
                      <div className="truncate">{String(getLabel(it) ?? "")}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PopoverSelect;
