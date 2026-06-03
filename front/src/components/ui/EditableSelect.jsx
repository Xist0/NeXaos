import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  const listId = useId();
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

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={clsx("relative flex gap-2 items-center min-w-0", className)}>
      <div className="flex-1 flex gap-2 items-center">
        <SecureInput
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          list={options.length > 0 ? listId : undefined}
          className="flex-1 min-w-0 px-3 py-2 border border-night-200 rounded-lg text-sm disabled:bg-night-50"
        />
        {options.length > 0 ? (
          <datalist id={listId}>
            {options.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
        ) : null}
      </div>
      <button
        type="button"
        disabled={disabled || options.length === 0}
        onClick={() => setOpen((v) => !v)}
        className="shrink-0 px-3 py-2 h-10 rounded-lg border border-night-200 bg-white text-night-500 hover:border-accent disabled:opacity-40 text-xs"
        aria-label="Выбрать из списка"
        title="Выбрать из списка"
      >
        ▾
      </button>
      {open ? (
        <div className="absolute z-[1000] right-0 top-full mt-1 min-w-[12rem] max-w-full rounded-xl border border-night-200 bg-white shadow-xl max-h-56 overflow-auto">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className="w-full text-left px-3 py-2 text-sm text-night-800 hover:bg-night-50 border-b border-night-100 last:border-b-0"
              onClick={() => {
                onChange?.(opt);
                setOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default EditableSelect;
