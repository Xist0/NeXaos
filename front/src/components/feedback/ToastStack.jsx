import { useEffect, useState } from "react";

const ToastStack = () => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const uuid = () =>
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2));

    const handler = (event) => {
      const toast = {
        id: uuid(),
        type: event.detail?.type || "info",
        message: event.detail?.message || "Событие зафиксировано",
      };
      setMessages((prev) => [...prev, toast]);
      setTimeout(
        () => setMessages((prev) => prev.filter((item) => item.id !== toast.id)),
        4000
      );
    };

    window.addEventListener("nexaos-toast", handler);
    return () => window.removeEventListener("nexaos-toast", handler);
  }, []);

  if (!messages.length) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {messages.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
};

export default ToastStack;

