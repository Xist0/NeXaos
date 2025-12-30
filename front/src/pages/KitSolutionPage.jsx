import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import useApi from "../hooks/useApi";
import useCart from "../hooks/useCart";
import SecureButton from "../components/ui/SecureButton";
import ProductCard from "../components/ui/ProductCard";
import { formatCurrency } from "../utils/format";
import ColorBadge from "../components/ui/ColorBadge";
import FavoriteButton from "../components/ui/FavoriteButton";
import useLogger from "../hooks/useLogger";

const placeholderImage =
  "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80";

const getImageUrl = (url) => {
  if (!url) return placeholderImage;
  if (url.startsWith("/uploads/")) {
    if (import.meta.env.DEV) return `http://localhost:5000${url}`;
    return url;
  }
  return url;
};

const KitSolutionPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { get, post } = useApi();
  const { addItem } = useCart();
  const logger = useLogger();

  const [kit, setKit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [similarItems, setSimilarItems] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  const getRef = useRef(get);
  const postRef = useRef(post);
  const loggerRef = useRef(logger);

  useEffect(() => {
    getRef.current = get;
    postRef.current = post;
    loggerRef.current = logger;
  }, [get, post, logger]);

  useEffect(() => {
    if (!id || id === "undefined") {
      navigate("/catalog");
      return;
    }

    let active = true;
    const abortController = new AbortController();

    const fetchKit = async () => {
      setLoading(true);
      try {
        const res = await getRef.current(`/kit-solutions/${id}`, undefined, { signal: abortController.signal });
        if (active) {
          const data = res?.data || null;
          setKit(data);
          setImages(Array.isArray(data?.images) ? data.images : []);
          setSelectedImageIndex(0);
        }
      } catch (e) {
        if (active && !abortController.signal.aborted) {
          loggerRef.current?.error("Не удалось загрузить готовое решение");
          navigate("/catalog");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchKit();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [id, navigate]);

  const mainImage = useMemo(() => {
    if (Array.isArray(images) && images.length > 0) {
      return getImageUrl(images[selectedImageIndex]?.url);
    }
    return getImageUrl(kit?.preview_url);
  }, [images, selectedImageIndex, kit?.preview_url]);

  const handleAddToCart = () => {
    if (!kit) return;
    addItem({ ...kit, __type: "kitSolution" }, 1);
  };

  const modulesByType = kit?.modules || {};

  const compositionSections = useMemo(() => (
    [
      { key: "bottom", title: "Нижние модули" },
      { key: "top", title: "Верхние модули" },
      { key: "tall", title: "Пеналы" },
      { key: "filler", title: "Доборные элементы" },
      { key: "accessory", title: "Аксессуары" },
    ]
      .map(({ key, title }) => ({ title, items: Array.isArray(modulesByType[key]) ? modulesByType[key] : [] }))
      .filter((section) => section.items.length > 0)
  ), [modulesByType]);

  const loadSimilar = async () => {
    if (!id || similarLoading) return;
    setSimilarLoading(true);
    try {
      const res = await postRef.current(`/kit-solutions/${id}/similar`, { limit: 12 });
      const list = Array.isArray(res?.data) ? res.data : [];
      const filtered = list.filter((x) => x.id !== Number(id) && x.is_active).slice(0, 12);
      setSimilarItems(filtered);
    } catch (e) {
      loggerRef.current?.error("Не удалось загрузить похожие готовые решения", e);
      setSimilarItems([]);
    } finally {
      setSimilarLoading(false);
    }
  };

  const primaryColorData = useMemo(() => {
    if (!kit?.primary_color_name) return null;
    return { name: kit.primary_color_name, image_url: kit.primary_color_image };
  }, [kit?.primary_color_name, kit?.primary_color_image]);

  const secondaryColorData = useMemo(() => {
    if (!kit?.secondary_color_name) return null;
    return { name: kit.secondary_color_name, image_url: kit.secondary_color_image };
  }, [kit?.secondary_color_name, kit?.secondary_color_image]);

  if (loading) {
    return <div className="shop-container py-12"><div className="glass-card p-6 text-night-500">Загружаем...</div></div>;
  }

  if (!kit) {
    return <div className="shop-container py-12"><div className="glass-card p-6 text-night-500">Не найдено</div></div>;
  }

  return (
    <div className="shop-container py-8">
      <nav className="text-sm text-night-500 mb-6">
        <Link to="/" className="hover:text-accent transition">Главная</Link>{" / "}
        <Link to="/catalog" className="hover:text-accent transition">Каталог</Link>{" / "}
        <span className="text-night-900">{kit.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 mb-12">
        <div className="space-y-4">
          <div className="relative aspect-square bg-night-50 rounded-xl overflow-hidden border border-night-200 group">
            <img
              src={mainImage}
              alt={kit.name}
              className="h-full w-full object-contain p-4"
              crossOrigin="anonymous"
              onError={(e) => { if (e.target.src !== placeholderImage) e.target.src = placeholderImage; }}
              loading="lazy"
              decoding="async"
            />

            {images.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all z-20"
                  aria-label="Предыдущее"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() =>
                    setSelectedImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
                  }
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

          {images.length > 1 && (
            <div className="grid grid-cols-5 gap-2 px-1">
              {images.map((img, index) => (
                <button
                  key={img.id || index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                    selectedImageIndex === index
                      ? "border-accent shadow-md ring-2 ring-accent/50 scale-105"
                      : "border-night-200 hover:border-night-300 hover:scale-105"
                  }`}
                >
                  <img
                    src={getImageUrl(img.url)}
                    alt={`${kit.name} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-4xl font-bold text-night-900 mb-3 leading-tight">{kit.name}</h1>
              <FavoriteButton product={{ ...kit, __type: 'kitSolution' }} className="flex-shrink-0 mt-2" />
            </div>
            {kit.sku && <p className="text-sm text-night-500">Артикул: <span className="font-medium text-night-700">{kit.sku}</span></p>}
          </div>

          {kit.description && <div className="text-night-700 leading-relaxed text-lg">{kit.description}</div>}

          <div className="bg-night-50 rounded-lg p-4 border border-night-200">
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-4xl font-bold text-night-900">{formatCurrency(kit.final_price || 0)}</span>
            </div>
            <div className="space-y-2">
              <SecureButton onClick={handleAddToCart} className="w-full justify-center py-3 text-base font-semibold bg-accent text-night-900 hover:bg-accent-dark">В корзину</SecureButton>
              <SecureButton
                onClick={loadSimilar}
                variant="outline"
                className="w-full justify-center py-3 text-base font-semibold"
                disabled={similarLoading}
              >
                {similarLoading ? "Загрузка..." : "Похожие"}
              </SecureButton>
            </div>
          </div>

          <div className="space-y-4 border-t border-night-200 pt-6">
            {(kit.total_length_mm || kit.total_depth_mm || kit.total_height_mm) && (
              <div>
                <h3 className="text-sm font-semibold text-night-900 mb-3 uppercase tracking-wide">Габариты</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-night-50 rounded p-3"><span className="text-night-500 block text-xs mb-1">Длина</span><span className="font-semibold text-night-900 text-lg">{kit.total_length_mm || "-"} мм</span></div>
                  <div className="bg-night-50 rounded p-3"><span className="text-night-500 block text-xs mb-1">Глубина</span><span className="font-semibold text-night-900 text-lg">{kit.total_depth_mm || "-"} мм</span></div>
                  <div className="bg-night-50 rounded p-3"><span className="text-night-500 block text-xs mb-1">Высота</span><span className="font-semibold text-night-900 text-lg">{kit.total_height_mm || "-"} мм</span></div>
                </div>
              </div>
            )}
            {(kit.primary_color_name || kit.secondary_color_name) && (
              <div>
                <h3 className="text-sm font-semibold text-night-900 mb-3 uppercase tracking-wide">Цвета</h3>
                <div className="flex flex-wrap gap-3">
                  {primaryColorData && <ColorBadge labelPrefix="Основной:" colorData={primaryColorData} />}
                  {secondaryColorData && <ColorBadge labelPrefix="Доп.:" colorData={secondaryColorData} />}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6 mb-12">
        <div className="glass-card p-8">
          <h3 className="font-bold text-night-900 mb-4 text-lg">Параметры</h3>
          <div className="grid gap-8 md:grid-cols-3 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-night-100"><span className="text-night-500">Тип кухни</span><span className="font-semibold text-night-900">{kit.kitchen_type_name || "—"}</span></div>
              <div className="flex justify-between py-2 border-b border-night-100"><span className="text-night-500">Материал</span><span className="font-semibold text-night-900">{kit.material_name || "—"}</span></div>
              <div className="flex justify-between py-2 border-b border-night-100"><span className="text-night-500">Кол-во модулей</span><span className="font-semibold text-night-900">{kit.modules_count || "—"}</span></div>
            </div>
          </div>
        </div>

        <div className="glass-card p-8 space-y-6">
          <h3 className="font-bold text-night-900 text-lg">Компоненты</h3>
          {compositionSections.length === 0 ? (
            <p className="text-sm text-night-500">Состав не указан.</p>
          ) : (
            compositionSections.map(({ title, items }) => (
              <div key={title} className="space-y-3">
                <h4 className="text-sm font-semibold text-night-700 uppercase tracking-wide">{title}</h4>
                <div className="space-y-2">
                  {items.map((module) => (
                    <Link
                      key={module.id}
                      to={`/catalog/${module.id}`}
                      className="flex items-start gap-4 rounded-lg border border-night-100 p-3 hover:border-accent transition"
                    >
                      <div className="w-14 h-14 bg-night-50 rounded-lg overflow-hidden border border-night-200 flex-shrink-0">
                        <img
                          src={getImageUrl(module.preview_url)}
                          alt={module.name}
                          className="w-full h-full object-cover"
                          crossOrigin="anonymous"
                          onError={(e) => { if (e.target.src !== placeholderImage) e.target.src = placeholderImage; }}
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <div className="space-y-1 text-sm">
                        <p className="font-semibold text-night-900">{module.name}</p>
                        {module.sku && <p className="text-night-500">Артикул: {module.sku}</p>}
                        {(module.lengthMm || module.depthMm || module.heightMm) && (
                          <p className="text-night-500 text-xs">
                            {module.lengthMm || "—"}×{module.depthMm || "—"}×{module.heightMm || "—"} мм
                          </p>
                        )}
                      </div>
                      <div className="ml-auto text-sm font-semibold text-night-900 whitespace-nowrap">
                        {formatCurrency(module.finalPrice || 0)}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="glass-card p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h3 className="font-bold text-night-900 text-lg">Похожие</h3>
            <SecureButton
              variant="outline"
              onClick={loadSimilar}
              disabled={similarLoading}
              className="text-sm px-4 py-2"
            >
              {similarLoading ? "Загрузка..." : "Показать"}
            </SecureButton>
          </div>

          {similarLoading ? (
            <div className="text-night-500 text-center py-12">Загружаем похожие...</div>
          ) : similarItems.length === 0 ? (
            <div className="text-night-500 text-center py-12">Похожие не найдены</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {similarItems.map((product) => (
                <ProductCard key={product.id} product={{ ...product, __type: "kitSolution" }} onAdd={(item) => addItem(item, 1)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KitSolutionPage;
