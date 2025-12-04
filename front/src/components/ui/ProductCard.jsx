import { Link } from "react-router-dom";
import SecureButton from "./SecureButton";
import { formatCurrency } from "../../utils/format";
import ColorBadge from "./ColorBadge";

const placeholderImage =
  "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80";

const ProductCard = ({ product, onAdd }) => {
  // Формируем URL изображения с учетом относительных путей
  const getImageUrl = (url) => {
    if (!url) return placeholderImage;
    
    // Если URL начинается с /uploads, это относительный путь
    if (url.startsWith('/uploads/')) {
      // В dev режиме используем полный URL к бэкенду
      if (import.meta.env.DEV) {
        // Бэкенд работает на порту 5000
        return `http://localhost:5000${url}`;
      }
      // В prod используем относительный путь (через прокси)
      return url;
    }
    
    // Если это полный URL, возвращаем как есть
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // Для других относительных путей
    if (url.startsWith('/')) {
      return url;
    }
    
    return url;
  };

  const image = getImageUrl(
    product.image ||
    product.image_url ||
    product.preview_url
  );

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onAdd?.(product);
  };

  return (
    <article className="glass-card flex flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-2xl">
      <Link 
        to={`/catalog/${product.id}`}
        className="relative aspect-[4/3] overflow-hidden bg-night-100 block"
      >
        <img 
          src={image} 
          alt={product.name} 
          className="h-full w-full object-cover"
          crossOrigin={image.startsWith('http://localhost:5000') ? "anonymous" : undefined}
          onError={(e) => {
            if (e.target.src !== placeholderImage) {
              e.target.src = placeholderImage;
            }
          }}
          loading="lazy"
        />
        {product.is_new && (
          <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-semibold text-night-900">
            Новинка
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <Link to={`/catalog/${product.id}`} className="block">
            <h3 className="text-lg font-semibold text-night-900 hover:text-accent transition">
              {product.name}
            </h3>
          </Link>
          <p className="mt-1 text-sm text-night-500 line-clamp-2">
            {product.short_desc || "Продуманный дизайн и современные материалы."}
          </p>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-night-400">
              Стоимость
            </p>
            <p className="text-2xl font-bold text-accent">
              {formatCurrency(product.final_price || product.price || 0)}
            </p>
            {(product.facade_color || product.corpus_color) && (
              <div className="flex flex-wrap gap-1 text-xs">
                {product.facade_color && (
                  <ColorBadge
                    value={product.facade_color}
                    labelPrefix="Фасад:"
                  />
                )}
                {product.corpus_color && (
                  <ColorBadge
                    value={product.corpus_color}
                    labelPrefix="Корпус:"
                  />
                )}
              </div>
            )}
          </div>
          <SecureButton
            className="px-5 py-2 text-sm"
            onClick={handleAddToCart}
          >
            В корзину
          </SecureButton>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;

