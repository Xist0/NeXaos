import { useRef, useState } from "react";
import useLogger from "../../hooks/useLogger";

const SecureButton = ({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
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
      className={`secure-button secure-button--${variant} ${busy ? "is-busy" : ""}`}
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

