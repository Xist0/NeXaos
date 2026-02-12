import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import useApi from "../hooks/useApi";
import useCart from "../hooks/useCart";
import SecureButton from "../components/ui/SecureButton";
import FavoriteButton from "../components/ui/FavoriteButton";
import ColorBadge from "../components/ui/ColorBadge";
import useLogger from "../hooks/useLogger";
import { formatCurrency } from "../utils/format";
import { getImageUrl } from "../utils/image";
import ProductGallery from "../components/ui/ProductGallery";

const CatalogItemPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { get } = useApi();
  const { addItem } = useCart();
  const logger = useLogger();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

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

    const fetchItem = async () => {
      setLoading(true);
      try {
        const res = await getRef.current(`/catalog-items/${id}`, undefined, { signal: abortController.signal });
        if (active) {
          setItem(res?.data || null);
          setSelectedImageIndex(0);
        }
      } catch (_e) {
        if (active && !abortController.signal.aborted) {
          loggerRef.current?.error("Не удалось загрузить товар");
          navigate("/catalog");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchItem();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [id, navigate]);

  const images = useMemo(() => {
    const url = item?.preview_url || item?.image_url || null;
    return url ? [{ url }] : [];
  }, [item?.preview_url, item?.image_url]);

  const customCharacteristics = useMemo(() => {
    const ch = item?.characteristics && typeof item.characteristics === "object" && !Array.isArray(item.characteristics)
      ? item.characteristics
      : {};
    const rows = [];

    const params = Array.isArray(item?.parameters) ? item.parameters : [];
    if (params.length > 0) {
      params.forEach((p) => {
        const name = String(p?.name || "").trim();
        const qty = Number(p?.quantity);
        const value = p?.value === null || p?.value === undefined ? "" : String(p.value).trim();
        if (!name) return;
        if (value) {
          rows.push({ label: name, value });
          return;
        }
        if (Number.isFinite(qty) && qty > 1) {
          rows.push({ label: name, value: `×${qty}` });
        }
      });
    }

    if (ch.product_type) rows.push({ label: "Тип изделия", value: String(ch.product_type) });
    if (ch.purpose) rows.push({ label: "Назначение", value: String(ch.purpose) });
    if (ch.material_corpus) rows.push({ label: "Материал корпуса", value: String(ch.material_corpus) });
    if (ch.material_facade) rows.push({ label: "Материал фасада", value: String(ch.material_facade) });
    if (ch.opening_type) rows.push({ label: "Тип открывания", value: String(ch.opening_type) });
    if (ch.guides_type) rows.push({ label: "Тип направляющих", value: String(ch.guides_type) });
    if (ch.hinges_type) rows.push({ label: "Тип петель", value: String(ch.hinges_type) });
    if (ch.supports_type) rows.push({ label: "Тип опор", value: String(ch.supports_type) });
    if (ch.features) rows.push({ label: "Особенности", value: String(ch.features) });
    if (typeof ch.mirror === "boolean" && ch.mirror) rows.push({ label: "Зеркало", value: "Да" });
    if (ch.shelf_count) rows.push({ label: "Кол-во полок", value: String(ch.shelf_count) });
    if (ch.drawer_count) rows.push({ label: "Кол-во ящиков", value: String(ch.drawer_count) });
    if (ch.front_count) rows.push({ label: "Кол-во фасадов", value: String(ch.front_count) });
    if (ch.design_style) rows.push({ label: "Стиль дизайна", value: String(ch.design_style) });
    if (ch.weight_kg) rows.push({ label: "Вес, кг", value: String(ch.weight_kg) });
    if (ch.country) rows.push({ label: "Страна-производитель", value: String(ch.country) });
    return rows;
  }, [item?.characteristics]);

  const handleAddToCart = () => {
    if (!item) return;
    addItem({ ...item, __type: "catalogItem" }, 1);
  };

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
      <nav className="text-sm text-night-500 mb-6">
        <Link to="/catalog" className="hover:text-accent transition">Каталог</Link>
        <span className="text-night-900 mx-2">/</span>
        <span className="font-medium">{item.name}</span>
      </nav>

      <div className="grid gap-8 lg:gap-10 lg:grid-cols-[540px_minmax(0,1fr)_320px] lg:items-start mb-8 sm:mb-12">
        <ProductGallery
          title={item.name}
          images={images}
          selectedIndex={selectedImageIndex}
          onSelect={setSelectedImageIndex}
          showSimilarButton={false}
          isNew={false}
          getImageUrl={getImageUrl}
        />

        <div className="space-y-4 sm:space-y-6 lg:pt-0 min-w-0 lg:self-start">
          {(item.primary_color || item.secondary_color || item.primary_color_name || item.secondary_color_name || item.length_mm || item.depth_mm || item.height_mm) && (
            <div className="glass-card p-4">
              <div className="space-y-4">
                {(item.primary_color || item.secondary_color || item.primary_color_name || item.secondary_color_name) && (
                  <div>
                    <div className="text-xs font-semibold text-night-500 uppercase tracking-wide mb-2">Цвета</div>
                    <div className="space-y-2">
                      {(item.primary_color || item.primary_color_name) && (
                        <div className="grid grid-cols-[88px_1fr] items-center gap-3">
                          <span className="text-night-500 text-sm">Основной:</span>
                          {item.primary_color ? (
                            <ColorBadge colorData={item.primary_color} />
                          ) : (
                            <span className="text-sm text-night-900 font-medium">{item.primary_color_name}</span>
                          )}
                        </div>
                      )}
                      {(item.secondary_color || item.secondary_color_name) && (
                        <div className="grid grid-cols-[88px_1fr] items-center gap-3">
                          <span className="text-night-500 text-sm">Доп.:</span>
                          {item.secondary_color ? (
                            <ColorBadge colorData={item.secondary_color} />
                          ) : (
                            <span className="text-sm text-night-900 font-medium">{item.secondary_color_name}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(item.length_mm || item.depth_mm || item.height_mm) && (
                  <div className={item.primary_color || item.secondary_color || item.primary_color_name || item.secondary_color_name ? "border-t border-night-200 pt-4" : ""}>
                    <div className="text-xs font-semibold text-night-500 uppercase tracking-wide mb-2">Габариты</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <span className="text-night-500 text-xs block mb-1">Длина</span>
                        <span className="font-semibold text-night-900">{item.length_mm || "—"} мм</span>
                      </div>
                      <div>
                        <span className="text-night-500 text-xs block mb-1">Глубина</span>
                        <span className="font-semibold text-night-900">{item.depth_mm || "—"} мм</span>
                      </div>
                      <div>
                        <span className="text-night-500 text-xs block mb-1">Высота</span>
                        <span className="font-semibold text-night-900">{item.height_mm || "—"} мм</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="glass-card p-4">
            <h3 className="font-bold text-night-900 mb-3 text-lg">Описание</h3>
            <div className="text-night-700 leading-relaxed whitespace-pre-line">{item.description || "Описание не указано"}</div>
          </div>

          {customCharacteristics.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="font-bold text-night-900 mb-3 text-lg">Характеристики</h3>
              <div className="space-y-2 text-sm text-night-800 leading-relaxed">
                {customCharacteristics.map((row) => (
                  <div key={row.label} className="grid grid-cols-[160px_1fr] gap-3 min-w-0">
                    <span className="text-night-500 truncate">{row.label}:</span>
                    <span className="font-semibold text-night-900 break-words min-w-0">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="glass-card p-5 sm:p-6 space-y-4 lg:self-start min-w-0 overflow-hidden">
          <div className="space-y-2 pt-1">
            <h1 className="text-xl sm:text-2xl font-bold text-night-900 leading-tight break-words">{item.name}</h1>
          </div>

          <div>
            <span className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-accent to-accent-dark bg-clip-text text-transparent">
              {formatCurrency(item.final_price || item.base_price || 0)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <FavoriteButton
              product={{ ...item, __type: "catalogItem" }}
              className="mt-0 bg-white/90 hover:bg-accent/15 shadow-sm hover:shadow-md border border-night-200 p-1.5"
            />
            <SecureButton
              onClick={handleAddToCart}
              className="btn-shimmer !h-11 !px-6 !text-base !rounded-xl !bg-gradient-to-r !from-accent !via-accent-dark !to-accent !text-white !font-semibold !shadow-lg hover:!shadow-xl whitespace-nowrap"
            >
              В корзину
            </SecureButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogItemPage;
