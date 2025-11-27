import SecureButton from "./SecureButton";
import { formatCurrency } from "../../utils/format";

const placeholderImage =
  "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80";

const ProductCard = ({ product, onAdd }) => {
  const image =
    product.image ||
    product.image_url ||
    product.preview_url ||
    placeholderImage;

  return (
    <article className="glass-card flex flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-2xl">
      <div className="relative aspect-[4/3] overflow-hidden bg-night-100">
        <img src={image} alt={product.name} className="h-full w-full object-cover" />
        {product.is_new && (
          <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-semibold text-night-900">
            Новинка
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h3 className="text-lg font-semibold text-night-900">{product.name}</h3>
          <p className="mt-1 text-sm text-night-500 line-clamp-2">
            {product.short_desc || "Продуманный дизайн и современные материалы."}
          </p>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-night-400">Стоимость</p>
            <p className="text-2xl font-bold text-accent">
              {formatCurrency(product.final_price || product.price || 0)}
            </p>
          </div>
          <SecureButton
            className="px-5 py-2 text-sm"
            onClick={() => onAdd?.(product)}
          >
            В корзину
          </SecureButton>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;

