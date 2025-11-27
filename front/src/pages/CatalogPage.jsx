import { useEffect, useMemo, useState } from "react";
import useApi from "../hooks/useApi";
import useCart from "../hooks/useCart";
import SecureInput from "../components/ui/SecureInput";
import ProductCard from "../components/ui/ProductCard";

const CatalogPage = () => {
  const { get } = useApi();
  const { addItem } = useCart();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    const fetchItems = async () => {
      setLoading(true);
      try {
        const response = await get("/modules", debouncedQuery ? { search: debouncedQuery } : undefined);
        if (active) {
          setItems(response?.data || []);
        }
      } catch (error) {
        if (active) {
          setItems([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchItems();
    return () => {
      active = false;
    };
  }, [debouncedQuery, get]);

  const grouped = useMemo(() => {
    if (!items.length) return [];
    return [
      {
        title: "Готовые решения",
        products: items.filter((item) => item.is_active).slice(0, 6),
      },
      {
        title: "Модули по частям",
        products: items.filter((item) => item.is_active).slice(6, 12),
      },
    ].filter((group) => group.products.length);
  }, [items]);

  return (
    <div className="shop-container space-y-10 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-night-400">Каталог</p>
          <h1 className="text-3xl font-semibold text-night-900">Каталог мебели</h1>
          <p className="text-sm text-night-500">
            Найдите мебель под стиль Stolplit: кухни, гостиные, спальни и модули хранения.
          </p>
        </div>
        <SecureInput
          value={query}
          onChange={setQuery}
          placeholder="Поиск по названию или артикулу"
          className="min-w-[260px]"
        />
      </div>

      {loading ? (
        <div className="glass-card p-6 text-night-500">Загружаем товары...</div>
      ) : (
        grouped.map((group) => (
          <section key={group.title} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-night-900">{group.title}</h2>
              <span className="text-sm text-night-400">
                {group.products.length} позици{group.products.length > 1 ? "й" : "я"}
              </span>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {group.products.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={addItem} />
              ))}
            </div>
          </section>
        ))
      )}

      {!loading && !items.length && (
        <div className="glass-card p-6 text-night-500">
          Мы не нашли таких товаров. Попробуйте другой запрос или перейдите в готовые коллекции.
        </div>
      )}
    </div>
  );
};

export default CatalogPage;

