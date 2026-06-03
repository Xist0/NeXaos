import clsx from "clsx";

/**
 * Универсальная обёртка для полей формы: label + children.
 * Убирает дублирование паттерна <label className="space-y-2">...</label>
 *
 * @param {object} props
 * @param {string} props.label — текст над полем
 * @param {string} [props.labelClassName] — доп. стили для label
 * @param {string} [props.className] — стили для корневого label
 * @param {string} [props.wrapperClassName] — стили для обёртки children (по умолчанию space-y-2)
 * @param {React.ReactNode} props.children — поле ввода / селект и т.д.
 * @param {boolean} [props.block] — если true, добавляет block для label
 */
const FormField = ({
  label,
  labelClassName = "",
  className = "",
  wrapperClassName = "",
  children,
  block = true,
}) => (
  <label
    className={clsx(
      block && "space-y-2 block",
      className
    )}
  >
    {label && (
      <div className={clsx("text-xs font-semibold text-night-700", labelClassName)}>
        {label}
      </div>
    )}
    <div className={clsx(wrapperClassName || "space-y-2")}>
      {children}
    </div>
  </label>
);

export default FormField;
