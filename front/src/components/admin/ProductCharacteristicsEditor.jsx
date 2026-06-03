import {
  PRODUCT_CHARACTERISTIC_FIELDS,
  PRODUCT_CHARACTERISTIC_EDITOR_SECTIONS,
} from "../../constants/productCharacteristics";
import { parseCharacteristicField } from "../../utils/characteristics";
import EditableSelect from "../ui/EditableSelect";
import ProductColorPickerBlock from "./ProductColorPickerBlock";

const gridColsClass = (count) => {
  if (count >= 3) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-1";
};

const CharacteristicField = ({ fieldKey, value, onChange, suggestions = [] }) => {
  const def = PRODUCT_CHARACTERISTIC_FIELDS[fieldKey];
  if (!def) return null;

  const parsed = parseCharacteristicField(value[fieldKey]);

  const setField = (patch) => {
    const current = parseCharacteristicField(value[fieldKey]);
    onChange({
      ...value,
      [fieldKey]: { ...current, ...patch },
    });
  };

  return (
    <div
      className={`rounded-xl border p-3 space-y-2 min-w-0 ${
        parsed.visible ? "border-night-100 bg-white" : "border-night-100/60 bg-night-50/60"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-night-800 leading-snug">{def.label}</div>
        <button
          type="button"
          onClick={() => setField({ visible: !parsed.visible })}
          className="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent bg-accent"
          aria-pressed={parsed.visible}
          title={parsed.visible ? "Скрыть характеристику" : "Показать характеристику"}
        >
          <span
            className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform translate-x-4"
          />
        </button>
      </div>
      <EditableSelect
        value={parsed.value}
        onChange={(v) => setField({ value: v })}
        suggestions={suggestions}
        disabled={!parsed.visible}
        placeholder="—"
      />
    </div>
  );
};

const ProductCharacteristicsEditor = ({
  value,
  onChange,
  templatesByField = {},
  colors = [],
  primaryColorId = "",
  secondaryColorId = "",
  onPrimaryColorChange,
  onSecondaryColorChange,
  colorPickerRef,
  showColorSection = true,
}) => {
  const form = value && typeof value === "object" ? value : {};

  return (
    <div className="space-y-8">
      <p className="text-sm text-night-500">
        Заполните характеристики по категориям. Значения из ранее созданных позиций доступны в списке; можно ввести своё.
        Пункты с выключенным «Видимый» не показываются на странице товара.
      </p>

      {showColorSection && Array.isArray(colors) && colors.length > 0 ? (
        <ProductColorPickerBlock
          colors={colors}
          primaryColorId={primaryColorId}
          secondaryColorId={secondaryColorId}
          onPrimaryChange={onPrimaryColorChange}
          onSecondaryChange={onSecondaryColorChange}
          pickerRef={colorPickerRef}
        />
      ) : null}

      {PRODUCT_CHARACTERISTIC_EDITOR_SECTIONS.map((section) => (
        <div key={section.id} className="space-y-4">
          <h3 className="text-base font-bold text-night-900 border-b border-night-200 pb-2">
            {section.title}
          </h3>
          <div className="space-y-3">
            {section.rows.map((rowKeys, rowIndex) => (
              <div key={`${section.id}-row-${rowIndex}`} className={`grid gap-3 ${gridColsClass(rowKeys.length)}`}>
                {rowKeys.map((fieldKey) => (
                  <CharacteristicField
                    key={fieldKey}
                    fieldKey={fieldKey}
                    value={form}
                    onChange={onChange}
                    suggestions={templatesByField[fieldKey] || []}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProductCharacteristicsEditor;
