import { useCallback, useEffect, useMemo, useState } from "react";
import useApi from "../../hooks/useApi";
import SecureButton from "../ui/SecureButton";
import OrderDetailsModal from "./OrderDetailsModal";
import { formatCurrency } from "../../utils/format";
import PopoverSelect from "../ui/PopoverSelect";

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
  const [selectedOrderId, setSelectedOrderId] = useState(null);

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
    try {
      await put(`/orders/${orderId}`, { status });
      await fetchOrders();
    } catch (error) {
      console.error("Не удалось изменить статус заказа", error);
    }
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
          <div className="w-56">
            <PopoverSelect
              size="md"
              items={statusOptions}
              value={filterStatus}
              placeholder="Все статусы"
              allowClear
              clearLabel="Все статусы"
              searchable={statusOptions.length > 10}
              getKey={(option) => String(option.value)}
              getLabel={(option) => String(option.label)}
              onChange={(next) => setFilterStatus(String(next || ""))}
              buttonClassName="secure-input rounded-lg"
              popoverClassName="rounded-lg max-w-md"
              maxHeightClassName="max-h-72"
            />
          </div>
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
              <tr
                key={order.id}
                className="border-t border-night-100 text-night-900 hover:bg-night-50"
              >
                <td 
                  className="py-3 pr-4 font-semibold cursor-pointer"
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  #{order.id}
                </td>
                <td 
                  className="py-3 pr-4 cursor-pointer"
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <p className="font-medium">{order.full_name || order.user_id || "Гость"}</p>
                  <p className="text-xs text-night-400">
                    {new Date(order.created_at).toLocaleString("ru-RU")}
                  </p>
                </td>
                <td 
                  className="py-3 pr-4 font-semibold cursor-pointer"
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  {formatCurrency(order.total || 0)}
                </td>
                <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                  <div onClick={(e) => e.stopPropagation()} className="min-w-[180px]">
                    <PopoverSelect
                      size="sm"
                      items={statusOptions}
                      value={order.status || "pending"}
                      placeholder="Статус"
                      searchable={false}
                      getKey={(option) => String(option.value)}
                      getLabel={(option) => String(option.label)}
                      onChange={(next) => {
                        handleStatusChange(order.id, String(next || "pending"));
                      }}
                      buttonClassName="secure-input rounded-lg"
                      popoverClassName="rounded-lg max-w-md"
                      maxHeightClassName="max-h-72"
                    />
                  </div>
                </td>
                <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                  <SecureButton
                    variant="outline"
                    className="px-3 py-1 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOrderId(order.id);
                    }}
                  >
                    Подробнее
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

      <OrderDetailsModal
        orderId={selectedOrderId}
        isOpen={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        onUpdate={fetchOrders}
      />
    </section>
  );
};

export default OrdersTable;

