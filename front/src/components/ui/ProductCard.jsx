import { memo } from "react";
import { Link } from "react-router-dom";
import SecureButton from "./SecureButton";
import { formatCurrency } from "../../utils/format";
import ColorBadge from "./ColorBadge";
import FavoriteButton from "./FavoriteButton";

const placeholderImage =
  "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80";

const ProductCard = memo(({ product, onAdd, className = "" }) => {
  const getImageUrl = (url) => {
    if (!url) return placeholderImage;
    if (url.startsWith("/uploads/")) {
      return import.meta.env.DEV ? `http://localhost:5000${url}` : url;
    }
    return url;
  };

  const image = getImageUrl(
    product.image || product.images?.[0] || product.image_url || product.preview_url
  );

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onAdd?.(product);
  };

  const href =
    product?.__type === "kitSolution"
      ? `/catalog/kit/${product.id}`
      : `/catalog/${product.id}`;

  return (
    <article
      className={`glass-card p-4 h-full flex flex-col border border-night-100 hover:border-accent/50 hover:shadow-xl transition-all duration-300 ${className}`}
    >
      <Link
        to={href}
        className="block h-full flex flex-col group-hover:no-underline focus:outline-none"
        state={{ fromCatalog: true }}
      >
        {/* ✅ ИЗОБРАЖЕНИЕ */}
        <div className="relative w-full h-40 sm:h-44 md:h-48 flex-shrink-0 bg-gradient-to-br from-night-50 to-night-100 rounded-lg overflow-hidden mb-3 group-hover:scale-[1.02] transition-transform duration-300">
          <img
            src={image}
            alt={product.name}
            className="w-full h-full object-cover object-center"
            loading="lazy"
          />

          {product.is_new && (
            <span className="absolute left-2 top-2 z-20 bg-gradient-to-r from-accent to-accent-dark/90 text-white px-2 py-1 text-xs font-bold rounded-full shadow-lg">
              Новинка
            </span>
          )}

          {/* ✅ КНОПКА ИЗБРАННОГО — ВСЕГДА ВИДИМА */}
          <FavoriteButton
            product={product}
            className="absolute right-2 top-2 z-20 opacity-80 hover:opacity-100 transition-all duration-200 hover:scale-110"
          />
        </div>

        {/* ✅ ФИКСИРОВАННЫЙ КОНТЕНТ С ТОЧНЫМИ ВЫСОТАМИ */}
        <div className="flex flex-1 flex-col justify-between gap-2 px-1 pb-2">
          {/* ✅ НАЗВАНИЕ — ФИКС 50px */}
          <h3 
            className="font-semibold text-night-900 text-sm sm:text-base leading-tight 
                       h-[50px] overflow-hidden"
          >
            {product.name}
          </h3>

          {/* ✅ ОПИСАНИЕ — ФИКС 36px */}
          {(product.description || product.short_desc) && (
            <p className="text-xs text-night-500 leading-snug h-[36px] overflow-hidden">
              {product.description || product.short_desc}
            </p>
          )}

          {/* ✅ ЦВЕТА — ФИКС 70px (как было) */}
          <div className="flex flex-col gap-1.5 h-[70px]">
            {product.primary_color && (
              <ColorBadge colorData={product.primary_color} labelPrefix="Осн:" />
            )}
            {product.secondary_color && (
              <ColorBadge colorData={product.secondary_color} labelPrefix="Доп:" />
            )}
            {product.facade_color && !product.primary_color && (
              <ColorBadge value={product.facade_color} labelPrefix="Фасад:" />
            )}
            {product.corpus_color && !product.secondary_color && (
              <ColorBadge value={product.corpus_color} labelPrefix="Корпус:" />
            )}
          </div>

          {/* ✅ ЦЕНА — mt-auto */}
          <div className="pt-1 mt-auto">
            <p className="text-xl sm:text-2xl font-bold text-night-900 group-hover:text-accent-dark transition-colors">
              {formatCurrency(product.final_price || product.price || 0)}
            </p>
          </div>
        </div>
      </Link>

      {/* ✅ КНОПКА КОРЗИНЫ */}
      <div className="mt-2 pt-2 border-t border-night-100">
        <SecureButton
          onClick={handleAddToCart}
          className="w-full text-xs h-10 bg-gradient-to-r from-accent to-accent-dark hover:from-accent-dark hover:to-accent text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          size="sm"
        >
          В корзину
        </SecureButton>
      </div>
    </article>
  );
});

ProductCard.displayName = "ProductCard";
export default ProductCard;
