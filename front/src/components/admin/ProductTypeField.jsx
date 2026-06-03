import EditableSelect from "../ui/EditableSelect";
import FormField from "../ui/FormField";
import { PRODUCT_CHARACTERISTIC_FIELDS } from "../../constants/productCharacteristics";
import { parseCharacteristicField } from "../../utils/characteristics";

const ProductTypeField = ({ characteristics, onCharacteristicsChange, suggestions = [] }) => {
  const form = characteristics && typeof characteristics === "object" ? characteristics : {};
  const parsed = parseCharacteristicField(form.product_type);
  const label = PRODUCT_CHARACTERISTIC_FIELDS.product_type?.label || "Тип изделия";

  const setProductType = (nextValue) => {
    const current = parseCharacteristicField(form.product_type);
    onCharacteristicsChange?.({
      ...form,
      product_type: { ...current, value: nextValue },
    });
  };

  return (
    <FormField label={label}>
      <EditableSelect
        value={parsed.value}
        onChange={setProductType}
        suggestions={suggestions}
        placeholder="Выберите или введите…"
      />
    </FormField>
  );
};

export default ProductTypeField;