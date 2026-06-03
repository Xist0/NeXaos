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
    <div ref={rootRef} className={clsx("relative min-w-0", className)}>
      <div className="relative flex items-center">
        <SecureInput
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          list={options.length > 0 ? listId : undefined}
          className="w-full min-w-0 px-3 py-2 border border-night-200 rounded-lg text-sm disabled:bg-night-50 h-10"
        />
        {options.length > 0 ? (
          <datalist id={listId}>
            {options.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
        ) : null}
      </div>
    </div>
  );
};

export default EditableSelect;
