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
  const { get, post, put } = useApi();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [orderDetails, setOrderDetails] = useState({});
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [messageByOrderId, setMessageByOrderId] = useState({});
  const [sendingByOrderId, setSendingByOrderId] = useState({});
  const [form, setForm] = useState({ fullName: user?.fullName || "", phone: user?.phone || "", email: user?.email || "" });
  const [saving, setSaving] = useState(false);
  const logger = useLogger();

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }
    if (user) {
      setForm({ fullName: user.fullName || "", phone: user.phone || "", email: user.email || "" });
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
      setOrders(response?.data || []);
    } catch (error) {
      logger.error("Не удалось загрузить заказы");
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchOrderDetails = async (orderId) => {
    if (orderDetails[orderId]) return;
    try {
      const response = await get(`/orders/${orderId}`);
      setOrderDetails((prev) => ({ ...prev, [orderId]: response?.data || response }));
    } catch (error) {
      logger.error("Не удалось загрузить детали заказа");
    }
  };

  const refreshOrderDetails = async (orderId) => {
    try {
      const response = await get(`/orders/${orderId}`);
      setOrderDetails((prev) => ({ ...prev, [orderId]: response?.data || response }));
    } catch {
      // ignore
    }
  };

  const handleSendMessage = async (orderId) => {
    const note = String(messageByOrderId[orderId] || "").trim();
    if (!note) return;

    setSendingByOrderId((prev) => ({ ...prev, [orderId]: true }));
    try {
      await post(`/orders/${orderId}/notes`, { note });
      setMessageByOrderId((prev) => ({ ...prev, [orderId]: "" }));
      await refreshOrderDetails(orderId);
    } catch (error) {
      logger.error("Не удалось отправить сообщение");
    } finally {
      setSendingByOrderId((prev) => ({ ...prev, [orderId]: false }));
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
      await put(`/users/${user.id}`, { full_name: form.fullName, phone: form.phone });
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

  const getStatusLabel = (status) => ({ pending: "Новый", processing: "В работе", shipped: "Отправлен", completed: "Завершён", cancelled: "Отменён" }[status] || status);
  const getStatusColor = (status) => ({ pending: "bg-yellow-100 text-yellow-800", processing: "bg-blue-100 text-blue-800", shipped: "bg-purple-100 text-purple-800", completed: "bg-green-100 text-green-800", cancelled: "bg-red-100 text-red-800" }[status] || "bg-gray-100 text-gray-800");

  if (!token) return null;

  return (
    <div className="shop-container py-8 md:py-12">
      <div className="mb-6 md:mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-night-400">Личный кабинет</p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-night-900">Мой профиль</h1>
      </div>

      <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 md:mb-8 border-b border-night-100">
        <TabButton id="orders" activeTab={activeTab} setActiveTab={setActiveTab}>Мои заказы</TabButton>
        <TabButton id="profile" activeTab={activeTab} setActiveTab={setActiveTab}>Личные данные</TabButton>
      </div>

      <div>
        {activeTab === "orders" && (
          <OrdersTab
            orders={orders}
            loading={ordersLoading}
            expandedId={expandedOrderId}
            onToggle={handleToggleOrder}
            details={orderDetails}
            getStatusLabel={getStatusLabel}
            getStatusColor={getStatusColor}
            messageByOrderId={messageByOrderId}
            setMessageByOrderId={setMessageByOrderId}
            sendingByOrderId={sendingByOrderId}
            onSendMessage={handleSendMessage}
          />
        )}
        {activeTab === "profile" && <ProfileTab form={form} onChange={handleChange} onSave={handleSave} saving={saving} />}
      </div>
    </div>
  );
};

const TabButton = ({ id, activeTab, setActiveTab, children }) => (
  <button
    onClick={() => setActiveTab(id)}
    className={`px-4 sm:px-5 py-2.5 text-sm sm:text-base font-semibold transition-colors duration-200 border-b-2 ${activeTab === id ? "border-accent text-accent" : "border-transparent text-night-500 hover:text-night-900"}`}>
    {children}
  </button>
);

const OrdersTab = ({
  orders,
  loading,
  expandedId,
  onToggle,
  details,
  getStatusLabel,
  getStatusColor,
  messageByOrderId,
  setMessageByOrderId,
  sendingByOrderId,
  onSendMessage,
}) => (
  <div>
    <h2 className="text-xl sm:text-2xl font-semibold text-night-900 mb-4">Мои заказы</h2>
    {loading ? (
      <div className="glass-card p-8 text-center text-night-500">Загрузка...</div>
    ) : orders.length === 0 ? (
      <div className="glass-card p-8 text-center text-night-500">У вас пока нет заказов</div>
    ) : (
      <div className="space-y-4">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            isExpanded={expandedId === order.id}
            onToggle={onToggle}
            details={details[order.id]}
            getStatusLabel={getStatusLabel}
            getStatusColor={getStatusColor}
            messageValue={messageByOrderId[order.id] || ""}
            setMessageValue={(value) => setMessageByOrderId((prev) => ({ ...prev, [order.id]: value }))}
            sending={Boolean(sendingByOrderId[order.id])}
            onSend={() => onSendMessage(order.id)}
          />
        ))}
      </div>
    )}
  </div>
);

