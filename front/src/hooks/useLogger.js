import { useCallback } from "react";
import logger from "../services/logger";

const useLogger = () => {
  const pushToast = (type, message) => {
    window.dispatchEvent(new CustomEvent("nexaos-toast", { detail: { type, message } }));
  };

  const info = useCallback(
    (message, meta) => {
      logger.info(message, meta);
    },
    []
  );

  const warn = useCallback(
    (message, meta) => {
      logger.warn(message, meta);
      pushToast("info", message);
    },
    []
  );

  const error = useCallback(
    (message, meta) => {
      logger.error(message, meta);
      pushToast("error", message);
    },
    []
  );

  return { info, warn, error };
};

export default useLogger;

