import { memo } from "react";
import { Link } from "react-router-dom";
import SecureButton from "./SecureButton";
import { formatCurrency } from "../../utils/format";
import ColorBadge from "./ColorBadge";
import FavoriteButton from "./FavoriteButton";

const placeholderImage =
  "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80";

const ProductCard = memo(({ product, onAdd }) => {
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

  const href = product?.__type === "kitSolution" ? `/catalog/kit/${product.id}` : `/catalog/${product.id}`;

  return (
    <article className="glass-card flex h-full flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-card">
      <div className="relative">
        <Link
          to={href}
          className="block aspect-[4/3] overflow-hidden bg-night-100"
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
            decoding="async"
          />
          {product.is_new && (
            <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-night-900">
              Новинка
            </span>
          )}
        </Link>
        <FavoriteButton product={product} className="absolute right-3 top-3 z-10" />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        <div className="space-y-2">
          <Link to={href} className="block">
            <h3 className="text-lg font-semibold text-night-900 hover:text-accent transition">
              {product.name}
            </h3>
          </Link>
          <p className="text-sm text-night-500 line-clamp-2">
            {product.short_desc || "Продуманный дизайн и современные материалы."}
          </p>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-night-400">Стоимость</p>
            <p className="text-2xl font-bold text-night-900">
              {formatCurrency(product.final_price || product.price || 0)}
            </p>
            {(product.primary_color || product.secondary_color || product.facade_color || product.corpus_color) && (
              <div className="flex flex-wrap gap-2 text-xs">
                {product.primary_color && (
                  <ColorBadge colorData={product.primary_color} labelPrefix="Основной:" />
                )}
                {product.secondary_color && (
                  <ColorBadge colorData={product.secondary_color} labelPrefix="Доп.:" />
                )}
                {product.facade_color && !product.primary_color && (
                  <ColorBadge value={product.facade_color} labelPrefix="Фасад:" />
                )}
                {product.corpus_color && !product.secondary_color && (
                  <ColorBadge value={product.corpus_color} labelPrefix="Корпус:" />
                )}
              </div>
            )}
          </div>
          <SecureButton className="px-5 py-2 text-sm" onClick={handleAddToCart}>
            В корзину
          </SecureButton>
        </div>
      </div>
    </article>
  );
});

ProductCard.displayName = "ProductCard";

export default ProductCard;

