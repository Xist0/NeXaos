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
  const { get } = useApi();
  const { addItem } = useCart();
  const logger = useLogger();

  const [kit, setKit] = useState(null);
  const [loading, setLoading] = useState(true);

  const getRef = useRef(get);
  const loggerRef = useRef(logger);

  useEffect(() => {
    getRef.current = get;
    loggerRef.current = logger;
  }, [get, logger]);

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
        if (active) setKit(res?.data || null);
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

  const mainImage = useMemo(() => getImageUrl(kit?.preview_url), [kit?.preview_url]);

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

  const componentModules = useMemo(() => {
    const typeTitle = {
      bottom: "Нижние модули",
      top: "Верхние модули",
      tall: "Пеналы",
      filler: "Доборные элементы",
      accessory: "Аксессуары",
    };
    const result = [];
    if (!modulesByType) return [];
    Object.entries(modulesByType).forEach(([type, list]) => {
      if (!Array.isArray(list) || list.length === 0) return;
      list.forEach((m) => {
        if (!m?.id) return;
        result.push({
          id: m.id,
          name: m.name,
          sku: m.sku,
          short_desc: typeTitle[type] ? `Категория: ${typeTitle[type]}` : undefined,
          final_price: m.finalPrice,
          price: m.finalPrice,
          image: m.preview_url || m.previewUrl,
          image_url: m.preview_url || m.previewUrl,
          preview_url: m.preview_url || m.previewUrl,
          is_active: true,
        });
      });
    });
    return result;
  }, [modulesByType]);

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
          </div>
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
                  {kit.primary_color_name && <ColorBadge value={kit.primary_color_name} labelPrefix="Основной:" />}
                  {kit.secondary_color_name && <ColorBadge value={kit.secondary_color_name} labelPrefix="Доп.:" />}
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
          <h3 className="font-bold text-night-900 text-lg">Состав готового решения</h3>
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
                      className="flex items-start justify-between gap-4 rounded-lg border border-night-100 p-3 hover:border-accent transition"
                    >
                      <div className="space-y-1 text-sm">
                        <p className="font-semibold text-night-900">{module.name}</p>
                        {module.sku && <p className="text-night-500">Артикул: {module.sku}</p>}
                        {(module.lengthMm || module.depthMm || module.heightMm) && (
                          <p className="text-night-500 text-xs">
                            {module.lengthMm || "—"}×{module.depthMm || "—"}×{module.heightMm || "—"} мм
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-night-900 whitespace-nowrap">
                        {formatCurrency(module.finalPrice || 0)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {componentModules.length > 0 && (
          <div className="glass-card p-8">
            <h3 className="font-bold text-night-900 mb-4 text-lg">Компоненты ({componentModules.length})</h3>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {componentModules.map((module) => (
                <ProductCard key={module.id} product={module} onAdd={(item) => addItem(item, 1)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KitSolutionPage;
