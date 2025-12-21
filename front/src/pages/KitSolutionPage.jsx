import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import useApi from "../hooks/useApi";
import useCart from "../hooks/useCart";
import SecureButton from "../components/ui/SecureButton";
import { formatCurrency } from "../utils/format";
import ColorBadge from "../components/ui/ColorBadge";
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
  const [activeTab, setActiveTab] = useState("modules");
  const [similar, setSimilar] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  const getRef = useRef(get);
  const loggerRef = useRef(logger);

  useEffect(() => {
    getRef.current = get;
  }, [get]);

  useEffect(() => {
    loggerRef.current = logger;
  }, [logger]);

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
        const res = await getRef.current(`/kit-solutions/${id}`, undefined, {
          signal: abortController.signal,
        });
        const data = res?.data;
        if (active) {
          setKit(data || null);
          setLoading(false);
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

  const image = useMemo(() => getImageUrl(kit?.preview_url), [kit?.preview_url]);

  const handleAddToCart = () => {
    if (!kit) return;
    addItem({ ...kit, __type: "kitSolution" }, 1);
  };

  const handleFindSimilar = async () => {
    if (!kit?.id) return;
    if (similarLoading) return;
    setSimilarLoading(true);
    try {
      const res = await post(`/kit-solutions/${kit.id}/similar`, { limit: 12 });
      setSimilar(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      logger.error("Не удалось найти похожие кухни", e);
      setSimilar([]);
    } finally {
      setSimilarLoading(false);
    }
  };

  const modulesByType = kit?.modules || {};

  const renderModulesTable = (title, list) => {
    if (!Array.isArray(list) || list.length === 0) return null;
    return (
      <div className="glass-card p-4 space-y-3">
        <h3 className="text-lg font-semibold text-night-900">{title}</h3>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-night-500">
                <th className="text-left py-2 pr-4">Модуль</th>
                <th className="text-left py-2 pr-4">Артикул</th>
                <th className="text-left py-2 pr-4">Размеры (мм)</th>
                <th className="text-left py-2 pr-4">Цена</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id} className="border-t border-night-100">
                  <td className="py-2 pr-4">
                    <Link className="hover:text-accent" to={`/catalog/${m.id}`}>{m.name}</Link>
                  </td>
                  <td className="py-2 pr-4 text-night-500">{m.sku || "—"}</td>
                  <td className="py-2 pr-4 text-night-500">{m.lengthMm}×{m.depthMm}×{m.heightMm}</td>
                  <td className="py-2 pr-4 font-semibold text-night-900">{formatCurrency(m.finalPrice || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="shop-container py-12"><div className="glass-card p-6 text-night-500">Загружаем...</div></div>;
  }

  if (!kit) {
    return <div className="shop-container py-12"><div className="glass-card p-6 text-night-500">Не найдено</div></div>;
  }

  return (
    <div className="shop-container space-y-8 py-12">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-night-400">Готовое решение</p>
          <h1 className="text-3xl font-semibold text-night-900">{kit.name}</h1>
          {kit.sku && <p className="text-sm text-night-500">Артикул: {kit.sku}</p>}
          {kit.kitchen_type_name && <p className="text-sm text-night-500">Тип кухни: {kit.kitchen_type_name}</p>}
          <div className="flex flex-wrap gap-2 text-xs">
            {kit.primary_color_name && (
              <ColorBadge
                value={kit.primary_color_name}
                labelPrefix="Основной:"
              />
            )}
            {kit.secondary_color_name && (
              <ColorBadge
                value={kit.secondary_color_name}
                labelPrefix="Доп.:"
              />
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <SecureButton variant="outline" onClick={handleFindSimilar}>
            {similarLoading ? "Ищем..." : "Похожие"}
          </SecureButton>
          <SecureButton onClick={handleAddToCart}>В корзину</SecureButton>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
        <div className="glass-card overflow-hidden">
          <img
            src={image}
            alt={kit.name}
            className="w-full aspect-[4/3] object-cover"
            crossOrigin={image.startsWith("http://localhost:5000") ? "anonymous" : undefined}
          />
        </div>

        <div className="space-y-4">
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-night-400">Стоимость</p>
                <p className="text-3xl font-bold text-accent">{formatCurrency(kit.final_price || 0)}</p>
              </div>
              {kit.material_name && (
                <div className="text-sm text-night-500">Материал: {kit.material_name}</div>
              )}
            </div>

            {kit.description && <p className="text-sm text-night-600">{kit.description}</p>}

            <div className="grid gap-2 sm:grid-cols-3 text-sm">
              <div className="p-3 rounded-lg bg-night-50">
                <div className="text-xs text-night-400">Длина</div>
                <div className="font-semibold text-night-900">{kit.total_length_mm || kit.calculatedDimensions?.bottomTotalLength || "—"} мм</div>
              </div>
              <div className="p-3 rounded-lg bg-night-50">
                <div className="text-xs text-night-400">Глубина</div>
                <div className="font-semibold text-night-900">{kit.total_depth_mm || kit.calculatedDimensions?.maxDepth || "—"} мм</div>
              </div>
              <div className="p-3 rounded-lg bg-night-50">
                <div className="text-xs text-night-400">Высота</div>
                <div className="font-semibold text-night-900">{kit.total_height_mm || "—"} мм</div>
              </div>
            </div>

            <div className="text-sm text-night-600">
              Столешница: {kit.countertop_length_mm || kit.calculatedDimensions?.countertopLength || "—"} мм × {kit.countertop_depth_mm || kit.calculatedDimensions?.countertopDepth || "—"} мм
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <SecureButton
              variant={activeTab === "modules" ? "primary" : "outline"}
              onClick={() => setActiveTab("modules")}
            >
              Состав
            </SecureButton>
            <SecureButton
              variant={activeTab === "details" ? "primary" : "outline"}
              onClick={() => setActiveTab("details")}
            >
              Параметры
            </SecureButton>
            {similar.length > 0 && (
              <SecureButton
                variant={activeTab === "similar" ? "primary" : "outline"}
                onClick={() => setActiveTab("similar")}
              >
                Похожие ({similar.length})
              </SecureButton>
            )}
          </div>

          {activeTab === "modules" && (
            <div className="space-y-4">
              {renderModulesTable("Нижние модули", modulesByType.bottom)}
              {renderModulesTable("Верхние модули", modulesByType.top)}
              {renderModulesTable("Пеналы", modulesByType.tall)}
              {renderModulesTable("Доборные элементы", modulesByType.filler)}
              {renderModulesTable("Аксессуары", modulesByType.accessory)}
            </div>
          )}

          {activeTab === "details" && (
            <div className="glass-card p-5 space-y-2 text-sm text-night-600">
              <div><span className="text-night-400">ID:</span> {kit.id}</div>
              <div><span className="text-night-400">Артикул:</span> {kit.sku || "—"}</div>
              <div><span className="text-night-400">Тип кухни:</span> {kit.kitchen_type_name || "—"}</div>
              <div><span className="text-night-400">Основной цвет:</span> {kit.primary_color_name || "—"}</div>
              <div><span className="text-night-400">Доп. цвет:</span> {kit.secondary_color_name || "—"}</div>
              <div><span className="text-night-400">Материал:</span> {kit.material_name || "—"}</div>
              <div><span className="text-night-400">Количество модулей:</span> {kit.modules_count || kit.modulesCount?.bottom + kit.modulesCount?.top || "—"}</div>
            </div>
          )}

          {activeTab === "similar" && (
            <div className="glass-card p-5 space-y-3">
              <h3 className="text-lg font-semibold text-night-900">Похожие кухни</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {similar.map((s) => (
                  <Link key={s.id} to={`/catalog/kit/${s.id}`} className="border border-night-200 rounded-lg p-3 hover:border-accent transition">
                    <div className="text-sm font-semibold text-night-900">{s.name}</div>
                    <div className="text-xs text-night-500">{s.sku || "—"}</div>
                    <div className="text-xs text-night-500">Цена: {formatCurrency(s.final_price || 0)}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KitSolutionPage;
