import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import useApi from "../hooks/useApi";
import useCart from "../hooks/useCart";
import SecureButton from "../components/ui/SecureButton";
import ProductCard from "../components/ui/ProductCard";
import { formatCurrency } from "../utils/format";
import ColorBadge from "../components/ui/ColorBadge";
import FavoriteButton from "../components/ui/FavoriteButton";
import useLogger from "../hooks/useLogger";
import { getThumbUrl, getImageUrl } from "../utils/image";
import ProductGallery from "../components/ui/ProductGallery";
import apiClient from "../services/apiClient";

const ProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { get, post } = useApi();
  const { addItem } = useCart();
  const logger = useLogger();

  const [item, setItem] = useState(null); // module ИЛИ kitSolution
  const [images, setImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [similarItems, setSimilarItems] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [moduleDescription, setModuleDescription] = useState(null);

  const sizeRowRef = useRef(null);
  const colorRowRef = useRef(null);
  const [sizeRowScroll, setSizeRowScroll] = useState({ canLeft: false, canRight: false, hasOverflow: false });
  const [colorRowScroll, setColorRowScroll] = useState({ canLeft: false, canRight: false, hasOverflow: false });
  const [variantsModalOpen, setVariantsModalOpen] = useState(false);

  const resolveThumb = useCallback(
    (url, opts) => getThumbUrl(url, opts || { w: 1200, h: 1600, q: 75, fit: "inside" }),
    []
  );

  const variantItems = useMemo(() => {
    const list = [item, ...(Array.isArray(similarItems) ? similarItems : [])].filter(Boolean);
    const unique = new Map();
    list.forEach((x) => {
      if (!x?.id) return;
      unique.set(String(x.id), x);
    });
    const arr = Array.from(unique.values());
    arr.sort((a, b) => {
      const as = String(a?.sku || "");
      const bs = String(b?.sku || "");
      if (as && bs) return as.localeCompare(bs, "ru");
      if (as) return -1;
      if (bs) return 1;
      return Number(a?.id || 0) - Number(b?.id || 0);
    });
    return arr;
  }, [item, similarItems]);

  const getRef = useRef(get);
  const postRef = useRef(post);
  const loggerRef = useRef(logger);
  const isFetchingRef = useRef(false);
  const lastIdRef = useRef(null);

  const similarRequestRef = useRef({ inFlight: false, lastForId: null });

  useEffect(() => {
    getRef.current = get;
  }, [get]);

  useEffect(() => {
    postRef.current = post;
  }, [post]);

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
        const validateStatus = (status) => (status >= 200 && status < 300) || status === 304 || status === 404;
        const unwrap = (resp) => {
          const payload = resp?.data;
          if (
            payload &&
            typeof payload === "object" &&
            !Array.isArray(payload) &&
            Object.prototype.hasOwnProperty.call(payload, "data")
          ) {
            return payload.data;
          }
          return payload;
        };

        const resp = await apiClient.get(`/catalog/${id}`, {
          signal: abortController.signal,
          validateStatus,
        });

        const itemData = resp?.status === 404 ? null : unwrap(resp);
        const itemType = itemData?.__type || "module";

        if (active && itemData) {
          setItem({ ...itemData, __type: itemType });
          const imgs = Array.isArray(itemData?.images)
            ? itemData.images
            : itemType === "catalogItem"
              ? (() => {
                  const url = itemData?.preview_url || itemData?.image_url || null;
                  return url ? [{ url }] : [];
                })()
              : [];
          setImages(imgs);
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

  useEffect(() => {
    if (!item?.base_sku) {
      setModuleDescription(null);
      return;
    }

    if (item?.short_desc) {
      setModuleDescription(null);
      return;
    }

    let active = true;
    getRef.current(`/modules/descriptions/${encodeURIComponent(item.base_sku)}`)
      .then((res) => {
        if (!active) return;
        setModuleDescription(res?.data || null);
      })
      .catch(() => {
        if (!active) return;
        setModuleDescription(null);
      });

    return () => {
      active = false;
    };
  }, [item?.base_sku, get]);

  // NOTE: we intentionally keep rows left-aligned on first render (no auto-centering)

  const updateRowScrollState = useCallback((rowRef, setState) => {
    const el = rowRef.current;
    if (!el) return;
    const maxScrollLeft = Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0));
    const left = el.scrollLeft || 0;
    const epsilon = 2;
    const hasOverflow = maxScrollLeft > epsilon;
    setState({
      hasOverflow,
      canLeft: hasOverflow && left > epsilon,
      canRight: hasOverflow && left < maxScrollLeft - epsilon,
    });
  }, []);

  const scrollByRow = useCallback(
    (rowRef, setState, delta) => {
      const el = rowRef.current;
      if (!el) return;
      el.scrollBy({ left: delta, behavior: "smooth" });
      requestAnimationFrame(() => updateRowScrollState(rowRef, setState));
      setTimeout(() => updateRowScrollState(rowRef, setState), 180);
    },
    [updateRowScrollState]
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      updateRowScrollState(sizeRowRef, setSizeRowScroll);
      updateRowScrollState(colorRowRef, setColorRowScroll);
    });

    const sizeEl = sizeRowRef.current;
    const colorEl = colorRowRef.current;
    if (!sizeEl && !colorEl) return;

    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        updateRowScrollState(sizeRowRef, setSizeRowScroll);
        updateRowScrollState(colorRowRef, setColorRowScroll);
      });
      if (sizeEl) ro.observe(sizeEl);
      if (colorEl) ro.observe(colorEl);
    }

    const onWindowResize = () => {
      updateRowScrollState(sizeRowRef, setSizeRowScroll);
      updateRowScrollState(colorRowRef, setColorRowScroll);
    };
    window.addEventListener("resize", onWindowResize);

    return () => {
      window.removeEventListener("resize", onWindowResize);
      if (ro) ro.disconnect();
    };
  }, [updateRowScrollState, variantItems.length]);

  // Похожие товары
  const loadSimilar = useCallback(async () => {
    if (!item?.id) return;
    if (item.__type !== "module" && item.__type !== "catalogItem") return;
    if (similarRequestRef.current.inFlight) return;
    if (similarRequestRef.current.lastForId === item.id && similarItems.length > 0) return;

    similarRequestRef.current.inFlight = true;
    similarRequestRef.current.lastForId = item.id;
    setSimilarLoading(true);
    try {
      const endpoint = item.__type === "catalogItem" ? `/catalog-items/${item.id}/similar` : `/modules/${item.id}/similar`;
      const res = await postRef.current(endpoint, { limit: 12 });
      const list = Array.isArray(res?.data) ? res.data : [];
      const filtered = list.filter((x) => x.id !== Number(id) && x.is_active).slice(0, 12);
      setSimilarItems(filtered);
    } catch (error) {
      console.error("Ошибка похожих:", error);
      setSimilarItems([]);
      similarRequestRef.current.lastForId = null;
    } finally {
      similarRequestRef.current.inFlight = false;
      setSimilarLoading(false);
    }
  }, [item?.id, id, similarItems.length]);

  useEffect(() => {
    if (!item?.id) return;
    if (item.__type !== "module" && item.__type !== "catalogItem") return;
    loadSimilar();
  }, [item?.id, loadSimilar]);

  const handleAddToCart = () => {
    if (!item) return;
    addItem(item.__type === "kitSolution" ? { ...item, __type: "kitSolution" } : item, 1);
  };

  const handleFindSimilar = () => {
    if (!item?.id) return;
    const params = new URLSearchParams({ fromProduct: "1" });
    if (item.__type === "catalogItem") params.set("similarCatalogItemId", String(item.id));
    else params.set("similarModuleId", String(item.id));

    let categoryCode = item.category_code;
    if (!categoryCode && item.module_category_id) {
      categoryCode = item.module_category_id === 1 ? "bottom" :
        item.module_category_id === 2 ? "top" :
        item.module_category_id === 3 ? "tall" :
        item.module_category_id === 4 ? "filler" :
        item.module_category_id === 5 ? "accessory" : null;
    }
    if (categoryCode) params.set("category", categoryCode);

    if (item.base_sku) params.set("subCategory", String(item.base_sku));
    if (item.facade_color) params.set("facadeColor", item.facade_color);
    if (item.corpus_color) params.set("corpusColor", item.corpus_color);
    if (item.length_mm) {
      params.set("lengthFrom", String(item.length_mm - 50));
      params.set("lengthTo", String(item.length_mm + 50));
    }
    navigate(`/catalog?${params.toString()}`);
  };

  const isKit = item?.__type === "kitSolution";
  const isModule = item?.__type === "module";
  const isCatalogItem = item?.__type === "catalogItem";
  const canShowSimilar = isModule || isCatalogItem;
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

  const fullCharacteristics = useMemo(() => {
    const list = [];
    if (!item) return list;

    if (item.sku) list.push({ label: "Артикул", value: String(item.sku) });
    if (item.base_sku) list.push({ label: "Базовый SKU", value: String(item.base_sku) });
    if (item.category_group) list.push({ label: "Категория", value: String(item.category_group) });
    if (item.category) list.push({ label: "Подкатегория", value: String(item.category) });

    const primaryColor = item.primary_color?.name || item.facade_color;
    const secondaryColor = item.secondary_color?.name || item.corpus_color;
    if (primaryColor) list.push({ label: "Цвет (основной)", value: String(primaryColor) });
    if (secondaryColor) list.push({ label: "Цвет (доп.)", value: String(secondaryColor) });

    if (item.length_mm) list.push({ label: "Длина", value: `${item.length_mm} мм` });
    if (item.depth_mm) list.push({ label: "Глубина", value: `${item.depth_mm} мм` });
    if (item.height_mm) list.push({ label: "Высота", value: `${item.height_mm} мм` });

    if (item.base_price) list.push({ label: "Базовая цена", value: formatCurrency(item.base_price) });
    if (item.final_price) list.push({ label: "Итоговая цена", value: formatCurrency(item.final_price) });

    return list;
  }, [item]);

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
      <div className="grid gap-8 lg:gap-10 lg:grid-cols-[540px_minmax(0,1fr)_320px] lg:items-start mb-8 sm:mb-12">
        <ProductGallery
          title={item.name}
          images={images}
          selectedIndex={selectedImageIndex}
          onSelect={setSelectedImageIndex}
          onOpenSimilar={handleFindSimilar}
          showSimilarButton={canShowSimilar}
          isNew={Boolean(item.is_new)}
          getImageUrl={resolveThumb}
        />

        {/* Центр: варианты + характеристики */}
        <div className="space-y-4 sm:space-y-6 lg:pt-0 min-w-0 lg:self-start">
          {variantItems.length > 1 && (
            <div>
              {(() => {
                const selectedSize = item?.length_mm ? Number(item.length_mm) : null;
                const selectedPrimary = (item?.primary_color?.name || item?.facade_color || "").trim();
                const selectedSecondary = (item?.secondary_color?.name || item?.corpus_color || "").trim();
                const selectedColorLabel = [selectedPrimary, selectedSecondary].filter(Boolean).join(" + ");
                const selectedColorKey = selectedColorLabel || String(item?.id || "");

                const sizes = Array.from(
                  new Set(
                    variantItems
                      .map((v) => (v.length_mm ? Number(v.length_mm) : null))
                      .filter((x) => x !== null)
                  )
                ).sort((a, b) => a - b);

                const colors = Array.from(
                  new Map(
                    variantItems.map((v) => {
                      const primary = (v.primary_color?.name || v.facade_color || "").trim();
                      const secondary = (v.secondary_color?.name || v.corpus_color || "").trim();
                      const label = [primary, secondary].filter(Boolean).join(" + ");
                      const key = label || String(v.id);
                      const imgUrl = Array.isArray(v.images) && v.images[0]?.url ? v.images[0].url : (v.preview_url || v.image_url);
                      return [key, { key, label, primary, secondary, imgUrl, sample: v }];
                    })
                  ).values()
                );

                const scrollToCenterSmooth = (container, target) => {
                  if (!container || !target) return;
                  const left = target.offsetLeft - (container.clientWidth - target.clientWidth) / 2;
                  container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
                };

                return (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="text-night-500 text-sm">
                        Выбран размер: <span className="text-night-900 font-medium">{selectedSize ? `${Math.round(selectedSize / 10)} см` : "—"}</span>
                      </div>
                      <div className="relative overflow-hidden">
                        <button
                          type="button"
                          onClick={() => scrollByRow(sizeRowRef, setSizeRowScroll, -260)}
                          className={`hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-full bg-white/95 border border-night-200 shadow-sm hover:shadow-md ${
                            sizeRowScroll.hasOverflow && sizeRowScroll.canLeft ? "" : "sm:hidden"
                          }`}
                          aria-label="Размеры: влево"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollByRow(sizeRowRef, setSizeRowScroll, 260)}
                          className={`hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-full bg-white/95 border border-night-200 shadow-sm hover:shadow-md ${
                            sizeRowScroll.hasOverflow && sizeRowScroll.canRight ? "" : "sm:hidden"
                          }`}
                          aria-label="Размеры: вправо"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>

                        <div
                          ref={sizeRowRef}
                          onScroll={() => updateRowScrollState(sizeRowRef, setSizeRowScroll)}
                          className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth px-1"
                          style={{ scrollbarWidth: "none" }}
                        >
                        {sizes.map((len) => {
                          const isActive = selectedSize !== null && Number(selectedSize) === Number(len);
                          return (
                            <button
                              key={len}
                              type="button"
                              data-size={len}
                              onClick={(e) => {
                                const currentColor = selectedColor;
                                const candidates = variantItems.filter((v) => Number(v.length_mm) === Number(len));
                                const next =
                                  candidates.find((v) => (v.primary_color?.name || v.facade_color || "") === currentColor) ||
                                  candidates[0];
                                if (!next || String(next.id) === String(item.id)) return;
                                scrollToCenterSmooth(sizeRowRef.current, e.currentTarget);
                                navigate(`/catalog/${next.id}`);
                              }}
                              className={`snap-center flex-shrink-0 w-[88px] h-12 rounded-xl border text-lg font-medium transition ${
                                isActive ? "border-accent text-accent bg-accent/5" : "border-night-200 hover:border-night-300"
                              }`}
                            >
                              {Math.round(Number(len) / 10)}
                            </button>
                          );
                        })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-night-500 text-sm">
                        Выбран цвет: <span className="text-night-900 font-medium">{selectedColorLabel || "—"}</span>
                      </div>
                      <div className="relative overflow-hidden">
                        <button
                          type="button"
                          onClick={() => scrollByRow(colorRowRef, setColorRowScroll, -260)}
                          className={`hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-full bg-white/95 border border-night-200 shadow-sm hover:shadow-md ${
                            colorRowScroll.hasOverflow && colorRowScroll.canLeft ? "" : "sm:hidden"
                          }`}
                          aria-label="Цвета: влево"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollByRow(colorRowRef, setColorRowScroll, 260)}
                          className={`hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-full bg-white/95 border border-night-200 shadow-sm hover:shadow-md ${
                            colorRowScroll.hasOverflow && colorRowScroll.canRight ? "" : "sm:hidden"
                          }`}
                          aria-label="Цвета: вправо"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>

                        <div
                          ref={colorRowRef}
                          onScroll={() => updateRowScrollState(colorRowRef, setColorRowScroll)}
                          className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth px-1"
                          style={{ scrollbarWidth: "none" }}
                        >
                        {colors.map(({ key, label, primary, secondary, imgUrl, sample }) => {
                          const isActive = key === selectedColorKey;
                          const safeLabel = encodeURIComponent(label || String(sample?.id || ""));
                          return (
                            <button
                              key={key}
                              type="button"
                              data-color={safeLabel}
                              onClick={(e) => {
                                const currentLen = selectedSize !== null ? Number(selectedSize) : null;
                                const candidates = currentLen
                                  ? variantItems.filter((x) => Number(x.length_mm) === Number(currentLen))
                                  : variantItems;
                                let next = sample;
                                if (label) {
                                  const match = (x) => {
                                    const p = ((x.primary_color?.name || x.facade_color || "").trim());
                                    const s = ((x.secondary_color?.name || x.corpus_color || "").trim());
                                    return p === (primary || "") && s === (secondary || "");
                                  };
                                  next = candidates.find(match) || variantItems.find(match) || sample;
                                }
                                if (!next) return;
                                if (String(next.id) === String(item.id)) {
                                  // Если кликнули по текущему — ничего не делаем
                                  return;
                                }
                                scrollToCenterSmooth(colorRowRef.current, e.currentTarget);
                                navigate(`/catalog/${next.id}`);
                              }}
                              className={`snap-center flex-shrink-0 rounded-xl border bg-white transition p-1 ${
                                isActive ? "border-accent ring-2 ring-accent/40" : "border-night-200 hover:border-night-300"
                              }`}
                              aria-label={label || "Цвет"}
                              title={label || ""}
                            >
                              <div className="w-11 h-14 rounded-md overflow-hidden">
                                {imgUrl ? (
                                  <img
                                    src={resolveThumb(imgUrl, { w: 220, h: 280, q: 70, fit: "inside" })}
                                    alt={label || item.name}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                        </div>
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => setVariantsModalOpen(true)}
                        className="text-xs font-semibold text-night-500 hover:text-accent hover:underline"
                      >
                        Показать больше
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {(item.length_mm || item.depth_mm || item.height_mm || item.primary_color || item.secondary_color || item.facade_color || item.corpus_color) && (
            <div className="glass-card p-4">
              <div className="space-y-4">
                {(item.primary_color || item.secondary_color || item.facade_color || item.corpus_color) && (
                  <div>
                    <div className="text-xs font-semibold text-night-500 uppercase tracking-wide mb-2">Цвета</div>
                    <div className="space-y-2">
                      {(item.primary_color || item.facade_color) && (
                        <div className="grid grid-cols-[88px_1fr] items-center gap-3">
                          <span className="text-night-500 text-sm">Основной:</span>
                          {item.primary_color ? <ColorBadge colorData={item.primary_color} /> : <ColorBadge value={item.facade_color} />}
                        </div>
                      )}
                      {(item.secondary_color || item.corpus_color) && (
                        <div className="grid grid-cols-[88px_1fr] items-center gap-3">
                          <span className="text-night-500 text-sm">Доп.:</span>
                          {item.secondary_color ? <ColorBadge colorData={item.secondary_color} /> : <ColorBadge value={item.corpus_color} />}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(item.length_mm || item.depth_mm || item.height_mm) && (
                  <div className={item.primary_color || item.secondary_color || item.facade_color || item.corpus_color ? "border-t border-night-200 pt-4" : ""}>
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
        </div>

        {/* Право: название + цена + действия */}
        <div className="glass-card p-5 sm:p-6 space-y-4 min-w-0 lg:self-start overflow-hidden">
          <div className="space-y-2 pt-1">
            <h1 className="text-xl sm:text-2xl font-bold text-night-900 leading-tight break-words">
              {item.name}
            </h1>
          </div>

          <div>
            <span className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-accent to-accent-dark bg-clip-text text-transparent">
              {formatCurrency(item.final_price || item.price || 0)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <FavoriteButton product={item} className="mt-0 bg-white/90 hover:bg-accent/15 shadow-sm hover:shadow-md border border-night-200 p-1.5" />
            <SecureButton
              onClick={handleAddToCart}
              className="btn-shimmer !h-11 !px-6 !text-base !rounded-xl !bg-gradient-to-r !from-accent !via-accent-dark !to-accent !text-white !font-semibold !shadow-lg hover:!shadow-xl whitespace-nowrap"
            >
              В корзину
            </SecureButton>
          </div>
        </div>
      </div>

      {variantsModalOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setVariantsModalOpen(false)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-4xl max-h-[85vh] overflow-hidden glass-card p-4 sm:p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="text-lg font-bold text-night-900">Варианты</div>
              <button type="button" onClick={() => setVariantsModalOpen(false)} className="text-night-500 hover:text-night-900 text-2xl leading-none">&times;</button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(() => {
                  const getPrimaryLabel = (x) => (x?.primary_color?.name || x?.facade_color || "").trim();
                  const getSecondaryLabel = (x) => (x?.secondary_color?.name || x?.corpus_color || "").trim();

                  const getPrimarySampleUrl = (x) => x?.primary_color?.image_url || null;
                  const getSecondarySampleUrl = (x) => x?.secondary_color?.image_url || null;

                  const sizeKey = (x) => (x?.length_mm ? String(Number(x.length_mm)) : "");
                  const colorKey = (x) => {
                    const p = getPrimaryLabel(x);
                    const s = getSecondaryLabel(x);
                    return `${p}||${s}`;
                  };

                  const uniqueSizes = new Set(variantItems.map(sizeKey).filter(Boolean));
                  const uniqueColors = new Set(variantItems.map(colorKey));
                  const sizesVary = uniqueSizes.size > 1;
                  const colorsVary = uniqueColors.size > 1;

                  const selectedSizeKey = sizeKey(item);
                  const selectedColorKey = colorKey(item);

                  // Если что-то не варьируется — показываем только отличия по варьируемому атрибуту.
                  // Если варьируется и размер и цвет — показываем все.
                  const filtered = variantItems.filter((v) => {
                    if (sizesVary && !colorsVary) {
                      return sizeKey(v) !== selectedSizeKey;
                    }
                    if (!sizesVary && colorsVary) {
                      return colorKey(v) !== selectedColorKey;
                    }
                    return true;
                  });

                  // Чтобы не получилось пусто (например если все одинаковые) — fallback на полный список.
                  const list = filtered.length ? filtered : variantItems;

                  return list.map((v) => {
                  const isActive = String(v.id) === String(item.id);
                  const vImg = Array.isArray(v.images) && v.images[0]?.url ? v.images[0].url : (v.preview_url || v.image_url);

                  const primaryLabel = getPrimaryLabel(v);
                  const secondaryLabel = getSecondaryLabel(v);
                  const colorLabel = [primaryLabel, secondaryLabel].filter(Boolean).join(" + ");
                  const sizeLabel = v.length_mm ? String(v.length_mm) : "";

                  const showSize = sizesVary && sizeKey(v) !== selectedSizeKey;
                  const showColor = colorsVary && colorKey(v) !== selectedColorKey;

                  const pUrl = getPrimarySampleUrl(v);
                  const sUrl = getSecondarySampleUrl(v);
                  const pBg = pUrl ? `url(${resolveThumb(pUrl, { w: 64, h: 64, q: 70, fit: "inside" })})` : "none";
                  const sBg = sUrl ? `url(${resolveThumb(sUrl, { w: 64, h: 64, q: 70, fit: "inside" })})` : "none";
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        if (isActive) return;
                        setVariantsModalOpen(false);
                        navigate(`/catalog/${v.id}`);
                      }}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${isActive ? "border-accent bg-accent/5" : "border-night-200 hover:border-night-300"}`}
                    >
                      <div className="relative w-14 h-16 rounded-lg bg-night-50 overflow-hidden border border-night-200 flex-shrink-0">
                        <div className="absolute left-1 top-1 w-4 h-4 rounded-full border border-white shadow overflow-hidden" aria-hidden>
                          <div
                            className="absolute inset-y-0 left-0 w-1/2"
                            style={
                              pBg === "none"
                                ? { backgroundColor: "#e5e7eb" }
                                : { backgroundImage: pBg, backgroundSize: "cover", backgroundPosition: "center" }
                            }
                          />
                          <div
                            className="absolute inset-y-0 right-0 w-1/2"
                            style={
                              sBg === "none"
                                ? { backgroundColor: "#e5e7eb" }
                                : { backgroundImage: sBg, backgroundSize: "cover", backgroundPosition: "center" }
                            }
                          />
                        </div>
                        {vImg ? (
                          <img src={resolveThumb(vImg, { w: 280, h: 320, q: 70, fit: "inside" })} alt={v.name} className="w-full h-full object-contain" loading="lazy" decoding="async" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-night-900 truncate">
                          {primaryLabel || "—"}
                        </div>
                        {secondaryLabel ? (
                          <div className="text-xs text-night-500 truncate">{secondaryLabel}</div>
                        ) : null}
                      </div>
                    </button>
                  );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card p-4 sm:p-8 mb-8 sm:mb-12">
        <h3 className="font-bold text-night-900 mb-3 sm:mb-4 text-lg sm:text-2xl">Описание</h3>
        <div className="text-night-700 leading-relaxed text-base sm:text-lg whitespace-pre-line">
          {item.short_desc || moduleDescription?.description || "Описание не указано"}
        </div>
      </div>

      {fullCharacteristics.length > 0 && (
        <div className="glass-card p-4 sm:p-8 mb-8 sm:mb-12">
          <h3 className="font-bold text-night-900 mb-3 sm:mb-6 text-lg sm:text-2xl">Характеристики</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {fullCharacteristics.map((row) => (
              <div key={row.label} className="rounded-xl border border-night-100 bg-white/60 p-4">
                <div className="text-xs font-semibold text-night-500 uppercase tracking-wide">{row.label}</div>
                <div className="mt-1 text-night-900 font-semibold break-words">{row.value || "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ✅ СОСТАВ ГОТОВОГО РЕШЕНИЯ (только для kit) */}
      {isKit && compositionSections.length > 0 && (
        <div className="glass-card p-4 sm:p-8 mb-8 sm:mb-12">
          <h3 className="font-bold text-night-900 mb-4 sm:mb-6 text-lg sm:text-2xl">Состав готового решения</h3>
          <div className="space-y-6">
            {compositionSections.map(({ title, items }) => (
              <div key={title} className="space-y-3">
                <h4 className="text-sm sm:text-lg font-semibold text-night-900 uppercase tracking-wide border-b border-night-200 pb-2">
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
                            src={resolveThumb(module.preview_url, { w: 800, h: 600, q: 70, fit: "inside" })}
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
      {canShowSimilar && (
        <div className="glass-card p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
            <h3 className="font-bold text-night-900 text-base sm:text-xl">Похожие товары</h3>
            <SecureButton
              variant="outline"
              onClick={handleFindSimilar}
              className="text-xs sm:text-sm px-3 py-2 w-full sm:w-auto"
            >
              Показать больше
            </SecureButton>
          </div>
          {similarLoading ? (
            <div className="text-night-500 text-center py-12">Загружаем похожие товары...</div>
          ) : similarItems.length === 0 ? (
            <div className="text-night-500 text-center py-12">Похожие товары не найдены</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4 auto-rows-fr">
              {similarItems.map(product => (
                <ProductCard key={product.id} product={product} onAdd={addItem} compact />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductPage;
