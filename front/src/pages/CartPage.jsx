import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import useCart from "../hooks/useCart";
import SecureButton from "../components/ui/SecureButton";
import { formatCurrency } from "../utils/format";
import useApi from "../hooks/useApi";
import useAuthStore from "../store/authStore";
import useLogger from "../hooks/useLogger";
import { getImageUrl, placeholderImage } from "../utils/image";

const SuccessModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-8 relative">
        <button aria-label="Закрыть" className="absolute right-4 top-4 text-night-400 hover:text-night-700 text-xl" onClick={onClose}>
          ✕
        </button>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-600 text-3xl">✓</span>
          </div>
          <h2 className="text-2xl font-semibold text-night-900">Заказ принят!</h2>
          <p className="text-night-500">Менеджер свяжется с вами в ближайшее время для уточнения деталей.</p>
          <SecureButton onClick={onClose} className="w-full justify-center">Закрыть</SecureButton>
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

  const summary = items.reduce((acc, item) => {
    acc.count += item.quantity;
    acc.subtotal += item.price * item.quantity;
    return acc;
  }, { count: 0, subtotal: 0 });

  const handleCheckout = async () => {
    if (items.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const orderResponse = await post("/orders", { status: "pending", total: summary.subtotal, ...(user?.id && { user_id: user.id }) });
      const order = orderResponse?.data || orderResponse;
      if (!order?.id) throw new Error("Не удалось создать заказ");

      await Promise.all(
        items.map((item) => {
          const entityType = String(item?.entity_type || "modules");
          const entityId = Number(item?.id);
          const payload = {
            order_id: order.id,
            qty: item.quantity,
            price: item.price,
            cost_price: item.price * 0.7,
            entity_type: entityType,
            entity_id: entityId,
            ...(entityType === "modules" ? { module_id: entityId } : {}),
          };
          return post("/order-items", payload);
        })
      );
      clearCart();
      setIsSuccessModalOpen(true);
      logger.info("Заказ успешно оформлен");
    } catch (error) {
      logger.error("Не удалось оформить заказ. Попробуйте ещё раз.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="shop-container py-8 md:py-12">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 md:mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-night-400">Корзина</p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-night-900">Ваш заказ</h1>
          </div>
          {items.length > 0 && (
            <button onClick={clearCart} className="text-sm font-semibold text-night-400 hover:text-night-700 hover:underline">
              Очистить корзину
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="mt-10 glass-card p-8 text-center text-night-500">
            Корзина пуста. <Link to="/catalog" className="text-accent font-semibold hover:underline">Перейдите в каталог</Link>, чтобы выбрать мебель.
          </div>
        ) : (
          <div className="mt-8 md:mt-10 grid gap-8 lg:grid-cols-[1.5fr,1fr] xl:grid-cols-[2fr,1fr]">
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.id} className="glass-card flex flex-col sm:flex-row gap-4 p-4">
                  <div className="h-32 w-full sm:w-32 flex-shrink-0 rounded-lg bg-night-100">
                    <img
                      src={getImageUrl(item.image) || placeholderImage}
                      alt={item.name}
                      className="h-full w-full rounded-lg object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        if (e.target.src !== placeholderImage) e.target.src = placeholderImage;
                      }}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-night-900 leading-tight">{item.name}</p>
                        <p className="text-xs sm:text-sm text-night-400">{item.sku || "SKU не указан"}</p>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="text-xs text-night-400 hover:text-night-700 font-semibold">Удалить</button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4 mt-auto">
                      <div className="inline-flex items-center rounded-full border border-night-100">
                        <button className="px-3 py-1.5 text-night-500 hover:text-night-900" onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} disabled={item.quantity <= 1}>–</button>
                        <span className="px-3 text-sm font-semibold w-10 text-center">{item.quantity}</span>
                        <button className="px-3 py-1.5 text-night-500 hover:text-night-900" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                      </div>
                      <p className="text-lg font-semibold text-night-900">{formatCurrency(item.price * item.quantity)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <aside className="glass-card self-start sticky top-24 flex flex-col gap-4 p-6">
              <h2 className="text-xl font-semibold text-night-900">Итого</h2>
              <div className="flex justify-between text-sm text-night-500">
                <span>Товары ({summary.count})</span>
                <span>{formatCurrency(summary.subtotal)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold text-night-900">
                <span>К оплате</span>
                <span>{formatCurrency(summary.subtotal)}</span>
              </div>
              <SecureButton onClick={handleCheckout} className="w-full justify-center py-3 text-base" disabled={syncing || isSubmitting || items.length === 0}>
                {isSubmitting ? "Отправка..." : "Оформить заказ"}
              </SecureButton>
              <p className="text-xs text-night-400 text-center">
                При авторизации корзина сохраняется в аккаунте и доступна с любого устройства.
              </p>
            </aside>
          </div>
        )}
      </div>
      <SuccessModal isOpen={isSuccessModalOpen} onClose={() => setIsSuccessModalOpen(false)} />
    </>
  );
};

export default CartPage;
