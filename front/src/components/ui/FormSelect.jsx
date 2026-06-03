import PopoverSelect from "./PopoverSelect";

/**
 * Глобальный выпадающий список для форм — обёртка над PopoverSelect
 * с унифицированными стилями.
 *
 * Ключевые решения:
 * - PopoverSelect уже обрабатывает flush connection (rounded-t-xl/rounded-b-none для кнопки,
 *   border-t-0 + rounded-b-xl для поповера) — скругления на стыке нет
 * - popover width всегда = button width (w-full)
 * - maxHeightClassName统一 (max-h-80)
 * - размер md по умолчанию
 * - поиск включён при items > 8
 */
const FormSelect = ({
  items = [],
  value,
  onChange,
  getKey = (x) => String(x?.id ?? x?.value ?? x),
  getLabel = (x) => String(x?.name ?? x?.label ?? x?.value ?? x),
  placeholder = "Выберите...",
  disabled = false,
  searchable,
  size = "md",
  allowClear = true,
  clearLabel = "Выберите...",
  buttonClassName = "",
  popoverClassName = "",
  maxHeightClassName = "max-h-80",
  align = "left",
  emptyText = "Ничего не найдено",
  ...rest
}) => {
  const effectiveSearchable = searchable ?? (Array.isArray(items) ? items.length > 8 : false);

  return (
    <PopoverSelect
      items={items}
      value={value}
      onChange={onChange}
      getKey={getKey}
      getLabel={getLabel}
      placeholder={placeholder}
      disabled={disabled}
      searchable={effectiveSearchable}
      size={size}
      allowClear={allowClear}
      clearLabel={clearLabel}
      buttonClassName={buttonClassName}
      popoverClassName={popoverClassName}
      maxHeightClassName={maxHeightClassName}
      align={align}
      emptyText={emptyText}
      {...rest}
    />
  );
};

export default FormSelect;