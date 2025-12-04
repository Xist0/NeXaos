import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import useCart from "../hooks/useCart";
import SecureButton from "../components/ui/SecureButton";
import { formatCurrency } from "../utils/format";
import useApi from "../hooks/useApi";
import useAuthStore from "../store/authStore";
import useLogger from "../hooks/useLogger";

// ✅ ВЫНЕСЕННЫЙ КОМПОНЕНТ
const SuccessModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur flex items-center justify-center">
      <div className="glass-card w-full max-w-md p-8 relative">
        <button
          aria-label="Закрыть"
          className="absolute right-4 top-4 text-night-400 hover:text-night-700 text-xl"
          onClick={onClose}
        >
          ✕
        </button>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-600 text-2xl">✓</span>
          </div>
          <h2 className="text-2xl font-semibold text-night-900">Заказ принят!</h2>
          <p className="text-night-500">
            Менеджер свяжется с вами в ближайшее время для уточнения деталей.
          </p>
          <SecureButton onClick={onClose} className="w-full justify-center">
            Закрыть
          </SecureButton>
        </div>
      </div>
    </div>
  );
};

const CartPage = () => {
  const { items, updateQuantity, removeItem, clearCart, syncing } = useCart();
  const { post } = useApi();
  const { user } = useAuthStore();
  const logger = useLogger();
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef(null);

  const summary = items.reduce(
    (acc, item) => {
      const line = item.price * item.quantity;
      acc.count += item.quantity;
      acc.subtotal += line;
      return acc;
    },
    { count: 0, subtotal: 0 }
  );

  const handleCheckout = async () => {
    if (items.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const orderData = {
        status: "pending",
        total: summary.subtotal,
        ...(user?.id && { user_id: user.id }),
      };

      const orderResponse = await post("/orders", orderData);
      const order = orderResponse?.data || orderResponse;

      if (!order?.id) throw new Error("Не удалось создать заказ");

      const orderItemsPromises = items.map((item) =>
        post("/order-items", {
          order_id: order.id,
          module_id: item.id,
          qty: item.quantity,
          price: item.price,
          cost_price: item.price * 0.7,
        })
      );

      await Promise.all(orderItemsPromises);
      clearCart();

      setIsSuccessModalOpen(true);
      logger.info("Заказ успешно оформлен");
    } catch (error) {
      logger.error("Не удалось оформить заказ. Попробуйте ещё раз.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setIsSuccessModalOpen(false);
      }
    };

    if (isSuccessModalOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isSuccessModalOpen]);

  return (
    <>
      <div className="shop-container py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-night-400">Корзина</p>
            <h1 className="text-3xl font-semibold text-night-900">Ваш заказ</h1>
          </div>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-sm font-semibold text-night-400 hover:text-night-700"
            >
              Очистить корзину
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="mt-10 glass-card p-8 text-center text-night-500">
            Корзина пуста.{" "}
            <Link to="/catalog" className="text-accent">
              Перейдите в каталог
            </Link>
            , чтобы выбрать мебель.
          </div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[2fr,1fr]">
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.id} className="glass-card flex flex-col gap-4 p-5 sm:flex-row">
                  <div className="h-28 w-full rounded-xl bg-night-100 sm:w-40">
                    <img
                      src={
                        item.image ||
                        "https://images.unsplash.com/photo-1505692794400-0d9dc9c65f0e?auto=format&fit=crop&w=400&q=80"
                      }
                      alt={item.name}
                      className="h-full w-full rounded-xl object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-night-900">{item.name}</p>
                        <p className="text-sm text-night-400">{item.sku || "SKU не указан"}</p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-sm text-night-400 hover:text-night-700"
                      >
                        Удалить
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="inline-flex items-center rounded-full border border-night-100">
                        <button
                          className="px-3 py-2 text-night-500 hover:text-night-900"
                          onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                          disabled={item.quantity <= 1}
                        >
                          -
                        </button>
                        <span className="px-4 text-sm font-semibold">{item.quantity}</span>
                        <button
                          className="px-3 py-2 text-night-500 hover:text-night-900"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <p className="text-xl font-semibold text-night-900">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <aside className="glass-card flex flex-col gap-4 p-6">
              <h2 className="text-xl font-semibold text-night-900">Итого</h2>
              <div className="flex justify-between text-sm text-night-500">
                <span>Товары ({summary.count})</span>
                <span>{formatCurrency(summary.subtotal)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold text-night-900">
                <span>К оплате</span>
                <span>{formatCurrency(summary.subtotal)}</span>
              </div>
              <SecureButton
                onClick={handleCheckout}
                className="w-full justify-center"
                disabled={syncing || isSubmitting || items.length === 0}
              >
                {isSubmitting ? "Отправка..." : "Оформить заказ"}
              </SecureButton>
              <p className="text-xs text-night-400">
                При авторизации корзина сохраняется в аккаунте и доступна с любого устройства.
              </p>
            </aside>
          </div>
        )}
      </div>

      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
      />
    </>
  );
};

export default CartPage;