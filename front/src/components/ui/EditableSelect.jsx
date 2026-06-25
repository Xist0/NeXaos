import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import SecureInput from "./SecureInput";

/**
 * Editable select — input-first pattern:
 * Поле ввода по умолчанию, при фокусе/клике открывается dropdown со списком.
 */
const EditableSelect = ({
  value,
  onChange,
  suggestions = [],
  disabled = false,
  placeholder = "—",
  className = "",
}) => {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const options = useMemo(() => {
    const set = new Set();
    for (const raw of suggestions) {
      const item = String(raw ?? "").trim();
      if (item) set.add(item);
    }
    const current = String(value ?? "").trim();
    if (current) set.add(current);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [suggestions, value]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => String(opt).toLowerCase().includes(q));
  }, [options, search]);

  const hasOptions = options.length > 0;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const handleSelect = (opt) => {
    onChange?.(opt);
    setOpen(false);
    setSearch("");
  };

  const handleInputChange = (v) => {
    onChange?.(v);
    setSearch(v);
  };

  const handleFocus = () => {
    if (disabled) return;
    setSearch(String(value ?? ""));
    setOpen(true);
  };

  const handleArrowClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || !hasOptions) return;
    if (open) {
      setOpen(false);
    } else {
      setSearch(String(value ?? ""));
      setOpen(true);
      inputRef.current?.focus();
    }
  };

  const inputRounding = open ? "rounded-t-xl rounded-b-none" : "rounded-xl";

  return (
    <div ref={rootRef} className={clsx("relative min-w-0", open && "z-50", className)}>
      <div className="relative">
        <SecureInput
          ref={inputRef}
          value={open ? search : (value ?? "")}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={clsx(
            "w-full h-10 px-3 py-2 text-sm border border-night-200 bg-white text-night-900 outline-none",
            "pr-8",
            inputRounding,
            !disabled && "focus:border-accent focus:ring-2 focus:ring-accent/20",
            disabled && "opacity-60 cursor-not-allowed"
          )}
        />
        {hasOptions ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={handleArrowClick}
            className={clsx(
              "absolute right-2 top-1/2 -translate-y-1/2 text-night-400 text-sm px-1",
              disabled ? "opacity-40" : "hover:text-night-600"
            )}
          >
            ▾
          </button>
        ) : null}
      </div>

      {open && hasOptions ? (
        <div className="absolute z-50 top-full left-0 right-0 w-full">
          <div className={clsx("border border-t-0 border-night-200 bg-white shadow-xl overflow-hidden", "rounded-b-xl")}>
            <div className="overflow-auto max-h-48">
              {filteredOptions.map((opt) => {
                const isSelected = opt === String(value ?? "").trim();
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={clsx(
                      "w-full text-left px-3 py-2 text-sm truncate transition-colors",
                      isSelected ? "bg-accent/5 text-night-900" : "text-night-700 hover:bg-night-50"
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-night-500 text-sm">Ничего не найдено</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default EditableSelect;
