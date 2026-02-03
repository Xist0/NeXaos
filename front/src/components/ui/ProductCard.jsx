import { memo, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SecureButton from "./SecureButton";
import { formatCurrency } from "../../utils/format";
import ColorBadge from "./ColorBadge";
import FavoriteButton from "./FavoriteButton";
import { getImageUrl, placeholderImage } from "../../utils/image";

const ProductCard = memo(({ product, onAdd, className = "", compact = false }) => {
  const [isHover, setIsHover] = useState(false);

  const imageUrls = useMemo(() => {
    const raw = Array.isArray(product.images) ? product.images : [];
    const normalized = raw
      .map((img) => (typeof img === "string" ? img : img?.url))
      .filter(Boolean);

    const primary = product.image || product.image_url || product.preview_url || normalized[0];
    const secondary = normalized.length > 1 ? normalized[1] : null;
    return {
      primary: getImageUrl(primary),
      secondary: secondary ? getImageUrl(secondary) : null,
    };
  }, [product.image, product.image_url, product.images, product.preview_url]);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onAdd?.(product);
  };

  const href =
    product?.__type === "kitSolution"
      ? `/catalog/kit/${product.id}`
      : product?.__type === "catalogItem"
      ? `/catalog/catalog-item/${product.id}`
      : `/catalog/${product.id}`;

  return (
    <article className={`glass-card p-0 h-full flex flex-col group transition-all overflow-hidden duration-300 ${className}`}>
      <Link to={href} className="block h-full flex flex-col focus:outline-none focus:ring-2 focus:ring-accent/50 rounded-xl" state={{ fromCatalog: true }}>
        <div
          className={`relative w-full ${compact ? "aspect-[4/5]" : "aspect-[3/4]"} flex-shrink-0 bg-night-50 rounded-t-xl overflow-hidden`}
          onMouseEnter={() => setIsHover(true)}
          onMouseLeave={() => setIsHover(false)}
        >
          <img
            src={imageUrls.primary}
            alt={product.name}
            className={`absolute inset-0 w-full h-full object-contain object-center transition-opacity duration-300 ${
              imageUrls.secondary && isHover ? "opacity-0" : "opacity-100"
            }`}
            loading="lazy"
            onError={(e) => {
              if (e.currentTarget.src !== placeholderImage) {
                e.currentTarget.src = placeholderImage;
              }
            }}
          />
          {imageUrls.secondary && (
            <img
              src={imageUrls.secondary}
              alt={product.name}
              className={`absolute inset-0 w-full h-full object-contain object-center transition-opacity duration-300 ${
                isHover ? "opacity-100" : "opacity-0"
              }`}
              loading="lazy"
              onError={(e) => {
                if (e.currentTarget.src !== placeholderImage) {
                  e.currentTarget.src = placeholderImage;
                }
              }}
            />
          )}
          {product.is_new && (
            <span className="absolute left-2 top-2 z-10 bg-gradient-to-r from-accent to-accent-dark text-white px-2 py-0.5 text-[10px] font-bold rounded-full shadow-lg">
              Новинка
            </span>
          )}
          <FavoriteButton product={product} className="absolute right-2 top-2 z-10" />
        </div>

        <div className={`flex flex-1 flex-col justify-between ${compact ? "gap-1 p-2" : "gap-1 sm:gap-2 p-2 sm:p-3"}`}>
          <h3 className="font-semibold text-night-900 text-sm sm:text-base leading-tight clamp-2 h-[2.5em] sm:h-[3em] truncate ">
            {product.name}
          </h3>

          <div className="hidden sm:flex flex-col gap-1.5 mt-1 truncate ">
            {product.primary_color && <ColorBadge colorData={product.primary_color} labelPrefix="Осн:" />}
            {product.secondary_color && <ColorBadge colorData={product.secondary_color} labelPrefix="Доп:" />}
            {product.facade_color && !product.primary_color && <ColorBadge value={product.facade_color} labelPrefix="Фасад:" />}
            {product.corpus_color && !product.secondary_color && <ColorBadge value={product.corpus_color} labelPrefix="Корпус:" />}
          </div>

          <div className={compact ? "mt-auto pt-1" : "mt-auto pt-2"}>
            <p className="text-base sm:text-lg md:text-xl font-bold text-night-900 transition-colors duration-200 group-hover:text-accent-dark">
              {formatCurrency(product.final_price || product.price || 0)}
            </p>
          </div>
        </div>
      </Link>

      <div className={compact ? "px-2 pb-2" : "px-2 sm:px-3 pb-2 sm:pb-3"}>
        <SecureButton onClick={handleAddToCart} className="w-full h-9 sm:h-10 text-xs sm:text-sm bg-accent hover:bg-accent-dark text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap" size="sm">
          В корзину
        </SecureButton>
      </div>
    </article>
  );
});

ProductCard.displayName = "ProductCard";
export default ProductCard;
