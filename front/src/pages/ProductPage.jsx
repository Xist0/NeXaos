import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import useApi from "../hooks/useApi";
import useCart from "../hooks/useCart";
import SecureButton from "../components/ui/SecureButton";
import { formatCurrency } from "../utils/format";
import ColorBadge from "../components/ui/ColorBadge";
import useLogger from "../hooks/useLogger";

const placeholderImage =
  "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80";

const ProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { get } = useApi();
  const { addItem } = useCart();
  const logger = useLogger();
  const [product, setProduct] = useState(null);
  const [images, setImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("characteristics");
  const getRef = useRef(get);
  const isFetchingRef = useRef(false);
  const lastIdRef = useRef(null);
  const loadedProductRef = useRef(null);
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    getRef.current = get;
  }, [get]);

  useEffect(() => {
    if (!id || id === "undefined") {
      navigate("/catalog");
      return;
    }

    const currentId = String(id);
    const requestId = ++requestIdRef.current;

    // Проверяем, есть ли уже загруженные данные для этого товара
    if (loadedProductRef.current && String(loadedProductRef.current.id) === currentId) {
      // Данные уже загружены для этого товара, не делаем запрос
      console.log("Данные уже загружены для товара", currentId);
      setProduct(loadedProductRef.current);
      setLoading(false);
      return;
    }

    // Если уже идет запрос для этого же товара, не делаем новый и НЕ отменяем старый
    // Проверяем и isFetchingRef, и lastIdRef, чтобы быть уверенными
    if ((isFetchingRef.current && lastIdRef.current === currentId) || 
        (lastIdRef.current === currentId && abortControllerRef.current)) {
      console.log("Запрос уже выполняется для товара", currentId, "- не создаем новый и не отменяем старый", {
        isFetching: isFetchingRef.current,
        lastId: lastIdRef.current,
        hasAbortController: !!abortControllerRef.current
      });
      // Не делаем новый запрос, но проверяем, может данные уже есть
      if (loadedProductRef.current && String(loadedProductRef.current.id) === currentId) {
        setProduct(loadedProductRef.current);
        setLoading(false);
      }
      return;
    }

    // Отменяем предыдущий запрос только если это другой товар
    if (abortControllerRef.current && lastIdRef.current !== currentId) {
      console.log("Отменяем предыдущий запрос для другого товара", { 
        lastId: lastIdRef.current, 
        currentId 
      });
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Если изменился товар, сбрасываем данные
    if (lastIdRef.current !== currentId) {
      isFetchingRef.current = false;
      setProduct(null);
      setImages([]);
      loadedProductRef.current = null;
    }

    lastIdRef.current = currentId;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let active = true;

    const fetchProduct = async () => {
      // Проверяем, не устарел ли этот запрос
      if (requestId !== requestIdRef.current || abortController.signal.aborted) {
        console.log("Запрос отменен на старте", { requestId, currentRequestId: requestIdRef.current, aborted: abortController.signal.aborted });
        return;
      }
      
      // Если уже идет запрос для этого же товара, не делаем новый
      if (isFetchingRef.current && lastIdRef.current === currentId) {
        console.log("Запрос уже выполняется");
        return;
      }
      
      isFetchingRef.current = true;
      setLoading(true);
      try {
        console.log("Запрос товара начат", { id, currentId, requestId });
        const productResponse = await getRef.current(`/modules/${id}`);
        console.log("Ответ получен", { productResponse, requestId, currentRequestId: requestIdRef.current });
        
        // useApi.get() возвращает response.data, который уже является { data: {...} }
        // Проверяем структуру ответа
        let productData = null;
        
        if (productResponse && typeof productResponse === 'object') {
          // Если ответ имеет структуру { data: { id: ..., ... } }
          if ('data' in productResponse && productResponse.data && typeof productResponse.data === 'object') {
            // Проверяем, есть ли id в data (валидные данные)
            if (productResponse.data.id) {
              productData = productResponse.data;
              console.log("Данные извлечены из data", productData);
            } else {
              // Пустой объект data без id - это ошибка
              console.error("Получен пустой объект data:", productResponse);
              throw new Error("Товар не найден");
            }
          } 
          // Если данные пришли напрямую (без обертки data)
          else if (productResponse.id) {
            productData = productResponse;
            console.log("Данные пришли напрямую", productData);
          }
          // Если данные пришли как массив
          else if (Array.isArray(productResponse)) {
            if (productResponse.length === 0) {
              throw new Error("Товар не найден");
            }
            productData = productResponse[0];
            console.log("Данные из массива", productData);
          }
        }
        
        // Проверяем, что данные валидны
        if (!productData || !productData.id) {
          console.error("Ошибка обработки товара:", { productResponse, productData, id });
          throw new Error("Товар не найден или не содержит ID");
        }
        
        // Проверяем, не был ли запрос отменен перед сохранением данных
        // Важно: если данные валидны и ID совпадает, сохраняем их В ЛЮБОМ СЛУЧАЕ
        // Даже если запрос был отменен (aborted), если данные валидны - сохраняем их
        
        // Проверяем ID перед сохранением - это главная проверка
        if (lastIdRef.current !== currentId) {
          console.log("ID изменился, не сохраняем данные", { 
            lastId: lastIdRef.current, 
            currentId,
            productDataId: productData.id 
          });
          setLoading(false);
          return;
        }
        
        // Проверяем, что productData.id совпадает с currentId
        if (productData.id !== Number(currentId)) {
          console.log("ID товара не совпадает с currentId", { 
            productDataId: productData.id, 
            currentId 
          });
          setLoading(false);
          return;
        }
        
        // Если мы дошли сюда, данные валидны и ID совпадает - СОХРАНЯЕМ ИХ!
        // Не проверяем abortController.signal.aborted или active - если данные получены и валидны, сохраняем
        console.log("✓ Данные валидны и ID совпадает - сохраняем независимо от состояния запроса", {
          productDataId: productData.id,
          currentId,
          aborted: abortController.signal.aborted,
          active
        });
        
        // Если мы дошли сюда, данные валидны и ID совпадает - СОХРАНЯЕМ ИХ СРАЗУ!
        // Сохраняем данные ДО загрузки изображений, чтобы они точно сохранились
        console.log("✓ Сохранение данных товара (до загрузки изображений)", { 
          productId: productData.id, 
          productName: productData.name,
          currentId,
          lastId: lastIdRef.current
        });
        loadedProductRef.current = productData;
        setProduct(productData);
        setLoading(false); // Устанавливаем loading = false сразу после сохранения данных
        console.log("✓ Данные товара установлены в state");
        
        // Теперь загружаем изображения (это не критично, можно пропустить)
        const imagesResponse = await getRef.current(`/images/modules/${id}`).catch((err) => {
          console.warn("Не удалось загрузить изображения:", err);
          return { data: [] };
        });
        
        // Проверяем ID еще раз после загрузки изображений (только ID, не abortController)
        if (lastIdRef.current !== currentId) {
          console.log("ID изменился после загрузки изображений, но данные уже сохранены");
          return;
        }
        
        // Обрабатываем изображения - useApi.get() возвращает response.data
        // API возвращает { data: [...] }, поэтому imagesResponse уже массив или { data: [...] }
        let imageList = [];
        if (imagesResponse) {
          if (Array.isArray(imagesResponse)) {
            imageList = imagesResponse;
          } else if (imagesResponse.data && Array.isArray(imagesResponse.data)) {
            imageList = imagesResponse.data;
          }
        }
        
        setImages(imageList);
        setSelectedImageIndex(0);
        console.log("Загрузка завершена, устанавливаем loading = false");
        setLoading(false);
      } catch (error) {
        console.error("Ошибка в fetchProduct:", error);
        if (!abortController.signal.aborted && active && lastIdRef.current === currentId && requestId === requestIdRef.current) {
          console.error("Ошибка загрузки товара:", error);
          logger.error("Не удалось загрузить товар. Переходим в каталог.");
          setLoading(false);
          navigate("/catalog");
        } else {
          // Если запрос был отменен, все равно сбрасываем loading
          if (active && lastIdRef.current === currentId) {
            setLoading(false);
          }
        }
      } finally {
        if (active && lastIdRef.current === currentId && requestId === requestIdRef.current) {
          isFetchingRef.current = false;
        }
      }
    };

    fetchProduct();

    return () => {
      active = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [id, navigate, logger]);

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

  // Формируем URL изображения
  const getImageUrl = (url) => {
    if (!url) return placeholderImage;
    if (url.startsWith('/uploads/')) {
      if (import.meta.env.DEV) {
        return `http://localhost:5000${url}`;
      }
      return url;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return url;
  };

  const mainImage = images.length > 0 
    ? getImageUrl(images[selectedImageIndex]?.url)
    : getImageUrl(product.image || product.image_url || product.preview_url);

  return (
    <div className="shop-container py-8">
      {/* Breadcrumbs */}
      <nav className="text-sm text-night-500 mb-6">
        <Link to="/" className="hover:text-accent transition">
          Главная
        </Link>
        {" / "}
        <Link to="/catalog" className="hover:text-accent transition">
          Каталог
        </Link>
        {" / "}
        <span className="text-night-900">{product.name}</span>
      </nav>

      {/* Main Product Section */}
      <div className="grid gap-8 lg:grid-cols-2 mb-12">
        {/* Product Image Gallery */}
        <div className="space-y-4">
          <div className="relative aspect-square bg-night-50 rounded-xl overflow-hidden border border-night-200">
            <img 
              src={mainImage} 
              alt={product.name} 
              className="w-full h-full object-contain p-4"
              crossOrigin="anonymous"
              onError={(e) => {
                if (e.target.src !== placeholderImage) {
                  e.target.src = placeholderImage;
                }
              }}
              loading="lazy"
            />
            {product.is_new && (
              <span className="absolute left-4 top-4 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
                Новинка
              </span>
            )}
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {images.map((img, index) => (
                <button
                  key={img.id || index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    selectedImageIndex === index
                      ? "border-accent shadow-md scale-105"
                      : "border-night-200 hover:border-night-300"
                  }`}
                >
                  <img
                    src={getImageUrl(img.url)}
                    alt={`${product.name} - фото ${index + 1}`}
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      if (e.target.src !== placeholderImage) {
                        e.target.src = placeholderImage;
                      }
                    }}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-night-900 mb-3 leading-tight">
              {product.name}
            </h1>
            {product.sku && (
              <p className="text-sm text-night-500">
                Артикул: <span className="font-medium text-night-700">{product.sku}</span>
              </p>
            )}
          </div>

          {product.short_desc && (
            <div className="text-night-700 leading-relaxed text-lg">
              {product.short_desc}
            </div>
          )}

          {/* Price Section */}
          <div className="bg-night-50 rounded-lg p-6 border border-night-200">
            <div className="flex items-baseline gap-4 mb-4">
              <span className="text-5xl font-bold text-accent">
                {formatCurrency(product.final_price || product.price || 0)}
              </span>
            </div>
            <SecureButton
              onClick={handleAddToCart}
              className="w-full justify-center py-4 text-lg font-semibold"
            >
              В корзину
            </SecureButton>
          </div>

          {/* Quick Info */}
          <div className="space-y-4 border-t border-night-200 pt-6">
            {(product.length_mm || product.depth_mm || product.height_mm) && (
              <div>
                <h3 className="text-sm font-semibold text-night-900 mb-3 uppercase tracking-wide">
                  Габариты
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  {product.length_mm && (
                    <div className="bg-night-50 rounded p-3">
                      <span className="text-night-500 block text-xs mb-1">Ширина</span>
                      <span className="font-semibold text-night-900 text-lg">
                        {product.length_mm} мм
                      </span>
                    </div>
                  )}
                  {product.height_mm && (
                    <div className="bg-night-50 rounded p-3">
                      <span className="text-night-500 block text-xs mb-1">Высота</span>
                      <span className="font-semibold text-night-900 text-lg">
                        {product.height_mm} мм
                      </span>
                    </div>
                  )}
                  {product.depth_mm && (
                    <div className="bg-night-50 rounded p-3">
                      <span className="text-night-500 block text-xs mb-1">Глубина</span>
                      <span className="font-semibold text-night-900 text-lg">
                        {product.depth_mm} мм
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(product.facade_color || product.corpus_color) && (
              <div>
                <h3 className="text-sm font-semibold text-night-900 mb-3 uppercase tracking-wide">
                  Цвета
                </h3>
                <div className="flex flex-wrap gap-3">
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
              </div>
            )}

            {/* Additional Info */}
            {(product.shelf_count || product.front_count || product.supports_count) && (
              <div>
                <h3 className="text-sm font-semibold text-night-900 mb-3 uppercase tracking-wide">
                  Комплектация
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  {product.shelf_count && (
                    <div>
                      <span className="text-night-500">Полок:</span>{" "}
                      <span className="font-semibold text-night-900">{product.shelf_count}</span>
                    </div>
                  )}
                  {product.front_count && (
                    <div>
                      <span className="text-night-500">Фасадов:</span>{" "}
                      <span className="font-semibold text-night-900">{product.front_count}</span>
                    </div>
                  )}
                  {product.supports_count && (
                    <div>
                      <span className="text-night-500">Опор:</span>{" "}
                      <span className="font-semibold text-night-900">{product.supports_count}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Delivery Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">Доставка:</span> По всей России. 
              Сроки и стоимость доставки уточняйте при оформлении заказа.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="mb-8">
        <div className="border-b border-night-200">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab("characteristics")}
              className={`pb-4 px-1 font-semibold text-sm uppercase tracking-wide transition ${
                activeTab === "characteristics"
                  ? "text-night-900 border-b-2 border-accent"
                  : "text-night-500 hover:text-night-700"
              }`}
            >
              Характеристики
            </button>
            {product.notes && (
              <button
                onClick={() => setActiveTab("description")}
                className={`pb-4 px-1 font-semibold text-sm uppercase tracking-wide transition ${
                  activeTab === "description"
                    ? "text-night-900 border-b-2 border-accent"
                    : "text-night-500 hover:text-night-700"
                }`}
              >
                Описание
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="glass-card p-8 mb-12">
        {activeTab === "characteristics" && (
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="font-bold text-night-900 mb-4 text-lg">Основные характеристики</h3>
              <div className="space-y-4 text-sm">
                {product.sku && (
                  <div className="flex justify-between py-2 border-b border-night-100">
                    <span className="text-night-500">Артикул</span>
                    <span className="font-semibold text-night-900">{product.sku}</span>
                  </div>
                )}
                {product.facade_color && (
                  <div className="flex justify-between py-2 border-b border-night-100">
                    <span className="text-night-500">Цвет фасада</span>
                    <span className="font-semibold text-night-900">{product.facade_color}</span>
                  </div>
                )}
                {product.corpus_color && (
                  <div className="flex justify-between py-2 border-b border-night-100">
                    <span className="text-night-500">Цвет корпуса</span>
                    <span className="font-semibold text-night-900">{product.corpus_color}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-night-900 mb-4 text-lg">Размеры</h3>
              <div className="space-y-4 text-sm">
                {product.length_mm && (
                  <div className="flex justify-between py-2 border-b border-night-100">
                    <span className="text-night-500">Ширина</span>
                    <span className="font-semibold text-night-900">{product.length_mm} мм</span>
                  </div>
                )}
                {product.height_mm && (
                  <div className="flex justify-between py-2 border-b border-night-100">
                    <span className="text-night-500">Высота</span>
                    <span className="font-semibold text-night-900">{product.height_mm} мм</span>
                  </div>
                )}
                {product.depth_mm && (
                  <div className="flex justify-between py-2 border-b border-night-100">
                    <span className="text-night-500">Глубина</span>
                    <span className="font-semibold text-night-900">{product.depth_mm} мм</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-night-900 mb-4 text-lg">Дополнительно</h3>
              <div className="space-y-4 text-sm">
                {product.shelf_count && (
                  <div className="flex justify-between py-2 border-b border-night-100">
                    <span className="text-night-500">Полок</span>
                    <span className="font-semibold text-night-900">{product.shelf_count}</span>
                  </div>
                )}
                {product.front_count && (
                  <div className="flex justify-between py-2 border-b border-night-100">
                    <span className="text-night-500">Фасадов</span>
                    <span className="font-semibold text-night-900">{product.front_count}</span>
                  </div>
                )}
                {product.supports_count && (
                  <div className="flex justify-between py-2 border-b border-night-100">
                    <span className="text-night-500">Опор</span>
                    <span className="font-semibold text-night-900">{product.supports_count}</span>
                  </div>
                )}
                {product.hinges_count && (
                  <div className="flex justify-between py-2 border-b border-night-100">
                    <span className="text-night-500">Петель</span>
                    <span className="font-semibold text-night-900">{product.hinges_count}</span>
                  </div>
                )}
                {product.clips_count && (
                  <div className="flex justify-between py-2 border-b border-night-100">
                    <span className="text-night-500">Клипс</span>
                    <span className="font-semibold text-night-900">{product.clips_count}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "description" && product.notes && (
          <div className="prose max-w-none">
            <div className="text-night-700 leading-relaxed whitespace-pre-line text-base">
              {product.notes}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductPage;
