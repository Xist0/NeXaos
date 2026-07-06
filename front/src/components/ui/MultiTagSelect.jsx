import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

/**
 * Множественный выбор из списка suggestions.
 * Выбранные значения отображаются как теги под dropdown.
 * Значение хранится как строка: «Распашное; Откидное» (разделитель — «; »).
 */

const SEPARATOR = "; ";

const parseMultiValue = (raw) => {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  return text
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
};

const serializeMultiValue = (items) =>
  items.filter((s) => s.trim()).join(SEPARATOR);

const MultiTagSelect = ({
  value,
  onChange,
  suggestions = [],
  disabled = false,
  placeholder = "Выберите...",
  className = "",
}) => {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = useMemo(() => parseMultiValue(value), [value]);

  const availableOptions = useMemo(() => {
    const set = new Set();
    for (const raw of suggestions) {
      const item = String(raw ?? "").trim();
      if (item) set.add(item);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [suggestions]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = availableOptions;
    if (!q) return all;
    return all.filter((opt) => opt.toLowerCase().includes(q));
  }, [availableOptions, search]);

  const hasOptions = availableOptions.length > 0;

  const toggleOption = (opt) => {
    if (selected.includes(opt)) {
      onChange?.(serializeMultiValue(selected.filter((s) => s !== opt)));
    } else {
      onChange?.(serializeMultiValue([...selected, opt]));
    }
    setSearch("");
  };

  const removeTag = (opt) => {
    onChange?.(serializeMultiValue(selected.filter((s) => s !== opt)));
  };

  const addCustom = () => {
    const t = search.trim();
    if (!t || selected.includes(t)) return;
    onChange?.(serializeMultiValue([...selected, t]));
    setSearch("");
    setOpen(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      setOpen(false);
      setSearch("");
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  return (
    <div ref={rootRef} className={clsx("relative min-w-0", open && "z-50", className)}>
      {/* Input line */}
      <div className="relative">
        <input
          ref={inputRef}
          value={open ? search : ""}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
          }}
          placeholder={selected.length > 0 ? "Добавить..." : placeholder}
          disabled={disabled}
          className={clsx(
            "w-full h-10 px-3 py-2 text-sm border border-night-200 bg-white text-night-900 outline-none",
            "pr-8",
            open ? "rounded-t-xl rounded-b-none" : "rounded-xl",
            !disabled && "focus:border-accent focus:ring-2 focus:ring-accent/20",
            disabled && "opacity-60 cursor-not-allowed"
          )}
        />
        {hasOptions ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (disabled || !hasOptions) return;
              if (open) {
                setOpen(false);
                setSearch("");
              } else {
                setOpen(true);
                inputRef.current?.focus();
              }
            }}
            className={clsx(
              "absolute right-2 top-1/2 -translate-y-1/2 text-night-400 text-sm px-1",
              disabled ? "opacity-40" : "hover:text-night-600"
            )}
          >
            ▾
          </button>
        ) : null}
      </div>

      {/* Dropdown with available options */}
      {open && hasOptions ? (
        <div className="absolute z-50 top-full left-0 right-0 w-full">
          <div className={clsx("border border-t-0 border-night-200 bg-white shadow-xl overflow-hidden", "rounded-b-xl")}>
            <div className="overflow-auto max-h-48">
              {filteredOptions.map((opt) => {
                const isSelected = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleOption(opt)}
                    className={clsx(
                      "w-full text-left px-3 py-2 text-sm truncate transition-colors flex items-center gap-2",
                      isSelected
                        ? "bg-accent/10 text-accent font-medium"
                        : "text-night-700 hover:bg-accent/5"
                    )}
                  >
                    <span className={clsx(
                      "w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs",
                      isSelected
                        ? "border-accent bg-accent text-white"
                        : "border-night-300 bg-white"
                    )}>
                      {isSelected ? "✓" : ""}
                    </span>
                    {opt}
                  </button>
                );
              })}
              {search.trim() && !filteredOptions.some((opt) => opt.toLowerCase() === search.trim().toLowerCase()) ? (
                <button
                  type="button"
                  onClick={addCustom}
                  className="w-full text-left px-3 py-2 text-sm text-accent hover:bg-accent/10 transition-colors"
                >
                  + Добавить «{search.trim()}»
                </button>
              ) : null}
              {filteredOptions.length === 0 && search.trim() ? (
                <div className="px-3 py-4 text-center text-night-500 text-sm">Ничего не найдено</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Selected tags */}
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((tag) => (
            <span
              key={tag}
              className={clsx(
                "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border",
                "border-accent bg-accent/10 text-accent font-medium",
                disabled && "opacity-60"
              )}
            >
              {tag}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-accent/60 hover:text-red-500 ml-0.5 leading-none"
                  title="Убрать"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export { parseMultiValue, serializeMultiValue };
export default MultiTagSelect;
