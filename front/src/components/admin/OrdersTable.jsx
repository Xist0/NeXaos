import { useCallback, useEffect, useMemo, useState } from "react";
import useApi from "../../hooks/useApi";
import SecureButton from "../ui/SecureButton";
import { formatCurrency } from "../../utils/format";

const statusOptions = [
  { value: "pending", label: "Новый" },
  { value: "processing", label: "В работе" },
  { value: "shipped", label: "Отправлен" },
  { value: "completed", label: "Завершён" },
  { value: "cancelled", label: "Отменён" },
];

const OrdersTable = () => {
  const { get, put } = useApi();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await get("/orders");
      setOrders(response?.data || []);
    } finally {
      setLoading(false);
    }
  }, [get]);

  const handleStatusChange = async (orderId, status) => {
    await put(`/orders/${orderId}`, { status });
    await fetchOrders();
  };

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    if (!filterStatus) return orders;
    return orders.filter((order) => order.status === filterStatus);
  }, [orders, filterStatus]);

  return (
    <section className="glass-card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-night-900">Заказы</h2>
          <p className="text-sm text-night-400">
            {loading ? "Обновляем список..." : `${filteredOrders.length} записей`}
          </p>
        </div>
        <div className="flex gap-3">
          <select
            className="secure-input max-w-xs"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Все статусы</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <SecureButton variant="outline" onClick={fetchOrders}>
            Обновить
          </SecureButton>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-night-400">
              <th className="py-3 pr-4">ID</th>
              <th className="py-3 pr-4">Пользователь</th>
              <th className="py-3 pr-4">Сумма</th>
              <th className="py-3 pr-4">Статус</th>
              <th className="py-3 pr-4">Обновить</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id} className="border-t border-night-100 text-night-900">
                <td className="py-3 pr-4 font-semibold">#{order.id}</td>
                <td className="py-3 pr-4">
                  <p className="font-medium">{order.user_id || "Гость"}</p>
                  <p className="text-xs text-night-400">
                    {new Date(order.created_at).toLocaleString("ru-RU")}
                  </p>
                </td>
                <td className="py-3 pr-4 font-semibold">
                  {formatCurrency(order.total || 0)}
                </td>
                <td className="py-3 pr-4">
                  <select
                    className="secure-input"
                    value={order.status || "pending"}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-3 pr-4">
                  <SecureButton
                    className="px-4 py-2 text-xs"
                    onClick={() => handleStatusChange(order.id, order.status)}
                  >
                    Сохранить
                  </SecureButton>
                </td>
              </tr>
            ))}
            {!filteredOrders.length && !loading && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-night-400">
                  Заказы отсутствуют
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default OrdersTable;

