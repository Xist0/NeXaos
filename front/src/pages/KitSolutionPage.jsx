import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import useApi from "../hooks/useApi";
import useCart from "../hooks/useCart";
import SecureButton from "../components/ui/SecureButton";
import ProductCard from "../components/ui/ProductCard";
import { formatCurrency } from "../utils/format";
import ColorBadge from "../components/ui/ColorBadge";
import FavoriteButton from "../components/ui/FavoriteButton";
import useLogger from "../hooks/useLogger";
import { getImageUrl, placeholderImage } from "../utils/image";
import ProductGallery from "../components/ui/ProductGallery";
import { resolveColor } from "../utils/colors";

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

  const sizeRowRef = useRef(null);
  const colorRowRef = useRef(null);
  const [sizeRowScroll, setSizeRowScroll] = useState({ canLeft: false, canRight: false, hasOverflow: false });
  const [colorRowScroll, setColorRowScroll] = useState({ canLeft: false, canRight: false, hasOverflow: false });
  const [variantsModalOpen, setVariantsModalOpen] = useState(false);

  const similarRequestRef = useRef({ inFlight: false, lastForId: null });

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

  const renderColorCircle = useCallback(
    (primary, secondary) => {
      const pLabel = typeof primary === "string" ? primary : (primary?.name || "");
      const sLabel = typeof secondary === "string" ? secondary : (secondary?.name || "");
      const pHex = resolveColor(pLabel)?.hex || null;
      const sHex = resolveColor(sLabel)?.hex || null;

      const primaryUrl = typeof primary === "string" ? null : (primary?.image_url || null);
      const secondaryUrl = typeof secondary === "string" ? null : (secondary?.image_url || null);
      const pImg = primaryUrl ? getImageUrl(primaryUrl) : null;
      const sImg = secondaryUrl ? getImageUrl(secondaryUrl) : null;

      const pFill = pHex || "#e5e7eb";
      const sFill = sHex || "#e5e7eb";
      return (
        <div className="w-14 h-14 rounded-full border border-night-200 bg-white overflow-hidden flex-shrink-0">
          <div className="w-full h-full flex">
            <div
              className="h-full w-1/2"
              style={
                pImg
                  ? { backgroundImage: `url(${pImg})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : { backgroundColor: pFill }
              }
            />
            <div
              className="h-full w-1/2"
              style={
                sImg
                  ? { backgroundImage: `url(${sImg})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : { backgroundColor: sFill }
              }
            />
          </div>
        </div>
      );
    },
    []
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
  }, [updateRowScrollState, kit?.id, similarItems.length]);

  const handleAddToCart = () => {
    if (!kit) return;
    addItem({ ...kit, __type: "kitSolution" }, 1);
  };

  const handleFindSimilar = useCallback(() => {
    if (!kit?.id) return;
    const params = new URLSearchParams({ fromProduct: "1", similarKitId: String(kit.id), category: "kitSolutions" });
    if (kit.primary_color_id) params.set("colorId", String(kit.primary_color_id));
    navigate(`/catalog?${params.toString()}`);
  }, [kit?.id, kit?.primary_color_id, navigate]);

  const isKitchen = /^\s*(кух|kitchen)/i.test(String(kit?.category_group || "").trim());
  const modulesByType = kit?.modules || {};
  const kitComponents = Array.isArray(kit?.components) ? kit.components : [];

  const kitchenSectionsConfig = useMemo(
    () => [
      { key: "bottom", title: "Нижние модули" },
      { key: "top", title: "Верхние модули" },
      { key: "tall", title: "Пеналы" },
      { key: "filler", title: "Доборные элементы" },
      { key: "accessory", title: "Аксессуары" },
    ],
    []
  );

  const fallbackKitchenModulesByType = useMemo(() => {
    const grouped = { bottom: [], top: [], tall: [], filler: [], accessory: [] };
    const list = kitComponents.filter((x) => x?.__type === "module" && x?.id);
    for (const m of list) {
      const key = String(m.positionType || m.categoryCode || "bottom");
      if (!grouped[key]) grouped.bottom.push(m);
      else grouped[key].push(m);
    }
    return grouped;
  }, [kitComponents]);

  const compositionSections = useMemo(() => (
    isKitchen
      ? kitchenSectionsConfig
          .map(({ key, title }) => {
            const primary = Array.isArray(modulesByType[key]) ? modulesByType[key] : [];
            const fallback = Array.isArray(fallbackKitchenModulesByType[key]) ? fallbackKitchenModulesByType[key] : [];
            const items = primary.length > 0 ? primary : fallback;
            return { title, items };
          })
          .filter((section) => section.items.length > 0)
      : kitComponents.length > 0
        ? [{ title: "Компоненты", items: kitComponents }]
        : []
  ), [fallbackKitchenModulesByType, isKitchen, kitchenSectionsConfig, kitComponents, modulesByType]);

  const loadSimilar = useCallback(async () => {
    if (!id) return;
    if (similarRequestRef.current.inFlight) return;
    if (similarRequestRef.current.lastForId === id && similarItems.length > 0) return;

    similarRequestRef.current.inFlight = true;
    similarRequestRef.current.lastForId = id;
    setSimilarLoading(true);
    try {
      const res = await postRef.current(`/kit-solutions/${id}/similar`, { limit: 12 });
      const list = Array.isArray(res?.data) ? res.data : [];
      const filtered = list.filter((x) => x.id !== Number(id) && x.is_active).slice(0, 12);
      setSimilarItems(filtered);
    } catch (e) {
      loggerRef.current?.error("Не удалось загрузить похожие готовые решения", e);
      setSimilarItems([]);
      similarRequestRef.current.lastForId = null;
    } finally {
      similarRequestRef.current.inFlight = false;
      setSimilarLoading(false);
    }
  }, [id, similarItems.length]);

  const variantItems = useMemo(() => {
    const list = [kit, ...(Array.isArray(similarItems) ? similarItems : [])].filter(Boolean);
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
  }, [kit, similarItems]);

  useEffect(() => {
    if (!id) return;
    loadSimilar();
  }, [id, loadSimilar]);

  const primaryColorData = useMemo(() => {
    if (!kit?.primary_color_name) return null;
    return { name: kit.primary_color_name, image_url: kit.primary_color_image };
  }, [kit?.primary_color_name, kit?.primary_color_image]);

  const secondaryColorData = useMemo(() => {
    if (!kit?.secondary_color_name) return null;
    return { name: kit.secondary_color_name, image_url: kit.secondary_color_image };
  }, [kit?.secondary_color_name, kit?.secondary_color_image]);

  const fullCharacteristics = useMemo(() => {
    const list = [];
    if (!kit) return list;

    if (kit.sku) list.push({ label: "Артикул", value: String(kit.sku) });
    if (kit.category_group || kit.category) {
      const left = String(kit.category_group || "").trim();
      const right = String(kit.category || "").trim();
      list.push({
        label: "Категория",
        value: [left, right].filter(Boolean).join(" / "),
      });
    }

    if (kit.primary_color_name) list.push({ label: "Цвет (основной)", value: String(kit.primary_color_name) });
    if (kit.secondary_color_name) list.push({ label: "Цвет (доп.)", value: String(kit.secondary_color_name) });

    if (kit.total_length_mm) list.push({ label: "Длина", value: `${kit.total_length_mm} мм` });
    if (kit.total_depth_mm) list.push({ label: "Глубина", value: `${kit.total_depth_mm} мм` });
    if (kit.total_height_mm) list.push({ label: "Высота", value: `${kit.total_height_mm} мм` });

    const params = Array.isArray(kit.parameters) ? kit.parameters : [];
    if (params.length > 0) {
      const label = params
        .map((p) => {
          const name = String(p?.name || "").trim();
          const qty = Number(p?.quantity);
          if (!name) return null;
          if (Number.isFinite(qty) && qty > 1) return `${name} ×${qty}`;
          return name;
        })
        .filter(Boolean)
        .join(", ");
      if (label) list.push({ label: "Параметры", value: label });
    }

    const cats = Array.isArray(kit.parameterCategories) ? kit.parameterCategories : [];
    if (cats.length > 0) {
      const normalized = cats
        .map((c) => ({ id: Number(c?.id), name: String(c?.name || "").trim() }))
        .filter((c) => Number.isFinite(c.id) && c.id > 0 && Boolean(c.name));
      if (normalized.length > 0) {
        list.push({ label: "Категории параметров", type: "parameterCategories", categories: normalized });
      }
    }

    return list;
  }, [kit]);

  if (loading) {
    return <div className="shop-container py-12"><div className="glass-card p-6 text-night-500">Загружаем...</div></div>;
  }

  if (!kit) {
    return <div className="shop-container py-12"><div className="glass-card p-6 text-night-500">Не найдено</div></div>;
  }

  return (
    <div className="shop-container py-8">
      <nav className="text-sm text-night-500 mb-6">
        <Link to="/catalog" className="hover:text-accent transition">Каталог</Link>
        <span className="text-night-900 mx-2">/</span>
        <span className="font-medium">{kit.name}</span>
      </nav>

      <div className="grid gap-8 lg:gap-10 lg:grid-cols-[540px_minmax(0,1fr)_320px] lg:items-start mb-8 sm:mb-12">
        <ProductGallery
          title={kit.name}
          images={images}
          selectedIndex={selectedImageIndex}
          onSelect={setSelectedImageIndex}
          onOpenSimilar={handleFindSimilar}
          showSimilarButton
          isNew={false}
          getImageUrl={getImageUrl}
          className="lg:self-start"
        />

        {/* Центр: варианты + характеристики */}
        <div className="space-y-4 sm:space-y-6 lg:pt-0 lg:self-start min-w-0">
          {variantItems.length > 1 && (
            <div>
              {(() => {
                const selectedSize = kit?.total_length_mm ? Number(kit.total_length_mm) : null;
                const selectedColor = kit?.primary_color_name || kit?.primary_color?.name || "";
                const selectedPrimaryId = kit?.primary_color?.id ?? kit?.primary_color_id ?? null;
                const selectedSecondaryId = kit?.secondary_color?.id ?? kit?.secondary_color_id ?? null;
                const selectedColorKey = selectedPrimaryId || selectedSecondaryId
                  ? `${String(selectedPrimaryId ?? "")}||${String(selectedSecondaryId ?? "")}`
                  : selectedColor;

                const sizes = Array.from(
                  new Set(
                    variantItems
                      .map((v) => (v.total_length_mm ? Number(v.total_length_mm) : null))
                      .filter((x) => x !== null)
                  )
                ).sort((a, b) => a - b);

                const colors = Array.from(
                  new Map(
                    variantItems.map((v) => {
                      const label = v.primary_color_name || v.primary_color?.name || "";
                      const imgUrl = Array.isArray(v.images) && v.images[0]?.url ? v.images[0].url : (v.preview_url || v.image_url);
                      const pid = v?.primary_color?.id ?? v?.primary_color_id ?? null;
                      const sid = v?.secondary_color?.id ?? v?.secondary_color_id ?? null;
                      const key = pid || sid ? `${String(pid ?? "")}||${String(sid ?? "")}` : (label || String(v.id));
                      return [key, { key, label, imgUrl, sample: v }];
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
                                const candidates = variantItems.filter((v) => Number(v.total_length_mm) === Number(len));
                                const next =
                                  candidates.find((v) => (v.primary_color_name || v.primary_color?.name || "") === currentColor) ||
                                  candidates[0];
                                if (!next || String(next.id) === String(kit.id)) return;
                                scrollToCenterSmooth(sizeRowRef.current, e.currentTarget);
                                navigate(`/catalog/kit/${next.id}`);
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
                        Выбран цвет: <span className="text-night-900 font-medium">{selectedColor || "—"}</span>
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
                        {colors.map(({ key, label, imgUrl, sample }) => {
                          const isActive = key === selectedColorKey;
                          const safeLabel = encodeURIComponent(label || String(sample?.id || ""));
                          const pColor = sample?.primary_color || (sample?.primary_color_name ? { name: sample.primary_color_name, image_url: sample.primary_color_image } : null);
                          const sColor = sample?.secondary_color || (sample?.secondary_color_name ? { name: sample.secondary_color_name, image_url: sample.secondary_color_image } : null);
                          return (
                            <button
                              key={key}
                              type="button"
                              data-color={safeLabel}
                              onClick={(e) => {
                                const currentLen = selectedSize !== null ? Number(selectedSize) : null;
                                const candidates = currentLen
                                  ? variantItems.filter((x) => Number(x.total_length_mm) === Number(currentLen))
                                  : variantItems;
                                const match = (x) => {
                                  const xpid = x?.primary_color?.id ?? x?.primary_color_id ?? null;
                                  const xsid = x?.secondary_color?.id ?? x?.secondary_color_id ?? null;
                                  const xkey = xpid || xsid ? `${String(xpid ?? "")}||${String(xsid ?? "")}` : (x.primary_color_name || x.primary_color?.name || "");
                                  return xkey === key;
                                };
                                const next = candidates.find(match) || variantItems.find(match) || sample;
                                if (!next || String(next.id) === String(kit.id)) return;
                                scrollToCenterSmooth(colorRowRef.current, e.currentTarget);
                                navigate(`/catalog/kit/${next.id}`);
                              }}
                              className={`snap-center flex-shrink-0 rounded-full border bg-white transition flex items-center justify-center ${
                                isActive ? "border-accent ring-2 ring-accent/40" : "border-night-200 hover:border-night-300"
                              }`}
                              aria-label={label || "Цвет"}
                              title={label || ""}
                            >
                              {renderColorCircle(pColor, sColor)}
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

          {(kit.total_length_mm || kit.total_depth_mm || kit.total_height_mm || kit.primary_color_name || kit.secondary_color_name) && (
            <div className="glass-card p-4">
              <div className="space-y-4">
                {(kit.primary_color_name || kit.secondary_color_name) && (
                  <div>
                    <div className="text-xs font-semibold text-night-500 uppercase tracking-wide mb-2">Цвета</div>
                    <div className="space-y-2">
                      {primaryColorData && (
                        <div className="grid grid-cols-[88px_1fr] items-center gap-3">
                          <span className="text-night-500 text-sm">Основной:</span>
                          <ColorBadge colorData={primaryColorData} />
                        </div>
                      )}
                      {secondaryColorData && (
                        <div className="grid grid-cols-[88px_1fr] items-center gap-3">
                          <span className="text-night-500 text-sm">Доп.:</span>
                          <ColorBadge colorData={secondaryColorData} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(kit.total_length_mm || kit.total_depth_mm || kit.total_height_mm) && (
                  <div className={kit.primary_color_name || kit.secondary_color_name ? "border-t border-night-200 pt-4" : ""}>
                    <div className="text-xs font-semibold text-night-500 uppercase tracking-wide mb-2">Габариты</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <span className="text-night-500 text-xs block mb-1">Длина</span>
                        <span className="font-semibold text-night-900">{kit.total_length_mm || "—"}</span>
                      </div>
                      <div>
                        <span className="text-night-500 text-xs block mb-1">Глубина</span>
                        <span className="font-semibold text-night-900">{kit.total_depth_mm || "—"}</span>
                      </div>
                      <div>
                        <span className="text-night-500 text-xs block mb-1">Высота</span>
                        <span className="font-semibold text-night-900">{kit.total_height_mm || "—"}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Право: название + цена + действия */}
        <div className="glass-card p-5 sm:p-6 space-y-4 lg:self-start min-w-0 overflow-hidden">
          <div className="space-y-2 pt-1">
            <h1 className="text-xl sm:text-2xl font-bold text-night-900 leading-tight break-words">{kit.name}</h1>
          </div>

          <div>
            <span className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-accent to-accent-dark bg-clip-text text-transparent">
              {formatCurrency(kit.final_price || 0)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <FavoriteButton
              product={{ ...kit, __type: 'kitSolution' }}
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
                {variantItems.map((v) => {
                  const isActive = String(v.id) === String(kit.id);
                  const primaryColorLabel = v.primary_color_name || v.primary_color?.name || "";
                  const sizeLabel = v.total_length_mm ? String(v.total_length_mm) : "";
                  const pColor = v?.primary_color || (v?.primary_color_name ? { name: v.primary_color_name, image_url: v.primary_color_image } : null);
                  const sColor = v?.secondary_color || (v?.secondary_color_name ? { name: v.secondary_color_name, image_url: v.secondary_color_image } : null);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        if (isActive) return;
                        setVariantsModalOpen(false);
                        navigate(`/catalog/kit/${v.id}`);
                      }}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${isActive ? "border-accent bg-accent/5" : "border-night-200 hover:border-night-300"}`}
                    >
                      <div className="w-20 flex items-center justify-center flex-shrink-0">{renderColorCircle(pColor, sColor)}</div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-night-900 truncate">{sizeLabel ? `${sizeLabel} мм` : v.sku || v.name}</div>
                        <div className="text-xs text-night-500 truncate">{primaryColorLabel || ""}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card p-4 sm:p-8 mb-8 sm:mb-12">
        <h3 className="font-bold text-night-900 mb-3 sm:mb-4 text-lg sm:text-2xl">Описание</h3>
        <div className="text-night-700 leading-relaxed text-base sm:text-lg whitespace-pre-line">
          {kit.description || "Описание не указано"}
        </div>
      </div>

      {fullCharacteristics.length > 0 && (
        <div className="glass-card p-4 sm:p-8 mb-8 sm:mb-12">
          <h3 className="font-bold text-night-900 mb-3 sm:mb-6 text-lg sm:text-2xl">Характеристики</h3>
          {(() => {
            const leftRows = fullCharacteristics.filter((r) => r?.type !== "parameterCategories" && r?.label !== "Параметры");
            const rightRows = fullCharacteristics.filter((r) => r?.type === "parameterCategories" || r?.label === "Параметры");

            const renderRow = (row) => (
              <div key={row.label} className="grid grid-cols-[160px_1fr] gap-3 min-w-0">
                <span className="text-night-500 truncate">{row.label}:</span>
                {row?.type === "parameterCategories" ? (
                  <span className="font-semibold text-night-900 min-w-0">
                    <span className="flex flex-wrap gap-x-2 gap-y-1">
                      {(Array.isArray(row.categories) ? row.categories : []).map((c) => (
                        <Link
                          key={c.id}
                          to={`/catalog?parameterCategoryIds=${encodeURIComponent(String(c.id))}`}
                          className="text-accent underline underline-offset-2 hover:opacity-90"
                        >
                          {c.name}
                        </Link>
                      ))}
                    </span>
                  </span>
                ) : (
                  <span className="font-semibold text-night-900 break-words min-w-0">{row.value || "—"}</span>
                )}
              </div>
            );

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4 text-sm text-night-800 leading-relaxed">
                <div className="space-y-2">
                  {leftRows.map(renderRow)}
                </div>
                <div className="space-y-2">
                  {rightRows.map(renderRow)}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div className="space-y-6 mb-12">
        {compositionSections.length > 0 ? (
          <div className="glass-card p-4 sm:p-8 space-y-6">
            <h3 className="font-bold text-night-900 text-base sm:text-lg">Компоненты</h3>
            {compositionSections.map(({ title, items }) => (
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
            ))}
          </div>
        ) : null}

        <div className="glass-card p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
            <h3 className="font-bold text-night-900 text-base sm:text-xl">Похожие</h3>
            <SecureButton
              variant="outline"
              onClick={handleFindSimilar}
              className="text-xs sm:text-sm px-3 py-2 w-full sm:w-auto"
            >
              Показать больше
            </SecureButton>
          </div>

          {similarLoading ? (
            <div className="text-night-500 text-center py-12">Загружаем похожие...</div>
          ) : similarItems.length === 0 ? (
            <div className="text-night-500 text-center py-12">Похожие не найдены</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4 auto-rows-fr">
              {similarItems.map((product) => (
                <ProductCard key={product.id} product={{ ...product, __type: "kitSolution" }} onAdd={(item) => addItem(item, 1)} compact />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KitSolutionPage;
