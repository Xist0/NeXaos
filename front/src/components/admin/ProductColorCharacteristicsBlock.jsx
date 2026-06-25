import {
  COLOR_CHARACTERISTIC_KEYS,
  PRODUCT_CHARACTERISTIC_FIELDS,
  colorDisplayValue,
  resolveColorId,
} from "../../constants/productCharacteristics";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { parseCharacteristicField } from "../../utils/characteristics";
import ColorSelectDropdown from "../ui/ColorSelectDropdown";
import FormSection from "../ui/FormSection";

import { formatCurrency } from "../../utils/format";

/** Semi-transparent price badge shown next to fields that have a calculated breakdown value. */
const BreakdownPriceBadge = ({ amount }) => {
  if (amount == null || amount === "" || !Number.isFinite(Number(amount))) return null;
  const value = Number(amount);
  if (value <= 0) return null;
  return (
    <span className="ml-2 px-2 py-0.5 rounded-md text-xs font-medium bg-accent/15 text-accent/70 whitespace-nowrap select-none">
      {formatCurrency(value)}
    </span>
  );
};

const getColorDropdownProps = (colorRole) => {
  if (colorRole === "facade") {
    return { showFacade: true, showCorpus: false, showUniversal: true };
  }
  if (colorRole === "corpus") {
    return { showFacade: false, showCorpus: true, showUniversal: true };
  }
  return { showFacade: true, showCorpus: true, showUniversal: true };
};

const ProductColorCharacteristicsBlock = ({
  value,
  onChange,
  colors = [],
  colorPickerRef,
  fieldBreakdown = {},
}) => {
  const form = value && typeof value === "object" ? value : {};
  const hasColors = Array.isArray(colors) && colors.length > 0;

  const [openPrimary, setOpenPrimary] = useState(false);
  const [openSecondary, setOpenSecondary] = useState(false);
  const rootRef = colorPickerRef;

  useEffect(() => {
    if (!openPrimary && !openSecondary) return;
    const onPointerDown = (e) => {
      const root = rootRef?.current;
      if (!root) return;
      if (root.contains(e.target)) return;
      setOpenPrimary(false);
      setOpenSecondary(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [openPrimary, openSecondary, rootRef]);

  const facadeColors = colors.filter((c) => c?.type === "facade" || !c?.type);
  const corpusColors = colors.filter((c) => c?.type === "corpus" || !c?.type);
  const universalColors = colors.filter((c) => !c?.type);

  const updateField = (fieldKey, patch) => {
    const current = parseCharacteristicField(form[fieldKey]);
    onChange({
      ...form,
      [fieldKey]: { ...current, ...patch },
    });
  };

  return (
    <FormSection title="Цвета">
      <div ref={colorPickerRef} className="space-y-3 min-w-0">
        <div className="relative py-2">
          <div className="border-t border-night-200" />
          <span className="absolute -top-2 left-3 px-2 text-xs text-night-500 bg-white">
            Выбор цвета
          </span>
        </div>

        {!hasColors ? (
          <div className="text-sm text-night-500">
            Справочник цветов пуст. Добавьте цвета в админке: Прочее → Цвета.
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start">
            {COLOR_CHARACTERISTIC_KEYS.map((fieldKey) => {
              const def = PRODUCT_CHARACTERISTIC_FIELDS[fieldKey];
              if (!def) return null;

              const parsed = parseCharacteristicField(form[fieldKey]);
              const dropdownProps = getColorDropdownProps(def.colorRole);
              const selectedId = resolveColorId(colors, parsed.value);

              return (
                <div
                  key={fieldKey}
                  className={clsx(
                    "rounded-xl border p-3 space-y-2 min-w-0 overflow-visible",
                    parsed.visible ? "border-night-100 bg-white" : "border-night-100/60 bg-night-50/60"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 min-h-[20px]">
                    <div className="text-xs font-semibold text-night-800 leading-snug flex items-center">
                      {def.label}
                      <BreakdownPriceBadge amount={fieldBreakdown[fieldKey]} />
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField(fieldKey, { visible: !parsed.visible })}
                      className={clsx(
                        "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent",
                        parsed.visible ? "bg-accent" : "bg-night-300"
                      )}
                      aria-pressed={parsed.visible}
                      title={parsed.visible ? "Скрыть характеристику" : "Показать характеристику"}
                    >
                      <span
                        className={clsx(
                          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                          parsed.visible ? "translate-x-4" : "translate-x-0.5"
                        )}
                      />
                    </button>
                  </div>

                  <div className={parsed.visible ? "min-w-0" : "opacity-50 pointer-events-none min-w-0"}>
                    <ColorSelectDropdown
                      colors={colors}
                      value={selectedId}
                      onChange={(id) => {
                        const color = colors.find((c) => Number(c.id) === Number(id));
                        updateField(fieldKey, { value: color ? colorDisplayValue(color) : "" });
                      }}
                      placeholder="Выберите цвет"
                      disabled={!parsed.visible}
                      {...dropdownProps}
                      selectedClassName={
                        def.colorRole === "corpus" ? "border-green-500 bg-green-50" : "border-accent bg-accent/5"
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </FormSection>
  );
};

export default ProductColorCharacteristicsBlock;
