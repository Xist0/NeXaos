import useFavoritesStore from '../store/favoritesStore';
import useCart from '../hooks/useCart';
import ProductCard from '../components/ui/ProductCard';
import { Link } from 'react-router-dom';

const FavoritesPage = () => {
  const { favorites } = useFavoritesStore();
  const { addItem } = useCart();

  return (
    <div className="shop-container py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-night-900">Избранное</h1>
        <p className="text-sm text-night-500">
          Товары, которые вы отметили.
        </p>
      </div>

      {favorites.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-night-600">В избранном пока пусто.</p>
          <p className="mt-2 text-sm text-night-400">
            Нажмите на сердечко в карточке товара, чтобы добавить его сюда.
          </p>
          <Link to="/catalog" className="mt-4 inline-block text-accent font-semibold hover:underline">
            Перейти в каталог
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {favorites.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={addItem}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;
