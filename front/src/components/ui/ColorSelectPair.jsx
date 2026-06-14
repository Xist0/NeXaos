import { forwardRef, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  ColorGroup,
  ColorSelectPopover,
  ColorSelectTrigger,
} from "./colorSelectShared";

const ColorPickerField = ({
  label,
  open,
  setOpen,
  closeOther,
  colors,
  selectedId,
  onSelect,
  placeholder,
  groups,
  rootZ = false,
}) => (
  <div className="space-y-2 min-w-0">
    <div className="text-xs font-semibold text-night-700">{label}</div>
    <div className={clsx("relative min-w-0", (open || rootZ) && "z-50")}>
      <ColorSelectTrigger
        open={open}
        placeholder={placeholder}
        selectedColor={colors.find((c) => Number(c.id) === Number(selectedId))}
        onClick={() => {
          closeOther?.();
          setOpen((v) => !v);
        }}
      />
      <ColorSelectPopover open={open}>
        {groups.map((group, index) => (
          <ColorGroup
            key={group.keyPrefix}
            title={group.title}
            colors={group.colors}
            selectedId={selectedId}
            onSelect={onSelect}
            selectedClassName={group.selectedClassName}
            divider={index > 0}
            keyPrefix={group.keyPrefix}
          />
        ))}
      </ColorSelectPopover>
    </div>
  </div>
);

export { ColorPickerField };

const ColorSelectPair = forwardRef(function ColorSelectPair(
  {
    colors = [],
    primaryColorId,
    secondaryColorId,
    onPrimaryChange,
    onSecondaryChange,
    sectionLabel = "Выбор цвета",
  },
  ref
) {
  const [openPrimary, setOpenPrimary] = useState(false);
  const [openSecondary, setOpenSecondary] = useState(false);
  const internalRef = useRef(null);
  const rootRef = ref || internalRef;

  const facadeColors = colors.filter((c) => c?.type === "facade");
  const corpusColors = colors.filter((c) => c?.type === "corpus");
  const universalColors = colors.filter((c) => !c?.type);

  useEffect(() => {
    if (!openPrimary && !openSecondary) return;
    const onPointerDown = (e) => {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(e.target)) return;
      setOpenPrimary(false);
      setOpenSecondary(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [openPrimary, openSecondary, rootRef]);

  return (
    <div className="min-w-0 lg:col-span-3" ref={rootRef}>
      <div className="relative py-2 mb-3">
        <div className="border-t border-night-200" />
        <span className="absolute -top-2 left-3 px-2 text-xs text-night-500 bg-white">
          {sectionLabel}
        </span>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start">
        <ColorPickerField
          label="Основной цвет"
          open={openPrimary}
          setOpen={setOpenPrimary}
          closeOther={() => setOpenSecondary(false)}
          colors={colors}
          selectedId={primaryColorId}
          placeholder="Выберите цвет"
          onSelect={(id) => {
            onPrimaryChange?.(id);
            setOpenPrimary(false);
          }}
          groups={[
            { title: "Основные цвета", colors: facadeColors, selectedClassName: "border-accent bg-accent/5", keyPrefix: "primary-facade" },
            { title: "Универсальные цвета", colors: universalColors, selectedClassName: "border-accent bg-accent/5", keyPrefix: "primary-universal" },
          ]}
          rootZ={openPrimary}
        />

        <ColorPickerField
          label="Доп. цвет (опционально)"
          open={openSecondary}
          setOpen={setOpenSecondary}
          closeOther={() => setOpenPrimary(false)}
          colors={colors}
          selectedId={secondaryColorId}
          placeholder="Выберите цвет"
          onSelect={(id) => {
            onSecondaryChange?.(id);
            setOpenSecondary(false);
          }}
          groups={[
            { title: "Доп. цвета", colors: corpusColors, selectedClassName: "border-green-500 bg-green-50", keyPrefix: "secondary-corpus" },
            { title: "Универсальные цвета", colors: universalColors, selectedClassName: "border-green-500 bg-green-50", keyPrefix: "secondary-universal" },
          ]}
          rootZ={openSecondary}
        />
      </div>
    </div>
  );
});

export default ColorSelectPair;
