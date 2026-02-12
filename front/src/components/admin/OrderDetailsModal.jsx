import { useEffect, useRef, useState } from "react";
import useApi from "../../hooks/useApi";
import SecureButton from "../ui/SecureButton";
import { formatCurrency } from "../../utils/format";
import useLogger from "../../hooks/useLogger";

const OrderDetailsModal = ({ orderId, isOpen, onClose, onUpdate }) => {
  const { get, post, put } = useApi();
  const logger = useLogger();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const modalRef = useRef(null);


  

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderDetails();
    }
  }, [isOpen, orderId]);

  useEffect(() => {
    if (!isOpen) return;

    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);

    // фокус на модалке, чтобы колесо/клавиши не уходили на фон
    setTimeout(() => modalRef.current?.focus(), 0);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [isOpen, onClose]);

  const fetchOrderDetails = async () => {
    setLoading(true);
    try {
      const response = await get(`/orders/${orderId}`);
      const orderData = response?.data || response;
      // Убеждаемся, что notes всегда массив
      if (orderData && !Array.isArray(orderData.notes)) {
        orderData.notes = [];
      }
      setOrder(orderData);
    } catch (error) {
      logger.error("Не удалось загрузить заказ", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setSavingNote(true);
    try {
      const response = await post("/order-notes", {
        order_id: orderId,
        note: newNote.trim(),
        is_private: isPrivate,
      });
      
      // Добавляем новую заметку сразу в состояние, если она есть в ответе
      if (response?.data) {
        const newNoteData = {
          ...response.data,
          author_name: "Вы", // Временно, пока не загрузим обновленные данные
        };
        setOrder((prevOrder) => ({
          ...prevOrder,
          notes: [newNoteData, ...(prevOrder?.notes || [])],
        }));
      }
      
      setNewNote("");
      setIsPrivate(false);
      
      // Обновляем заказ для получения полных данных (с author_name)
      await fetchOrderDetails();
      if (onUpdate) onUpdate();
      logger.info("Заметка добавлена");
    } catch (_error) {
      logger.error("Не удалось добавить заметку");
    } finally {
      setSavingNote(false);
    }
  };

  const handleTogglePrivate = async (noteId, currentPrivate) => {
    try {
      await put(`/order-notes/${noteId}`, {
        is_private: !currentPrivate,
      });
      await fetchOrderDetails();
      if (onUpdate) onUpdate();
      logger.info("Видимость заметки изменена");
    } catch (_error) {
      logger.error("Не удалось изменить видимость заметки");
    }
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      pending: "Новый",
      processing: "В работе",
      shipped: "Отправлен",
      completed: "Завершён",
      cancelled: "Отменён",
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      shipped: "bg-purple-100 text-purple-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colorMap[status] || "bg-gray-100 text-gray-800";
  };

  const handleBackdropClick = (e) => {
    // Закрываем только если клик был по фону, а не по содержимому модального окна
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 relative shadow-2xl rounded-2xl bg-white border border-night-200 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label="Закрыть"
          className="absolute right-4 top-4 text-night-400 hover:text-night-700 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-night-100 transition-colors"
          onClick={onClose}
        >
          ✕
        </button>

        {loading ? (
          <div className="text-center py-8 text-night-500">Загрузка...</div>
        ) : order ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-night-900 mb-2">
                Заказ #{order.id}
              </h2>
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                    order.status || "pending"
                  )}`}
                >
                  {getStatusLabel(order.status || "pending")}
                </span>
                <span className="text-sm text-night-500">
                  {new Date(order.created_at).toLocaleString("ru-RU")}
                </span>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-night-900">Информация о клиенте</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-night-500">Имя:</span>{" "}
                    <span className="font-medium text-night-900">
                      {order.full_name || "Не указано"}
                    </span>
                  </div>
                  <div>
                    <span className="text-night-500">Email:</span>{" "}
                    <span className="font-medium text-night-900">
                      {order.email || "Не указано"}
                    </span>
                  </div>
                  <div>
                    <span className="text-night-500">Телефон:</span>{" "}
                    <span className="font-medium text-night-900">
                      {order.phone || "Не указано"}
                    </span>
                  </div>
                  <div>
                    <span className="text-night-500">ID пользователя:</span>{" "}
                    <span className="font-medium text-night-900">
                      {order.user_id || "Гость"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-night-900">Детали заказа</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-night-500">Сумма заказа:</span>
                    <span className="font-semibold text-night-900 text-lg">
                      {formatCurrency(order.total || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-night-500">Товаров:</span>{" "}
                    <span className="font-medium text-night-900">
                      {order.items?.length || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {order.items && order.items.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-night-900 mb-3">Товары в заказе</h3>
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="border border-night-100 rounded-lg p-3 flex justify-between items-center"
                    >
                      <div>
                        <p className="font-medium text-night-900">
                          {item.module_name || `Модуль #${item.module_id}`}
                        </p>
                        {item.module_sku && (
                          <p className="text-xs text-night-500">Артикул: {item.module_sku}</p>
                        )}
                        <p className="text-sm text-night-500">
                          Количество: {item.qty} × {formatCurrency(item.price || 0)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-night-900">
                          {formatCurrency((item.price || 0) * (item.qty || 0))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold text-night-900 mb-3">Заметки</h3>
              
              <div className="space-y-3 mb-4">
                {order.notes && order.notes.length > 0 ? (
                  order.notes.map((note) => (
                    <div
                      key={note.id}
                      className={`rounded-xl border p-3 ${
                        note.is_private
                          ? "border-night-200 bg-night-50"
                          : "border-night-100 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {note.is_private && (
                              <span className="px-2 py-0.5 bg-night-100 text-night-700 text-xs rounded-full font-semibold">
                                Только для администратора
                              </span>
                            )}
                            <span className="text-xs text-night-500">
                              {note.author_name || "Администратор"} •{" "}
                              {new Date(note.created_at).toLocaleString("ru-RU")}
                            </span>
                          </div>
                          <p className="text-sm text-night-900">{note.note}</p>
                        </div>
                        <SecureButton
                          variant="ghost"
                          className="px-2 py-1 text-xs whitespace-nowrap"
                          onClick={() => handleTogglePrivate(note.id, note.is_private)}
                        >
                          {note.is_private ? "Сделать видимой всем" : "Только для администратора"}
                        </SecureButton>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-night-500">Заметок пока нет</p>
                )}
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddNote();
                }}
                className="border border-night-200 rounded-xl p-4 bg-night-50"
              >
                <div className="space-y-3">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Добавить заметку..."
                    className="secure-input w-full min-h-[92px] resize-y"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPrivate((v) => !v)}
                      className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg border transition ${
                        isPrivate
                          ? "border-night-300 bg-white text-night-900"
                          : "border-night-200 bg-white/70 text-night-600"
                      }`}
                    >
                      <span
                        className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                          isPrivate ? "border-night-400 bg-night-100" : "border-night-300 bg-white"
                        }`}
                      >
                        {isPrivate ? "✓" : ""}
                      </span>
                      Только для администратора
                    </button>
                    <SecureButton
                      type="submit"
                      disabled={!newNote.trim() || savingNote}
                      className="ml-auto"
                    >
                      {savingNote ? "Добавление..." : "Добавить"}
                    </SecureButton>
                  </div>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-night-500">Заказ не найден</div>
        )}
      </div>
    </div>
  );
};

export default OrderDetailsModal;

