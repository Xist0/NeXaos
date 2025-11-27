import { Link } from "react-router-dom";
import useCart from "../hooks/useCart";
import SecureButton from "../components/ui/SecureButton";
import { formatCurrency } from "../utils/format";

const CartPage = () => {
  const { items, updateQuantity, removeItem, clearCart, syncing } = useCart();

  const summary = items.reduce(
    (acc, item) => {
      const line = item.price * item.quantity;
      acc.count += item.quantity;
      acc.subtotal += line;
      return acc;
    },
    { count: 0, subtotal: 0 }
  );

  return (
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
          Корзина пуста. <Link to="/catalog" className="text-accent">Перейдите в каталог</Link>, чтобы выбрать мебель.
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
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
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
            <SecureButton className="w-full justify-center" disabled={syncing}>
              Оформить заказ
            </SecureButton>
            <p className="text-xs text-night-400">
              При авторизации корзина сохраняется в аккаунте и доступна с любого устройства.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
};

export default CartPage;

