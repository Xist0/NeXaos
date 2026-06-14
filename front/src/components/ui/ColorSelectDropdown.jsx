import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  ColorGroup,
  ColorSelectPopover,
  ColorSelectTrigger,
} from "./colorSelectShared";

const ColorSelectDropdown = ({
  colors = [],
  value,
  onChange,
  label,
  placeholder = "Выберите цвет",
  facadeColors,
  corpusColors,
  universalColors,
  facadeTitle = "Основные цвета",
  corpusTitle = "Доп. цвета",
  universalTitle = "Универсальные цвета",
  showFacade = true,
  showCorpus = false,
  showUniversal = true,
  selectedClassName = "border-accent bg-accent/5",
  className = "",
  ref: externalRef,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const internalRef = useRef(null);
  const rootRef = externalRef || internalRef;

  const effectiveFacade = facadeColors ?? colors.filter((c) => c?.type === "facade");
  const effectiveCorpus = corpusColors ?? colors.filter((c) => c?.type === "corpus");
  const effectiveUniversal = universalColors ?? colors.filter((c) => !c?.type);

  const selectedColor = colors.find((c) => Number(c.id) === Number(value));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open, rootRef]);

  const handleSelect = (id) => {
    onChange?.(id);
    setOpen(false);
  };

  return (
    <div className={clsx("min-w-0", className)}>
      {label ? <div className="text-xs font-semibold text-night-700 mb-2">{label}</div> : null}

      <div ref={rootRef} className={clsx("relative min-w-0", open && "z-50")}>
        <ColorSelectTrigger
          open={open}
          disabled={disabled}
          placeholder={placeholder}
          selectedColor={selectedColor}
          onClick={() => {
            if (disabled) return;
            setOpen((v) => !v);
          }}
        />

        <ColorSelectPopover open={open}>
          {showFacade && (
            <ColorGroup
              title={facadeTitle}
              colors={effectiveFacade}
              selectedId={value}
              onSelect={handleSelect}
              selectedClassName={selectedClassName}
              keyPrefix="facade"
            />
          )}
          {showCorpus && (
            <ColorGroup
              title={corpusTitle}
              colors={effectiveCorpus}
              selectedId={value}
              onSelect={handleSelect}
              selectedClassName={selectedClassName}
              divider
              keyPrefix="corpus"
            />
          )}
          {showUniversal && effectiveUniversal.length > 0 && (
            <ColorGroup
              title={universalTitle}
              colors={effectiveUniversal}
              selectedId={value}
              onSelect={handleSelect}
              selectedClassName={selectedClassName}
              divider
              keyPrefix="universal"
            />
          )}
        </ColorSelectPopover>
      </div>
    </div>
  );
};

export default ColorSelectDropdown;
