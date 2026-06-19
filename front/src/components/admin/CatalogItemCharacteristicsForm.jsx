import clsx from "clsx";
import {
  CATALOG_ITEM_FORM_SECTIONS,
  DRAWERS_DETAIL_FIELD_KEY,
  isColorField,
  resolveFieldLabel,
} from "../../constants/catalogFormLayout";
import {
  colorDisplayValue,
  PRODUCT_CHARACTERISTIC_FIELDS,
  resolveColorId,
} from "../../constants/productCharacteristics";
import { parseCharacteristicField } from "../../utils/characteristics";
import CharacteristicCard from "../ui/CharacteristicCard";
import ColorSelectDropdown from "../ui/ColorSelectDropdown";
import FormSection from "../ui/FormSection";
import DrawerTypesMultiSelect from "./DrawerTypesMultiSelect";
import CatalogCalculationResults from "./CatalogCalculationResults";

const getColorDropdownProps = (colorRole) => {
  if (colorRole === "facade") {
    return { showFacade: true, showCorpus: false, showUniversal: true };
  }
  if (colorRole === "corpus") {
    return { showFacade: false, showCorpus: true, showUniversal: true };
  }
  return { showFacade: true, showCorpus: true, showUniversal: true };
};

const CatalogItemCharacteristicsForm = ({
  value,
  onChange,
  templatesByField = {},
  fieldLabels = {},
  colors = [],
  post,
  onPriceCalculated,
}) => {
  const form = value && typeof value === "object" ? value : {};

  const updateField = (fieldKey, patch) => {
    const current = parseCharacteristicField(form[fieldKey]);
    onChange({
      ...form,
      [fieldKey]: { ...current, ...patch },
    });
  };

  const renderColorField = (fieldKey) => {
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
          <div className="text-xs font-semibold text-night-800 leading-snug">{resolveFieldLabel(fieldKey, fieldLabels)}</div>
          <button
            type="button"
            onClick={() => updateField(fieldKey, { visible: !parsed.visible })}
            className={clsx(
              "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent",
              parsed.visible ? "bg-accent" : "bg-night-300"
            )}
            aria-pressed={parsed.visible}
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
  };

  const renderField = (fieldKey) => {
    if (isColorField(fieldKey)) return renderColorField(fieldKey);

    if (fieldKey === DRAWERS_DETAIL_FIELD_KEY) {
      const parsed = parseCharacteristicField(form[fieldKey]);
      return (
        <DrawerTypesMultiSelect
          key={fieldKey}
          label={resolveFieldLabel(fieldKey, fieldLabels)}
          value={parsed.value}
          onChange={(v) => updateField(fieldKey, { value: v })}
          suggestions={templatesByField[fieldKey] || []}
          visible={parsed.visible}
          onVisibilityChange={(nextVisible) => updateField(fieldKey, { visible: nextVisible })}
        />
      );
    }

    const parsed = parseCharacteristicField(form[fieldKey]);
    return (
      <CharacteristicCard
        key={fieldKey}
        label={resolveFieldLabel(fieldKey, fieldLabels)}
        value={parsed.value}
        onChange={(v) => updateField(fieldKey, { value: v })}
        visible={parsed.visible}
        onVisibilityChange={(nextVisible) => updateField(fieldKey, { visible: nextVisible })}
        suggestions={templatesByField[fieldKey] || []}
      />
    );
  };

  const readChar = (key) => {
    const parsed = parseCharacteristicField(form[key]);
    const n = Number(String(parsed.value ?? "").trim());
    return Number.isFinite(n) ? n : 0;
  };

  const readCharStr = (key) => {
    const parsed = parseCharacteristicField(form[key]);
    return String(parsed.value ?? "").trim();
  };

  const calcPayload = {
    width_mm: readChar("width_mm"),
    height_mm: readChar("height_mm_char"),
    depth_mm: readChar("depth_mm_char"),
    front_count: readChar("front_count"),
    characteristics: Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, parseCharacteristicField(v).value])
    ),
  };

  const hasDimensions = calcPayload.width_mm > 0 && calcPayload.height_mm > 0 && calcPayload.depth_mm > 0;

  return (
    <div className="space-y-8">
      <p className="text-sm text-night-500">
        Заполните параметры по разделам. Варианты списков настраиваются в «Параметры каталога».
        Цвета и материалы — из существующих справочников.
      </p>

      {CATALOG_ITEM_FORM_SECTIONS.map((section) => (
        <FormSection key={section.id} title={section.title}>
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3 items-start">
            {section.columns.map((columnKeys, colIdx) => (
              <div key={colIdx} className="space-y-3 min-w-0">
                {columnKeys.map((fieldKey) => renderField(fieldKey))}
              </div>
            ))}
          </div>
        </FormSection>
      ))}

      {post && hasDimensions ? (
        <CatalogCalculationResults post={post} payload={calcPayload} onPriceCalculated={onPriceCalculated} />
      ) : post ? (
        <p className="text-xs text-night-400 pt-4 border-t border-night-200">
          Укажите габариты (ширина, высота, глубина) для автоматического расчёта стоимости.
        </p>
      ) : null}
    </div>
  );
};

export default CatalogItemCharacteristicsForm;
