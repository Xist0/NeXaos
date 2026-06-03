import clsx from "clsx";

/**
 * Глобальный компонент секции формы — заголовок + разделитель + children.
 * Заменяет повторяющийся паттерн:
 *   <h3 className="text-base font-bold text-night-900 border-b border-night-200 pb-2">...</h3>
 */
const FormSection = ({
  title,
  children,
  className = "",
  titleClassName = "",
  spacingClassName = "space-y-4",
  dividerClassName = "",
}) => (
  <div className={clsx(spacingClassName, className)}>
    {title && (
      <h3
        className={clsx(
          "text-base font-bold text-night-900 border-b border-night-200 pb-2",
          titleClassName
        )}
      >
        {title}
      </h3>
    )}
    <div className={clsx("space-y-3", dividerClassName)}>{children}</div>
  </div>
);

export default FormSection;
