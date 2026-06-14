import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import SecureInput from "./SecureInput";

const EditableSelect = ({
  value,
  onChange,
  suggestions = [],
  disabled = false,
  placeholder = "—",
  className = "",
}) => {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

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

  const hasOptions = options.length > 0;
  const displayValue = String(value ?? "").trim();

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
  };

  return (
    <div ref={rootRef} className={clsx("relative min-w-0", open && "z-50", className)}>
      <div className="relative flex items-center min-w-0">
        <SecureInput
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => {
            if (!disabled && hasOptions) setOpen(true);
          }}
          className={clsx(
            "w-full min-w-0 h-10 px-3 py-2 border border-night-200 bg-white text-sm text-night-900",
            "focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-night-50",
            hasOptions ? "pr-8" : "",
            open ? "rounded-t-xl rounded-b-none" : "rounded-xl",
            !displayValue && "text-night-500"
          )}
        />
        {hasOptions ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              setOpen((v) => !v);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-night-400 shrink-0 text-sm leading-none p-1 hover:text-night-600"
            tabIndex={-1}
            aria-label="Открыть список"
          >
            ▾
          </button>
        ) : null}
      </div>

      {open && hasOptions ? (
        <div className="absolute z-50 top-full left-0 right-0 w-full mt-0">
          <div className="border border-t-0 border-night-200 bg-white shadow-xl overflow-auto max-h-48 rounded-b-xl">
            {options.map((opt) => {
              const isSelected = opt === displayValue;
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
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default EditableSelect;