const OrderCard = ({
  order,
  isExpanded,
  onToggle,
  details,
  getStatusLabel,
  getStatusColor,
  messageValue,
  setMessageValue,
  sending,
  onSend,
}) => (
  <div className="glass-card rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200">
    <div className="p-4 cursor-pointer" onClick={() => onToggle(order.id)}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-2">
            <span className="font-semibold text-night-900">Заказ #{order.id}</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status || "pending")}`}>{getStatusLabel(order.status || "pending")}</span>
          </div>
          <p className="text-sm text-night-500">
            {new Date(order.created_at).toLocaleString("ru-RU", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="text-left sm:text-right mt-2 sm:mt-0">
          <p className="text-lg font-semibold text-night-900">{formatCurrency(order.total || 0)}</p>
          <p className={`text-xs text-night-400 mt-1 transition-transform duration-200 transform ${isExpanded ? "rotate-180" : ""}`}>▼</p>
        </div>
      </div>
    </div>
    {isExpanded && details && (
      <div className="border-t border-night-100 bg-night-50/50 p-4 space-y-4">
        {details.items?.length > 0 && (
          <div>
            <h4 className="font-semibold text-night-900 mb-2">Товары:</h4>
            <div className="space-y-2">{details.items.map(item => <div key={item.id} className="bg-white rounded p-2 flex justify-between text-sm"><span>{item.module_name || `Модуль #${item.module_id}`} × {item.qty}</span><span className="font-medium">{formatCurrency((item.price || 0) * (item.qty || 0))}</span></div>)}</div>
          </div>
        )}
        <div>
          <h4 className="font-semibold text-night-900 mb-2">Чат по заказу:</h4>
          {details.notes?.length > 0 ? (
            <div className="space-y-2">
              {details.notes.map((note) => (
                <div key={note.id} className="bg-white rounded p-3 text-sm border-l-4 border-accent">
                  <p className="text-night-900 whitespace-pre-wrap">{note.note}</p>
                  <p className="text-xs text-night-500 mt-1">
                    {new Date(note.created_at).toLocaleString("ru-RU")} {note.author_name && `• ${note.author_name}`}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-night-500">Сообщений пока нет</p>
          )}

          <div className="mt-4">
            <label className="text-sm font-medium text-night-700">Ваше сообщение</label>
            <textarea
              value={messageValue}
              onChange={(e) => setMessageValue(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-night-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
              placeholder="Напишите сообщение менеджеру..."
            />
            <div className="mt-2 flex justify-end">
              <SecureButton onClick={onSend} disabled={sending || !String(messageValue || "").trim()} className="px-4 py-2 text-sm">
                {sending ? "Отправка..." : "Отправить"}
              </SecureButton>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);

const ProfileTab = ({ form, onChange, onSave, saving }) => (
  <div className="glass-card p-6 sm:p-8">
    <h2 className="text-xl sm:text-2xl font-semibold text-night-900 mb-6">Личные данные</h2>
    <div className="space-y-4 max-w-md mx-auto">
      <div>
        <label className="text-sm font-medium text-night-700">Имя</label>
        <SecureInput value={form.fullName} onChange={onChange("fullName")} placeholder="Иван Иванов" className="mt-1" />
      </div>
      <div>
        <label className="text-sm font-medium text-night-700">Email</label>
        <SecureInput type="email" value={form.email} disabled className="mt-1 opacity-60 bg-night-50" />
        <p className="text-xs text-night-400 mt-1">Email нельзя изменить</p>
      </div>
      <div>
        <label className="text-sm font-medium text-night-700">Телефон</label>
        <PhoneInput value={form.phone} onChange={onChange("phone")} placeholder="+7 (000) - 000 - 00 -00" className="mt-1" />
      </div>
      <div className="pt-4">
        <SecureButton onClick={onSave} disabled={saving} className="w-full justify-center py-3 text-base">
          {saving ? "Сохранение..." : "Сохранить изменения"}
        </SecureButton>
      </div>
    </div>
  </div>
);

export default AccountPage;
