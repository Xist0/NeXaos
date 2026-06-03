import ColorSelectPair from "../ui/ColorSelectPair";

/**
 * Блок выбора цвета — обёртка над ColorSelectPair.
 * Делегирует всю логику UI глобальному компоненту.
 */
const ProductColorPickerBlock = ({
  colors = [],
  primaryColorId = "",
  secondaryColorId = "",
  onPrimaryChange,
  onSecondaryChange,
  pickerRef,
}) => (
  <ColorSelectPair
    colors={colors}
    primaryColorId={primaryColorId}
    secondaryColorId={secondaryColorId}
    onPrimaryChange={onPrimaryChange}
    onSecondaryChange={onSecondaryChange}
    label="Цвет"
    ref={pickerRef}
  />
);

export default ProductColorPickerBlock;