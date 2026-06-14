import {
  PRODUCT_CHARACTERISTIC_DIMENSIONS_SECTION,
  PRODUCT_CHARACTERISTIC_FIELDS,
} from "../../constants/productCharacteristics";
import { parseCharacteristicField } from "../../utils/characteristics";
import CharacteristicCard from "../ui/CharacteristicCard";
import FormSection from "../ui/FormSection";

const ProductDimensionsSection = ({ value, onChange, templatesByField = {} }) => {
  const form = value && typeof value === "object" ? value : {};
  const section = PRODUCT_CHARACTERISTIC_DIMENSIONS_SECTION;

  if (!section) return null;

  return (
    <FormSection title={section.title}>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start">
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
  );
};

export default ProductDimensionsSection;
