import clsx from 'clsx';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import useFavoritesStore from '../../store/favoritesStore';

const FavoriteButton = ({ product, className }) => {
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const isFav = isFavorite(product.id);

  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavorite(product);
  };

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'p-2 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/40',
        isFav ? 'bg-accent/20 hover:bg-accent/30' : 'bg-white/80 hover:bg-accent/15',
        className
      )}
      aria-label={isFav ? 'Удалить из избранного' : 'Добавить в избранное'}
    >
      {isFav ? (
        <FaHeart className="h-5 w-5 text-accent" />
      ) : (
        <FaRegHeart className="h-5 w-5 text-night-500" />
      )}
    </button>
  );
};

export default FavoriteButton;
