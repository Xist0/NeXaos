import SecureInput from "../../ui/SecureInput";

/** Поле стоимости: текстовый ввод с поддержкой «1 260,00». */
const AdminPriceInput = ({ value, onChange, placeholder = "1 260,00", className = "" }) => (
  <SecureInput
    type="text"
    inputMode="decimal"
    value={value ?? ""}
    onChange={onChange}
    placeholder={placeholder}
    className={className}
  />
);

export default AdminPriceInput;
