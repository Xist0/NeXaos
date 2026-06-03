import {
  PRODUCT_CHARACTERISTIC_FIELDS,
  PRODUCT_CHARACTERISTIC_EDITOR_SECTIONS,
} from "../../constants/productCharacteristics";
import { parseCharacteristicField } from "../../utils/characteristics";
import CharacteristicCard from "../ui/CharacteristicCard";
import FormSection from "../ui/FormSection";
import ProductColorPickerBlock from "./ProductColorPickerBlock";

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
        <FormSection key={section.id} title={section.title}>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {section.rows.flatMap((rowKeys) =>
              rowKeys.map((fieldKey) => {
                const def = PRODUCT_CHARACTERISTIC_FIELDS[fieldKey];
                if (!def) return null;
                const parsed = parseCharacteristicField(form[fieldKey]);

                return (
                  <CharacteristicCard
                    key={fieldKey}
                    label={def.label}
                    value={parsed.value}
                    onChange={(v) => {
                      const current = parseCharacteristicField(form[fieldKey]);
                      onChange({
                        ...form,
                        [fieldKey]: { ...current, value: v },
                      });
                    }}
                    visible={parsed.visible}
                    onVisibilityChange={(nextVisible) => {
                      const current = parseCharacteristicField(form[fieldKey]);
                      onChange({
                        ...form,
                        [fieldKey]: { ...current, visible: nextVisible },
                      });
                    }}
                    suggestions={templatesByField[fieldKey] || []}
                  />
                );
              })
            )}
          </div>
        </FormSection>
      ))}
    </div>
  );
};

export default ProductCharacteristicsEditor;