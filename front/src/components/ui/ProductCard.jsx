import { memo } from "react";
import { Link } from "react-router-dom";
import SecureButton from "./SecureButton";
import { formatCurrency } from "../../utils/format";
import ColorBadge from "./ColorBadge";
import FavoriteButton from "./FavoriteButton";

const placeholderImage = "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80";

const ProductCard = memo(({ product, onAdd, className = "" }) => {
  const getImageUrl = (url) => {
    if (!url) return placeholderImage;
    if (url.startsWith("/uploads/")) {
      return import.meta.env.DEV ? `http://localhost:5000${url}` : url;
    }
    return url;
  };

  const image = getImageUrl(product.image || product.images?.[0] || product.image_url || product.preview_url);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onAdd?.(product);
  };

  const href = product?.__type === "kitSolution" ? `/catalog/kit/${product.id}` : `/catalog/${product.id}`;

  return (
    <article className={`glass-card p-2 sm:p-3 h-full flex flex-col group transition-all overflow-hidden duration-300 ${className}`}>
      <Link to={href} className="block h-full flex flex-col focus:outline-none focus:ring-2 focus:ring-accent/50 rounded-lg" state={{ fromCatalog: true }}>
        <div className="relative w-full h-32 sm:h-40 md:h-48 flex-shrink-0 bg-gradient-to-br from-night-50 to-night-100 rounded-lg overflow-hidden mb-2 sm:mb-3 transition-transform duration-300 transform group-hover:scale-105">
          <img src={image} alt={product.name} className="w-full h-full object-cover object-center" loading="lazy" />
          {product.is_new && (
            <span className="absolute left-2 top-2 z-10 bg-gradient-to-r from-accent to-accent-dark text-white px-2 py-0.5 text-[10px] font-bold rounded-full shadow-lg">
              Новинка
            </span>
          )}
          <FavoriteButton product={product} className="absolute right-2 top-2 z-10" />
        </div>

        <div className="flex flex-1 flex-col justify-between gap-1 sm:gap-2 px-1 sm:px-0 pb-1">
          <h3 className="font-semibold text-night-900 text-sm sm:text-base leading-tight clamp-2 h-[2.5em] sm:h-[3em] truncate ">
            {product.name}
          </h3>

          <div className="hidden sm:flex flex-col gap-1.5 mt-1 truncate ">
            {product.primary_color && <ColorBadge colorData={product.primary_color} labelPrefix="Осн:" />}
            {product.secondary_color && <ColorBadge colorData={product.secondary_color} labelPrefix="Доп:" />}
            {product.facade_color && !product.primary_color && <ColorBadge value={product.facade_color} labelPrefix="Фасад:" />}
            {product.corpus_color && !product.secondary_color && <ColorBadge value={product.corpus_color} labelPrefix="Корпус:" />}
          </div>

          <div className="mt-auto pt-2">
            <p className="text-base sm:text-lg md:text-xl font-bold text-night-900 transition-colors duration-200 group-hover:text-accent-dark">
              {formatCurrency(product.final_price || product.price || 0)}
            </p>
          </div>
        </div>
      </Link>

      <div className="mt-2 pt-2 border-t border-night-100/80">
        <SecureButton onClick={handleAddToCart} className="w-full h-9 sm:h-10 text-xs sm:text-sm bg-accent hover:bg-accent-dark text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200" size="sm">
          В корзину
        </SecureButton>
      </div>
    </article>
  );
});

ProductCard.displayName = "ProductCard";
export default ProductCard;
