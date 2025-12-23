import { useRef, useState } from "react";
import clsx from "clsx";
import useLogger from "../../hooks/useLogger";
const SecureButton = ({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className = "",
  ...rest
}) => {
  const [busy, setBusy] = useState(false);
  const logger = useLogger();
  const lastClickRef = useRef(0);

  const handleClick = async (event) => {
    if (disabled || busy) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const now = Date.now();
    // Для submit кнопок уменьшаем debounce, для обычных - оставляем
    const debounceTime = type === "submit" ? 200 : 400;
    if (now - lastClickRef.current < debounceTime) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    lastClickRef.current = now;

    // Если это submit кнопка и onClick не передан, позволяем форме обработать submit естественным образом
    if (type === "submit" && !onClick) {
      // Не делаем ничего - форма сама обработает submit
      return;
    }

    // Если это submit кнопка с onClick, предотвращаем стандартную отправку,
    // вызываем onClick, и если он успешен - программно отправляем форму
    if (type === "submit" && onClick) {
      event.preventDefault();
      event.stopPropagation();
      
      setBusy(true);
      try {
        await onClick(event);
        // После успешного выполнения onClick, программно отправляем форму
        const form = event.currentTarget.closest("form");
        if (form) {
          // Проверяем валидность формы перед отправкой
          if (form.checkValidity()) {
            form.requestSubmit();
          } else {
            form.reportValidity();
          }
        }
      } catch (error) {
        logger.error("Button handler failed", { error });
        // При ошибке форма не отправляется
      } finally {
        setTimeout(() => setBusy(false), 250);
      }
      return;
    }

    // Для обычных кнопок (type="button") работаем как раньше
    setBusy(true);
    try {
      await onClick?.(event);
    } catch (error) {
      logger.error("Button handler failed", { error });
    } finally {
      setTimeout(() => setBusy(false), 250);
    }
  };

  return (
    <button
      type={type}
      data-safe-click
      className={clsx(
        "relative inline-flex items-center justify-center rounded-full px-6 py-3 font-semibold tracking-wide transition-transform duration-200 shadow-md",
        variant === "ghost"
          ? "bg-transparent text-night-900 shadow-none border border-transparent hover:bg-night-100"
          : variant === "outline"
          ? "bg-white text-night-900 border border-night-200 shadow-sm hover:border-night-400 hover:bg-night-50"
          : "bg-[#e3e161] text-[#21262d] hover:bg-[#d6d04d]",
        busy && "opacity-60 cursor-not-allowed",
        className
      )}
      aria-busy={busy}
      disabled={disabled || busy}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </button>
  );
};

export default SecureButton;

