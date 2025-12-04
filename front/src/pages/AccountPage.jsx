import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useApi from "../hooks/useApi";
import useAuthStore from "../store/authStore";
import { fetchProfile } from "../services/auth.service";
import SecureButton from "../components/ui/SecureButton";
import SecureInput from "../components/ui/SecureInput";
import PhoneInput from "../components/ui/PhoneInput";
import { formatCurrency } from "../utils/format";
import useLogger from "../hooks/useLogger";

const AccountPage = () => {
  const { user, token } = useAuth();
  const { get, put } = useApi();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [orderDetails, setOrderDetails] = useState({});
  const [loading, setLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    phone: user?.phone || "",
    email: user?.email || "",
  });
  const [saving, setSaving] = useState(false);
  const logger = useLogger();

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }
    if (user) {
      setForm({
        fullName: user.fullName || "",
        phone: user.phone || "",
        email: user.email || "",
      });
    }
  }, [user, token, navigate]);

  useEffect(() => {
    if (activeTab === "orders" && token) {
      fetchOrders();
    }
  }, [activeTab, token]);

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const response = await get("/orders");
      const allOrders = response?.data || [];
      // Фильтруем заказы текущего пользователя
      const userOrders = allOrders.filter((order) => order.user_id === user?.id);
      setOrders(userOrders);
    } catch (error) {
      logger.error("Не удалось загрузить заказы");
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchOrderDetails = async (orderId) => {
    if (orderDetails[orderId]) return; // Уже загружены

    try {
      const response = await get(`/orders/${orderId}`);
      setOrderDetails((prev) => ({
        ...prev,
        [orderId]: response?.data || response,
      }));
    } catch (error) {
      logger.error("Не удалось загрузить детали заказа");
    }
  };

  const handleToggleOrder = (orderId) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(orderId);
      fetchOrderDetails(orderId);
    }
  };

  const handleChange = (field) => (value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await put(`/users/${user.id}`, {
        full_name: form.fullName,
        phone: form.phone,
      });
      // Обновляем данные пользователя в store
      const updatedUser = await fetchProfile();
      useAuthStore.setState({ user: updatedUser });
      localStorage.setItem("nexaos_user", JSON.stringify(updatedUser));
      logger.info("Профиль обновлён");
    } catch (error) {
      logger.error("Не удалось сохранить изменения профиля");
    } finally {
      setSaving(false);
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

  if (!token) {
    return null;
  }

  return (
    <div className="shop-container py-12">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-night-400">Личный кабинет</p>
        <h1 className="text-3xl font-semibold text-night-900">Мой профиль</h1>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <SecureButton
          variant={activeTab === "orders" ? "primary" : "outline"}
          className="px-5 py-2 text-sm"
          onClick={() => setActiveTab("orders")}
        >
          Мои заказы
        </SecureButton>
        <SecureButton
          variant={activeTab === "profile" ? "primary" : "outline"}
          className="px-5 py-2 text-sm"
          onClick={() => setActiveTab("profile")}
        >
          Личные данные
        </SecureButton>
      </div>

      {activeTab === "orders" && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-night-900 mb-4">Мои заказы</h2>
          {ordersLoading ? (
            <div className="text-center py-8 text-night-500">Загрузка...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-night-500">
              У вас пока нет заказов
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const details = orderDetails[order.id];
                const isExpanded = expandedOrderId === order.id;

                return (
                  <div
                    key={order.id}
                    className="border border-night-100 rounded-lg overflow-hidden hover:shadow-md transition"
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => handleToggleOrder(order.id)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-semibold text-night-900">
                              Заказ #{order.id}
                            </span>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                order.status || "pending"
                              )}`}
                            >
                              {getStatusLabel(order.status || "pending")}
                            </span>
                          </div>
                          <p className="text-sm text-night-500">
                            {new Date(order.created_at).toLocaleString("ru-RU", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-night-900">
                            {formatCurrency(order.total || 0)}
                          </p>
                          <p className="text-xs text-night-400 mt-1">
                            {isExpanded ? "Свернуть" : "Подробнее"} ▼
                          </p>
                        </div>
                      </div>
                    </div>

                    {isExpanded && details && (
                      <div className="border-t border-night-100 bg-night-50 p-4 space-y-4">
                        {details.items && details.items.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-night-900 mb-2">Товары:</h4>
                            <div className="space-y-2">
                              {details.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="bg-white rounded p-2 flex justify-between text-sm"
                                >
                                  <span>
                                    {item.module_name || `Модуль #${item.module_id}`} × {item.qty}
                                  </span>
                                  <span className="font-medium">
                                    {formatCurrency((item.price || 0) * (item.qty || 0))}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {details.notes && details.notes.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-night-900 mb-2">Заметки:</h4>
                            <div className="space-y-2">
                              {details.notes.map((note) => (
                                <div
                                  key={note.id}
                                  className="bg-white rounded p-3 text-sm border-l-4 border-accent"
                                >
                                  <p className="text-night-900">{note.note}</p>
                                  <p className="text-xs text-night-500 mt-1">
                                    {new Date(note.created_at).toLocaleString("ru-RU")}
                                    {note.author_name && ` • ${note.author_name}`}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(!details.notes || details.notes.length === 0) && (
                          <p className="text-sm text-night-500">Заметок пока нет</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "profile" && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-night-900 mb-6">Личные данные</h2>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="text-sm font-medium text-night-700">Имя</label>
              <SecureInput
                value={form.fullName}
                onChange={handleChange("fullName")}
                placeholder="Иван Иванов"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-night-700">Email</label>
              <SecureInput
                type="email"
                value={form.email}
                disabled
                className="opacity-60"
              />
              <p className="text-xs text-night-400 mt-1">
                Email нельзя изменить
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-night-700">Телефон</label>
              <PhoneInput
                value={form.phone}
                onChange={handleChange("phone")}
                placeholder="+7 (000) - 000 - 00 -00"
              />
            </div>
            <div className="pt-4">
              <SecureButton
                onClick={handleSave}
                disabled={saving}
                className="w-full justify-center"
              >
                {saving ? "Сохранение..." : "Сохранить изменения"}
              </SecureButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountPage;

