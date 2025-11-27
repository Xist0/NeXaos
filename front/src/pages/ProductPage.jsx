import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import useApi from "../hooks/useApi";
import useCart from "../hooks/useCart";
import SecureButton from "../components/ui/SecureButton";
import { formatCurrency } from "../utils/format";

const placeholderImage =
  "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80";

const ProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { get } = useApi();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("characteristics");

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const response = await get(`/modules/${id}`);
        setProduct(response?.data || response);
      } catch (error) {
        console.error("Ошибка при загрузке товара:", error);
        navigate("/catalog");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProduct();
    }
  }, [id, get, navigate]);

  const handleAddToCart = () => {
    if (product) {
      addItem(product, 1);
    }
  };

  if (loading) {
    return (
      <div className="shop-container py-12">
        <div className="glass-card p-8 text-center text-night-500">Загрузка...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="shop-container py-12">
        <div className="glass-card p-8 text-center text-night-500">Товар не найден</div>
      </div>
    );
  }

  const image = product.image || product.image_url || product.preview_url || placeholderImage;

  return (
    <div className="shop-container py-8">
      {/* Breadcrumbs */}
      <nav className="text-sm text-night-500 mb-6">
        <Link to="/" className="hover:text-accent">
          Главная
        </Link>
        {" / "}
        <Link to="/catalog" className="hover:text-accent">
          Каталог
        </Link>
        {" / "}
        <span className="text-night-900">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 mb-12">
        {/* Product Image */}
        <div className="space-y-4">
          <div className="relative aspect-square bg-night-100 rounded-xl overflow-hidden">
            <img src={image} alt={product.name} className="w-full h-full object-cover" />
            {product.is_new && (
              <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-semibold text-night-900">
                Новинка
              </span>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold text-night-900 mb-2">{product.name}</h1>
            {product.sku && (
              <p className="text-sm text-night-500">Код: {product.sku}</p>
            )}
          </div>

          {product.short_desc && (
            <p className="text-night-700 leading-relaxed">{product.short_desc}</p>
          )}

          <div className="flex items-baseline gap-4">
            <span className="text-4xl font-bold text-accent">
              {formatCurrency(product.final_price || product.price || 0)}
            </span>
          </div>

          {/* Dimensions */}
          {(product.length_mm || product.depth_mm || product.height_mm) && (
            <div className="border-t border-night-200 pt-4">
              <h3 className="text-sm font-semibold text-night-900 mb-2">Размеры</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                {product.length_mm && (
                  <div>
                    <span className="text-night-500">Ширина:</span>
                    <p className="font-medium text-night-900">
                      {product.length_mm} мм
                    </p>
                  </div>
                )}
                {product.height_mm && (
                  <div>
                    <span className="text-night-500">Высота:</span>
                    <p className="font-medium text-night-900">
                      {product.height_mm} мм
                    </p>
                  </div>
                )}
                {product.depth_mm && (
                  <div>
                    <span className="text-night-500">Глубина:</span>
                    <p className="font-medium text-night-900">
                      {product.depth_mm} мм
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Colors */}
          {(product.facade_color || product.corpus_color) && (
            <div className="border-t border-night-200 pt-4">
              <h3 className="text-sm font-semibold text-night-900 mb-2">Цвета</h3>
              <div className="flex gap-2">
                {product.facade_color && (
                  <div className="text-sm">
                    <span className="text-night-500">Фасад: </span>
                    <span className="font-medium text-night-900">{product.facade_color}</span>
                  </div>
                )}
                {product.corpus_color && (
                  <div className="text-sm">
                    <span className="text-night-500">Корпус: </span>
                    <span className="font-medium text-night-900">{product.corpus_color}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <SecureButton
              onClick={handleAddToCart}
              className="flex-1 justify-center py-4 text-lg"
            >
              В корзину
            </SecureButton>
          </div>

          {/* Delivery Info */}
          <div className="border-t border-night-200 pt-4">
            <p className="text-sm text-night-500">
              Доставка по всей России. Сроки уточняйте при оформлении заказа.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-night-200 mb-6">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("characteristics")}
            className={`pb-3 px-1 font-medium transition ${
              activeTab === "characteristics"
                ? "text-night-900 border-b-2 border-accent"
                : "text-night-500 hover:text-night-700"
            }`}
          >
            ХАРАКТЕРИСТИКИ
          </button>
          {product.notes && (
            <button
              onClick={() => setActiveTab("description")}
              className={`pb-3 px-1 font-medium transition ${
                activeTab === "description"
                  ? "text-night-900 border-b-2 border-accent"
                  : "text-night-500 hover:text-night-700"
              }`}
            >
              ОПИСАНИЕ
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="glass-card p-6">
        {activeTab === "characteristics" && (
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="font-semibold text-night-900 mb-4">ОСНОВНЫЕ ХАРАКТЕРИСТИКИ</h3>
              <div className="space-y-3 text-sm">
                {product.sku && (
                  <div>
                    <span className="text-night-500">Артикул:</span>{" "}
                    <span className="font-medium text-night-900">{product.sku}</span>
                  </div>
                )}
                {product.facade_color && (
                  <div>
                    <span className="text-night-500">Цвет фасада:</span>{" "}
                    <span className="font-medium text-night-900">{product.facade_color}</span>
                  </div>
                )}
                {product.corpus_color && (
                  <div>
                    <span className="text-night-500">Цвет корпуса:</span>{" "}
                    <span className="font-medium text-night-900">{product.corpus_color}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-night-900 mb-4">РАЗМЕРЫ</h3>
              <div className="space-y-3 text-sm">
                {product.length_mm && (
                  <div>
                    <span className="text-night-500">Ширина:</span>{" "}
                    <span className="font-medium text-night-900">
                      {product.length_mm} мм
                    </span>
                  </div>
                )}
                {product.height_mm && (
                  <div>
                    <span className="text-night-500">Высота:</span>{" "}
                    <span className="font-medium text-night-900">
                      {product.height_mm} мм
                    </span>
                  </div>
                )}
                {product.depth_mm && (
                  <div>
                    <span className="text-night-500">Глубина:</span>{" "}
                    <span className="font-medium text-night-900">
                      {product.depth_mm} мм
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-night-900 mb-4">ДОПОЛНИТЕЛЬНО</h3>
              <div className="space-y-3 text-sm">
                {product.shelf_count && (
                  <div>
                    <span className="text-night-500">Полок:</span>{" "}
                    <span className="font-medium text-night-900">{product.shelf_count}</span>
                  </div>
                )}
                {product.front_count && (
                  <div>
                    <span className="text-night-500">Фасадов:</span>{" "}
                    <span className="font-medium text-night-900">{product.front_count}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "description" && product.notes && (
          <div className="prose max-w-none">
            <p className="text-night-700 leading-relaxed whitespace-pre-line">
              {product.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductPage;

