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
    if (disabled || busy) return;
    const now = Date.now();
    if (now - lastClickRef.current < 400) {
      return;
    }
    lastClickRef.current = now;
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
        "secure-button",
        variant === "ghost" &&
          "bg-transparent text-night-900 shadow-none border border-night-200 hover:border-night-400 hover:text-night-600",
        variant === "outline" &&
          "bg-white text-night-900 border border-night-200 shadow-sm hover:border-night-400",
        busy && "is-busy",
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

