import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useApi from "../hooks/useApi";
import useCart from "../hooks/useCart";
import ProductCard from "../components/ui/ProductCard";

const categories = [
  { title: "Гостинные", description: "Стенки и ТВ-зоны" },
  { title: "Кухни", description: "Модули и готовые решения" },
  { title: "Спальни", description: "Гардеробы и кровати" },
  { title: "Детские", description: "Уют и безопасность" },
];

const perks = [
  { title: "Доставка по России", text: "Собственная служба логистики и сборщики." },
  { title: "Гарантия 5 лет", text: "Поддержка и сервис по каждому заказу." },
  { title: "Онлайн подбор", text: "Материалы, цвета и размеры в один клик." },
];

const HomePage = () => {
  const { get } = useApi();
  const { addItem } = useCart();
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    let active = true;
    const fetchFeatured = async () => {
      try {
        const response = await get("/modules", { limit: 6 });
        if (active) {
          setFeatured(response?.data || []);
        }
      } catch (error) {
        setFeatured([]);
      }
    };
    fetchFeatured();
    return () => {
      active = false;
    };
  }, [get]);

  return (
    <div className="space-y-16 pb-16">
      <section className="bg-white">
        <div className="shop-container grid gap-10 py-16 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.3em] text-night-400">
              МЕБЕЛЬ ДЛЯ ВАШЕГО ДОМА
            </p>
            <h1 className="text-4xl font-semibold text-night-900 sm:text-5xl">
              Модульные решения в стиле Stolplit — теперь в NeXaos
            </h1>
            <p className="text-lg text-night-500">
              Каталог готовых коллекций, дизайнерских кухонь и шкафов. Выберите материалы,
              цвета и конфигурацию онлайн, а мы соберём и доставим.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/catalog"
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-[#21262d] shadow-md bg-[#e3e161] hover:bg-[#d6d04d] transition"
              >
                Каталог мебели
              </Link>
              <Link
                to="/cart"
                className="rounded-full border border-night-200 px-6 py-3 text-sm font-semibold text-night-700 transition hover:border-night-400 hover:bg-night-50"
              >
                Перейти в корзину
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {perks.map((perk) => (
                <div key={perk.title} className="rounded-2xl border border-night-100 p-4">
                  <p className="text-sm font-semibold text-night-900">{perk.title}</p>
                  <p className="text-sm text-night-500">{perk.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {categories.map((category) => (
              <div
                key={category.title}
                className="glass-card p-5 text-night-900 transition hover:-translate-y-1"
              >
                <p className="text-lg font-semibold">{category.title}</p>
                <p className="text-sm text-night-500">{category.description}</p>
                <Link
                  to="/catalog"
                  className="mt-4 inline-flex text-sm font-semibold text-night-600 hover:text-night-900"
                >
                  Смотреть →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="shop-container space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-night-900">Популярные наборы</h2>
            <p className="text-sm text-night-500">Выбор покупателей, вдохновлённый Stolplit</p>
          </div>
          <Link to="/catalog" className="text-sm font-semibold text-night-600 hover:text-night-900">
            Весь каталог →
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} onAdd={addItem} />
          ))}
          {!featured.length && (
            <div className="glass-card p-6 text-night-500">Загружаем предложения...</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default HomePage;

