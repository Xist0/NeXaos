import ColorSelectPair from "../ui/ColorSelectPair";

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
    ref={pickerRef}
  />
);

export default ProductColorPickerBlock;
