import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import useApi from "../hooks/useApi";
import useCart from "../hooks/useCart";
import SecureButton from "../components/ui/SecureButton";
import ProductCard from "../components/ui/ProductCard";
import { formatCurrency } from "../utils/format";
import ColorBadge from "../components/ui/ColorBadge";
import FavoriteButton from "../components/ui/FavoriteButton";
import useLogger from "../hooks/useLogger";

const placeholderImage = "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80";

const getImageUrl = (url) => {
  if (!url) return placeholderImage;
  if (url.startsWith('/uploads/')) {
    return import.meta.env.DEV ? `http://localhost:5000${url}` : url;
  }
  return url;
};

const ProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { get } = useApi();
  const { addItem } = useCart();
  const logger = useLogger();

  const [item, setItem] = useState(null); // module ИЛИ kitSolution
  const [images, setImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [similarItems, setSimilarItems] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  const getRef = useRef(get);
  const loggerRef = useRef(logger);
  const isFetchingRef = useRef(false);
  const lastIdRef = useRef(null);

  useEffect(() => {
    getRef.current = get;
  }, [get]);

  loggerRef.current = logger;

  // Загрузка товара/комплекта
  useEffect(() => {
    if (!id || id === "undefined") {
      navigate("/catalog");
      return;
    }

    const currentId = String(id);
    if (isFetchingRef.current && lastIdRef.current === currentId) return;

    isFetchingRef.current = true;
    lastIdRef.current = currentId;
    setLoading(true);

    let active = true;
    const abortController = new AbortController();

    const fetchItem = async () => {
      try {
        const moduleRes = await getRef.current(`/modules/${id}`, undefined, {
          signal: abortController.signal,
        });

        if (active && moduleRes?.data) {
          const itemData = moduleRes.data;
          setItem(itemData);
          setImages(Array.isArray(itemData?.images) ? itemData.images : []);
          setSelectedImageIndex(0);
        }
      } catch (error) {
        if (active) {
          loggerRef.current?.error("Не удалось загрузить товар");
          navigate("/catalog");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
        isFetchingRef.current = false;
      }
    };

    fetchItem();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [id, navigate]);

  // Похожие товары
  const loadSimilar = useCallback(async () => {
    if (!item || similarLoading) return;
    
    setSimilarLoading(true);
    try {
      const queryParams = {};
      
      // Приоритетные фильтры
      if (item.facade_color) queryParams.facadeColor = item.facade_color; // 1
      if (item.corpus_color) queryParams.corpusColor = item.corpus_color; // 2
      if (item.length_mm) {
        queryParams.lengthFrom = String(item.length_mm - 50);
        queryParams.lengthTo = String(item.length_mm + 50);
      }
      
      // Категория
      let category = item.category_code || item.module_category_id;
      if (item.module_category_id) {
        category = item.module_category_id === 1 ? "bottom" : 
                  item.module_category_id === 2 ? "top" :
                  item.module_category_id === 3 ? "tall" :
                  item.module_category_id === 4 ? "filler" :
                  item.module_category_id === 5 ? "accessory" : category;
      }
      if (category) queryParams.category = category;
      
      if (item.base_sku) queryParams.baseSku = item.base_sku;
      if (item.name) queryParams.search = item.name;

      const res = await getRef.current("/modules", queryParams);
      const list = Array.isArray(res?.data) ? res.data : [];
      const filtered = list.filter(x => x.id !== Number(id) && x.is_active).slice(0, 12);
      setSimilarItems(filtered);
    } catch (error) {
      console.error("Ошибка похожих:", error);
    } finally {
      setSimilarLoading(false);
    }
  }, [item, id, similarLoading]);

  const handleAddToCart = () => {
    if (!item) return;
    addItem(item.__type === "kitSolution" ? { ...item, __type: "kitSolution" } : item, 1);
  };

  const handleFindSimilar = () => {
    const params = new URLSearchParams({ fromProduct: "1" });
    if (item.facade_color) params.set("facadeColor", item.facade_color);
    if (item.corpus_color) params.set("corpusColor", item.corpus_color);
    if (item.category_code) params.set("category", item.category_code);
    navigate(`/catalog?${params.toString()}`);
  };

  const mainImage = images.length > 0 
    ? getImageUrl(images[selectedImageIndex]?.url) 
    : getImageUrl(item?.image || item?.preview_url);

  const isKit = item?.__type === "kitSolution";
  const modulesByType = isKit ? item.modules || {} : null;
  const compositionSections = useMemo(() => {
    if (!isKit) return [];
    const sections = [
      { key: "bottom", title: "Нижние модули" },
      { key: "top", title: "Верхние модули" },
      { key: "tall", title: "Пеналы" },
      { key: "filler", title: "Доборные элементы" },
      { key: "accessory", title: "Аксессуары" }
    ];
    return sections
      .map(({ key, title }) => ({
        title,
        items: Array.isArray(modulesByType[key]) ? modulesByType[key] : []
      }))
      .filter(section => section.items.length > 0);
  }, [isKit, modulesByType]);

  if (loading) {
    return (
      <div className="shop-container py-12">
        <div className="glass-card p-8 text-center">
          <div className="text-night-500">Загружаем товар...</div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="shop-container py-12">
        <div className="glass-card p-8 text-center">
          <div className="text-night-500">Товар не найден</div>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-container py-8">
      {/* Breadcrumbs */}
      <nav className="text-sm text-night-500 mb-6">
        <Link to="/catalog" className="hover:text-accent transition">Каталог</Link>
        <span className="text-night-900 mx-2">/</span>
        <span className="font-medium">{item.name}</span>
      </nav>

      {/* Главный блок */}
      <div className="grid gap-8 lg:gap-12 lg:grid-cols-2 mb-12">
        {/* ✅ ГАЛЕРЕЯ ИЗ ОЗОНА */}
        <div className="space-y-4">
          {/* Большое изображение */}
          <div className="relative aspect-[4/3] bg-night-50 rounded-2xl overflow-hidden border border-night-200 group shadow-lg">
            <img
              src={mainImage}
              alt={item.name}
              className="w-full h-full object-contain p-6 transition-all group-hover:p-4 lg:p-8"
              loading="eager"
            />
            {item.is_new && (
              <span className="absolute left-4 top-4 z-20 bg-gradient-to-r from-accent to-accent-dark/90 text-white px-3 py-1.5 text-xs font-bold rounded-full shadow-lg">
                Новинка
              </span>
            )}
            {/* Навигация */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setSelectedImageIndex(prev => prev > 0 ? prev - 1 : images.length - 1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all z-20"
                  aria-label="Предыдущее"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setSelectedImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all z-20"
                  aria-label="Следующее"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Миниатюры */}
          {images.length > 1 && (
            <div className="grid grid-cols-5 gap-2 px-1">
              {images.map((img, index) => (
                <button
                  key={img.id || index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                    selectedImageIndex === index
                      ? 'border-accent shadow-md ring-2 ring-accent/50 scale-105'
                      : 'border-night-200 hover:border-night-300 hover:scale-105'
                  }`}
                >
                  <img
                    src={getImageUrl(img.url)}
                    alt={`${item.name} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Информация */}
        <div className="space-y-6 lg:pt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-night-900 leading-tight mb-2">
                {item.name}
              </h1>
              {item.sku && (
                <p className="text-sm text-night-500">
                  Артикул: <span className="font-medium text-night-700">{item.sku}</span>
                </p>
              )}
            </div>
            <FavoriteButton product={item} className="flex-shrink-0 mt-2" />
          </div>

          {item.short_desc && (
            <p className="text-night-700 leading-relaxed text-lg">{item.short_desc}</p>
          )}

          {/* Компактная цена + кнопки */}
          <div className="space-y-3">
            <div className="flex items-baseline gap-2 bg-night-50 rounded-xl p-4 border border-night-200">
              <span className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-accent to-accent-dark bg-clip-text text-transparent">
                {formatCurrency(item.final_price || item.price || 0)}
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <SecureButton
                onClick={handleAddToCart}
                className="flex-1 h-12 text-base bg-gradient-to-r from-accent to-accent-dark hover:from-accent-dark hover:to-accent text-white font-semibold shadow-lg hover:shadow-xl rounded-xl"
              >
                В корзину
              </SecureButton>
              <SecureButton
                onClick={handleFindSimilar}
                variant="outline"
                className="flex-1 h-12 text-sm border-night-200 hover:border-accent text-night-700 hover:text-accent rounded-xl"
              >
                Похожие товары
              </SecureButton>
            </div>
          </div>
        </div>
      </div>

      {/* Характеристики (компактно) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {(item.length_mm || item.total_length_mm) && (
          <div className="glass-card p-4">
            <span className="text-night-500 text-xs block mb-1">Длина</span>
            <span className="font-semibold text-night-900 text-lg">
              {item.length_mm || item.total_length_mm} мм
            </span>
          </div>
        )}
        {(item.depth_mm || item.total_depth_mm) && (
          <div className="glass-card p-4">
            <span className="text-night-500 text-xs block mb-1">Глубина</span>
            <span className="font-semibold text-night-900 text-lg">
              {item.depth_mm || item.total_depth_mm} мм
            </span>
          </div>
        )}
        {(item.height_mm || item.total_height_mm) && (
          <div className="glass-card p-4">
            <span className="text-night-500 text-xs block mb-1">Высота</span>
            <span className="font-semibold text-night-900 text-lg">
              {item.height_mm || item.total_height_mm} мм
            </span>
          </div>
        )}
        {item.facade_color && (
          <div className="glass-card p-4">
            <span className="text-night-500 text-xs block mb-1">Фасад</span>
            <ColorBadge value={item.facade_color} />
          </div>
        )}
        {item.corpus_color && (
          <div className="glass-card p-4">
            <span className="text-night-500 text-xs block mb-1">Корпус</span>
            <ColorBadge value={item.corpus_color} />
          </div>
        )}
      </div>

      {/* ✅ СОСТАВ ГОТОВОГО РЕШЕНИЯ (только для kit) */}
      {isKit && compositionSections.length > 0 && (
        <div className="glass-card p-8 mb-12">
          <h3 className="font-bold text-night-900 mb-6 text-2xl">Состав готового решения</h3>
          <div className="space-y-6">
            {compositionSections.map(({ title, items }) => (
              <div key={title} className="space-y-3">
                <h4 className="text-lg font-semibold text-night-900 uppercase tracking-wide border-b border-night-200 pb-2">
                  {title} ({items.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map(module => (
                    <Link
                      key={module.id}
                      to={`/catalog/${module.id}`}
                      className="glass-card p-4 hover:border-accent transition-all group"
                    >
                      <div className="space-y-2">
                        <div className="aspect-[4/3] bg-night-50 rounded-xl overflow-hidden">
                          <img
                            src={getImageUrl(module.preview_url)}
                            alt={module.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <h5 className="font-semibold text-night-900 text-sm leading-tight line-clamp-2">
                          {module.name}
                        </h5>
                        {module.sku && (
                          <p className="text-xs text-night-500">{module.sku}</p>
                        )}
                        <div className="text-xs text-night-500">
                          {module.lengthMm || '—'}×{module.depthMm || '—'}×{module.heightMm || '—'} мм
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Похожие товары */}
      <div className="glass-card p-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h3 className="font-bold text-night-900 text-2xl">Похожие товары</h3>
          <SecureButton
            variant="outline"
            onClick={loadSimilar}
            disabled={similarLoading}
            className="text-sm px-4 py-2"
          >
            {similarLoading ? "Загрузка..." : "Показать больше"}
          </SecureButton>
        </div>
        {similarLoading ? (
          <div className="text-night-500 text-center py-12">Загружаем похожие товары...</div>
        ) : similarItems.length === 0 ? (
          <div className="text-night-500 text-center py-12">Похожие товары не найдены</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {similarItems.map(product => (
              <ProductCard key={product.id} product={product} onAdd={addItem} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductPage;
