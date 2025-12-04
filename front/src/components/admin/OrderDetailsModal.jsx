import { useState, useEffect } from "react";
import useApi from "../../hooks/useApi";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
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

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderDetails();
    }
  }, [isOpen, orderId]);

  const fetchOrderDetails = async () => {
    setLoading(true);
    try {
      const response = await get(`/orders/${orderId}`);
      setOrder(response?.data || response);
    } catch (error) {
      logger.error("Не удалось загрузить заказ");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setSavingNote(true);
    try {
      await post("/order-notes", {
        order_id: orderId,
        note: newNote.trim(),
        is_private: isPrivate,
      });
      setNewNote("");
      setIsPrivate(false);
      await fetchOrderDetails(); // Обновляем заказ для получения новых заметок
      if (onUpdate) onUpdate();
      logger.info("Заметка добавлена");
    } catch (error) {
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
    } catch (error) {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 relative">
        <button
          aria-label="Закрыть"
          className="absolute right-4 top-4 text-night-400 hover:text-night-700 text-xl"
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
                      className={`border rounded-lg p-3 ${
                        note.is_private
                          ? "border-orange-200 bg-orange-50"
                          : "border-night-100 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {note.is_private && (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-full">
                                Приватная
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
                          className="px-2 py-1 text-xs"
                          onClick={() => handleTogglePrivate(note.id, note.is_private)}
                        >
                          {note.is_private ? "Сделать публичной" : "Сделать приватной"}
                        </SecureButton>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-night-500">Заметок пока нет</p>
                )}
              </div>

              <div className="border border-night-200 rounded-lg p-4 bg-night-50">
                <div className="space-y-3">
                  <SecureInput
                    value={newNote}
                    onChange={setNewNote}
                    placeholder="Добавить заметку..."
                    className="w-full"
                  />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-night-700">
                      <input
                        type="checkbox"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="rounded"
                      />
                      Приватная заметка (только для администраторов)
                    </label>
                    <SecureButton
                      onClick={handleAddNote}
                      disabled={!newNote.trim() || savingNote}
                      className="ml-auto"
                    >
                      {savingNote ? "Добавление..." : "Добавить"}
                    </SecureButton>
                  </div>
                </div>
              </div>
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

