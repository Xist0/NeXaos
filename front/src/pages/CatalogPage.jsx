import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import useApi from "../hooks/useApi";
import useCart from "../hooks/useCart";
import SecureInput from "../components/ui/SecureInput";
import SecureButton from "../components/ui/SecureButton";
import ProductCard from "../components/ui/ProductCard";

const CatalogPage = () => {
  const { get, post } = useApi();
  const { addItem } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("search") || "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [items, setItems] = useState([]);
  const [kitSolutions, setKitSolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFiltersOpen, setFiltersOpen] = useState(false);

  const [expandedRoom, setExpandedRoom] = useState(() => searchParams.get("category") || "all");
  const [isKitchenModulesOpen, setKitchenModulesOpen] = useState(false);

  const [activeCategory, setActiveCategory] = useState(() => searchParams.get("category") || "all");
  const [activeSubCategory, setActiveSubCategory] = useState(() => searchParams.get("subCategory") || null);

  const [similarModuleId, setSimilarModuleId] = useState(() => searchParams.get("similarModuleId") || null);
  const [similarKitId, setSimilarKitId] = useState(() => searchParams.get("similarKitId") || null);
  const [fromProduct, setFromProduct] = useState(() => searchParams.get("fromProduct") === "1");
  const [similarItems, setSimilarItems] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  const [similarKitItems, setSimilarKitItems] = useState([]);
  const [similarKitLoading, setSimilarKitLoading] = useState(false);

  const [filters, setFilters] = useState(() => ({
    facadeColor: searchParams.get("facadeColor") || "",
    corpusColor: searchParams.get("corpusColor") || "",
    priceFrom: searchParams.get("priceFrom") || "",
    priceTo: searchParams.get("priceTo") || "",
    lengthFrom: searchParams.get("lengthFrom") || "",
    lengthTo: searchParams.get("lengthTo") || "",
  }));
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [moduleCategories, setModuleCategories] = useState([]);

  const roomCatalog = useMemo(
    () => (
      [
        {
          code: "hallway",
          label: "Прихожая",
          group: "Прихожая",
          subs: [
            { code: "Готовые прихожие", label: "Готовые прихожие" },
            { code: "Шкафы", label: "Шкафы" },
            { code: "Обувницы", label: "Обувницы" },
            { code: "Комоды", label: "Комоды" },
            { code: "Тумбы подвесные", label: "Тумбы подвесные" },
            { code: "Рейки", label: "Рейки" },
            { code: "Верхние шкафы", label: "Верхние шкафы" },
            { code: "Аксессуары для прихожей", label: "Аксессуары для прихожей" },
            { code: "Доборные элементы", label: "Доборные элементы" },
          ],
        },
        {
          code: "livingroom",
          label: "Гостиная",
          group: "Гостиная",
          subs: [
            { code: "Стенки для гостиной", label: "Стенки для гостиной" },
            { code: "ТВ зоны", label: "ТВ зоны" },
            { code: "Шкафы", label: "Шкафы" },
            { code: "Стеллажи", label: "Стеллажи" },
            { code: "Комоды", label: "Комоды" },
            { code: "Настенные полки", label: "Настенные полки" },
            { code: "Журнальные столики", label: "Журнальные столики" },
          ],
        },
        {
          code: "kitchen",
          label: "Кухня",
          group: "Кухня",
          subs: [
            { code: "__kitchen_kits", label: "Готовые решения", isKits: true },
            { code: "__modules", label: "Модули", isModulesToggle: true },
            { code: "Нижние модули", label: "Нижние модули", targetCategory: "bottom", isModuleItem: true },
            { code: "Верхние модули", label: "Верхние модули", targetCategory: "top", isModuleItem: true },
            { code: "Антресольные модули", label: "Антресольные модули", targetCategory: "top", isModuleItem: true },
            { code: "Пеналы", label: "Пеналы", targetCategory: "tall", isModuleItem: true },
            { code: "Столешницы", label: "Столешницы" },
            { code: "Доборные элементы", label: "Доборные элементы" },
            { code: "Аксессуары для кухни", label: "Аксессуары для кухни" },
          ],
        },
        {
          code: "bedroom",
          label: "Спальня",
          group: "Спальня",
          subs: [
            { code: "Комплект мебели для спальни", label: "Комплект мебели для спальни" },
            { code: "Кровати", label: "Кровати" },
            { code: "Туалетные столики", label: "Туалетные столики" },
            { code: "Прикроватные тумбы", label: "Прикроватные тумбы" },
          ],
        },
      ]
    ),
    []
  );
  const roomCategoryCodes = useMemo(() => new Set(roomCatalog.map((x) => x.code)), [roomCatalog]);

  const lastSimilarModuleIdRef = useRef(null);
  const lastSimilarKitIdRef = useRef(null);

  useEffect(() => {
    if (!isFiltersOpen) return;

    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    const onKeyDown = (e) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [isFiltersOpen]);

  useEffect(() => {
    // Если пользователь пришел по ссылке с параметрами (Похожие), синхронизируем локальный state
    setFromProduct(searchParams.get("fromProduct") === "1");
    setSimilarModuleId(searchParams.get("similarModuleId") || null);
    setSimilarKitId(searchParams.get("similarKitId") || null);

    const urlCategory = searchParams.get("category") || "all";
    const urlSubCategory = searchParams.get("subCategory") || null;
    // Legacy: раньше готовые решения были отдельной категорией.
    // Теперь это подкатегория внутри "Кухня".
    const normalizedCategory = urlCategory === "kitSolutions" ? "kitchen" : urlCategory;
    const normalizedSub = urlCategory === "kitSolutions" ? "__kitchen_kits" : urlSubCategory;
    if (normalizedCategory !== activeCategory) setActiveCategory(normalizedCategory);
    if (normalizedSub !== activeSubCategory) setActiveSubCategory(normalizedSub);

    const nextFilters = {
      facadeColor: searchParams.get("facadeColor") || "",
      corpusColor: searchParams.get("corpusColor") || "",
      priceFrom: searchParams.get("priceFrom") || "",
      priceTo: searchParams.get("priceTo") || "",
      lengthFrom: searchParams.get("lengthFrom") || "",
      lengthTo: searchParams.get("lengthTo") || "",
    };
    setFilters((prev) => {
      const prevJson = JSON.stringify(prev);
      const nextJson = JSON.stringify(nextFilters);
      return prevJson === nextJson ? prev : nextFilters;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilters(filters), 500);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("search", debouncedQuery);
    if (activeCategory !== "all") params.set("category", activeCategory);
    if (activeSubCategory) params.set("subCategory", activeSubCategory);
    Object.entries(debouncedFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    if (fromProduct) params.set("fromProduct", "1");
    if (similarModuleId) params.set("similarModuleId", String(similarModuleId));
    if (similarKitId) params.set("similarKitId", String(similarKitId));

    setSearchParams(params, { replace: true });
  }, [debouncedQuery, activeCategory, activeSubCategory, debouncedFilters, fromProduct, similarModuleId, similarKitId, setSearchParams]);

  useEffect(() => {
    // Не даем нескольким комнатам быть раскрытыми одновременно
    if (activeCategory === "all") return;
    if (roomCategoryCodes.has(activeCategory)) {
      setExpandedRoom(activeCategory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  useEffect(() => {
    const loadSimilarModules = async () => {
      if (!fromProduct || !similarModuleId) {
        setSimilarItems([]);
        return;
      }

      const parsed = Number(similarModuleId);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setSimilarItems([]);
        return;
      }

      if (lastSimilarModuleIdRef.current === parsed && similarItems.length > 0) return;
      lastSimilarModuleIdRef.current = parsed;

      setSimilarLoading(true);
      try {
        const res = await post(`/modules/${parsed}/similar`, { limit: 50 });
        const list = Array.isArray(res?.data) ? res.data : [];
        setSimilarItems(list.filter((x) => x?.is_active));
      } catch (e) {
        console.error("Ошибка загрузки похожих модулей:", e);
        setSimilarItems([]);
        lastSimilarModuleIdRef.current = null;
      } finally {
        setSimilarLoading(false);
      }
    };

    loadSimilarModules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromProduct, similarModuleId, post]);

  useEffect(() => {
    const loadSimilarKits = async () => {
      if (!fromProduct || !similarKitId) {
        setSimilarKitItems([]);
        return;
      }

      const parsed = Number(similarKitId);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setSimilarKitItems([]);
        return;
      }

      if (lastSimilarKitIdRef.current === parsed && similarKitItems.length > 0) return;
      lastSimilarKitIdRef.current = parsed;

      setSimilarKitLoading(true);
      try {
        const res = await post(`/kit-solutions/${parsed}/similar`, { limit: 50 });
        const list = Array.isArray(res?.data) ? res.data : [];
        setSimilarKitItems(list.filter((x) => x?.is_active).map((k) => ({ ...k, __type: "kitSolution" })));
      } catch (e) {
        console.error("Ошибка загрузки похожих готовых решений:", e);
        setSimilarKitItems([]);
        lastSimilarKitIdRef.current = null;
      } finally {
        setSimilarKitLoading(false);
      }
    };

    loadSimilarKits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromProduct, similarKitId, post]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [categoriesRes] = await Promise.all([get("/module-categories")]);
        setModuleCategories(categoriesRes?.data || []);
      } catch (error) {
        console.error("Ошибка загрузки категорий", error);
      }
    };
    loadInitialData();
  }, [get]);

  useEffect(() => {
    let active = true;
    const fetchItems = async () => {
      setLoading(true);
      try {
        const queryParams = { search: debouncedQuery, ...debouncedFilters, isActive: true };
        const colorId = searchParams.get("colorId");
        if (colorId) queryParams.colorId = colorId;

        if (roomCategoryCodes.has(activeCategory)) {
          const room = roomCatalog.find((x) => x.code === activeCategory);

          // Кухня: "Готовые решения" живут в /kit-solutions, но выбираются внутри кухни
          if (activeCategory === "kitchen" && activeSubCategory === "__kitchen_kits") {
            const res = await get("/kit-solutions", queryParams);
            if (active) {
              setKitSolutions((res?.data || []).map((k) => ({ ...k, __type: "kitSolution" })));
              setItems([]);
            }
            return;
          }

          const res = await get("/catalog-items", {
            search: debouncedQuery,
            categoryGroup: room?.group,
            category: activeSubCategory || undefined,
            isActive: true,
          });
          if (active) {
            setItems((res?.data || []).map((x) => ({ ...x, __type: "catalogItem" })));
            setKitSolutions([]);
          }
          return;
        }

        if (activeCategory === "all") {
          const [modulesRes, kitsRes] = await Promise.all([get("/modules", queryParams), get("/kit-solutions", queryParams)]);
          if (active) {
            setItems(modulesRes?.data || []);
            setKitSolutions((kitsRes?.data || []).map(k => ({...k, __type: "kitSolution"})));
          }
        } else {
          const category = moduleCategories.find((c) => c.code === activeCategory);
          if (category) queryParams.categoryId = category.id;
          if (activeSubCategory) queryParams.baseSku = activeSubCategory;
          const res = await get("/modules", queryParams);
          if (active) {
            setItems(res?.data || []);
            setKitSolutions([]);
          }
        }
      } catch (error) {
        console.error("Ошибка загрузки товаров:", error);
        setItems([]);
        setKitSolutions([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchItems();
    return () => { active = false; };
  }, [debouncedQuery, debouncedFilters, activeCategory, activeSubCategory, moduleCategories, get, searchParams, roomCatalog, roomCategoryCodes]);

  const bottomSubCategories = useMemo(() => activeCategory !== "bottom" ? [] : [{ code: "НМР1", label: "Одностворчатые" }, { code: "НМР2", label: "Двустворчатые" }, { code: "НМР.М1", label: "Под мойку" }, { code: "НМЯ.М1", label: "С ящиком под мойку" }, { code: "НМЯ.2", label: "С 2 ящиками" }, { code: "НМЯ.3", label: "С 3 ящиками" }], [activeCategory]);
  const topSubCategories = useMemo(() => activeCategory !== "top" ? [] : [{ code: "ВМР1", label: "Одностворчатые" }, { code: "ВМР2", label: "Двустворчатые" }, { code: "ВМВ1", label: "Выдвижные" }], [activeCategory]);

  const displayItems = useMemo(() => {
    const safeModules = items.filter((x) => x.is_active);
    const safeKits = kitSolutions.filter((x) => x.is_active);

    if (!fromProduct) {
      return activeCategory === "kitSolutions"
        ? safeKits
        : activeCategory === "all"
        ? [...safeKits, ...safeModules]
        : safeModules;
    }

    // 1) Режим похожих для kit
    if (similarKitId && (activeCategory === "kitSolutions" || activeCategory === "all")) {
      const kitBaseList = safeKits;
      const baseIds = new Set(kitBaseList.map((x) => x.id));
      const similarInScope = similarKitItems.filter((x) => baseIds.has(x.id));
      const similarIds = new Set(similarInScope.map((x) => x.id));
      const rest = kitBaseList.filter((x) => !similarIds.has(x.id));
      const kitsOrdered = [...similarInScope, ...rest];
      return activeCategory === "kitSolutions" ? kitsOrdered : [...kitsOrdered, ...safeModules];
    }

    // 2) Режим похожих для module
    if (similarModuleId && activeCategory !== "kitSolutions") {
      const baseList = activeCategory === "all" ? [...safeKits, ...safeModules] : safeModules;
      const baseIds = new Set(baseList.map((x) => x.id));
      const similarInScope = similarItems.filter((x) => baseIds.has(x.id));
      const similarIds = new Set(similarInScope.map((x) => x.id));
      const rest = baseList.filter((x) => !similarIds.has(x.id));
      return [...similarInScope, ...rest];
    }

    return activeCategory === "kitSolutions"
      ? safeKits
      : activeCategory === "all"
      ? [...safeKits, ...safeModules]
      : safeModules;
  }, [activeCategory, kitSolutions, items, fromProduct, similarModuleId, similarKitId, similarItems, similarKitItems]);
  const handleAddToCart = useCallback((product) => addItem(product), [addItem]);

  const SidebarContent = () => (
    <aside className="space-y-4 md:space-y-6">
      <FilterGroup title="Категории">
        <CategoryLink
          code="all"
          label="Все"
          active={activeCategory}
          setCategory={setActiveCategory}
          setSubCategory={setActiveSubCategory}
          expanded={expandedRoom === "all"}
          onToggle={() => {
            setExpandedRoom("all");
            setActiveCategory("all");
            setActiveSubCategory(null);
          }}
        />

        {roomCatalog.map((group) => (
          <CategoryLink
            key={group.code}
            code={group.code}
            label={group.label}
            subs={group.subs}
            active={activeCategory}
            setCategory={setActiveCategory}
            subActive={activeSubCategory}
            setSubCategory={setActiveSubCategory}
            expanded={expandedRoom === group.code}
            onToggle={() => {
              setExpandedRoom(group.code);
              setActiveCategory(group.code);
              setActiveSubCategory(null);
              if (group.code !== "kitchen") setKitchenModulesOpen(false);
            }}
            isKitchen={group.code === "kitchen"}
            isKitchenModulesOpen={isKitchenModulesOpen}
            onToggleKitchenModules={() => setKitchenModulesOpen((prev) => !prev)}
          />
        ))}
      </FilterGroup>
      <FilterGroup title="Фильтры" onReset={() => setFilters({ facadeColor: "", corpusColor: "", priceFrom: "", priceTo: "", lengthFrom: "", lengthTo: "" })}>
        <FilterSection title="Цвета">
          <SecureInput value={filters.facadeColor} onChange={(v) => setFilters(f => ({ ...f, facadeColor: v }))} placeholder="Цвет фасада" />
          <SecureInput value={filters.corpusColor} onChange={(v) => setFilters(f => ({ ...f, corpusColor: v }))} placeholder="Цвет корпуса" />
        </FilterSection>
        <FilterSection title="Цена">
          <div className="grid grid-cols-2 gap-2 px-1 w-full overflow-hidden">
            <SecureInput type="number" value={filters.priceFrom} onChange={(v) => setFilters(f => ({ ...f, priceFrom: v }))} placeholder="От" />
            <SecureInput type="number" value={filters.priceTo} onChange={(v) => setFilters(f => ({ ...f, priceTo: v }))} placeholder="До" />
          </div>
        </FilterSection>
        <FilterSection title="Размер (мм)">
          <div className="grid grid-cols-2 gap-2 px-1 w-full overflow-hidden">
            <SecureInput type="number" value={filters.lengthFrom} onChange={(v) => setFilters(f => ({ ...f, lengthFrom: v }))} placeholder="От" />
            <SecureInput type="number" value={filters.lengthTo} onChange={(v) => setFilters(f => ({ ...f, lengthTo: v }))} placeholder="До" />
          </div>
        </FilterSection>
      </FilterGroup>
    </aside>
  );

  return (
    <div className="shop-container py-8 md:py-12">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 md:mb-8">
        <div className="max-w-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-night-400">Каталог</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-night-900">Каталог мебели</h1>
        </div>
        <SecureInput value={query} onChange={setQuery} placeholder="Поиск по названию или артикулу" className="w-full sm:w-auto sm:min-w-[280px]" />
      </div>

      <div className="lg:hidden mb-6">
        <SecureButton onClick={() => setFiltersOpen(true)} className="w-full justify-center text-base py-3">Фильтры и категории</SecureButton>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr]">
        <div className="hidden lg:block"><SidebarContent /></div>
        <main className="min-w-0">
          {loading ? (
            <div className="glass-card p-6 text-center text-night-500">Загружаем товары...</div>
          ) : displayItems.length > 0 ? (
            <section>
              <h2 className="text-lg sm:text-xl font-semibold text-night-900 mb-4">{displayItems.length} позици{displayItems.length !== 1 ? "й" : "я"}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-1 md:gap-3">
                {displayItems.map((product) => <ProductCard key={product.id || product.sku} product={product} onAdd={handleAddToCart} />)}
              </div>
            </section>
          ) : (
            <div className="glass-card p-8 text-center text-night-500">Не найдено товаров, соответствующих вашему запросу. Попробуйте изменить фильтры.</div>
          )}
        </main>
      </div>

      <div className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity ${isFiltersOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={() => setFiltersOpen(false)}></div>
      <div className={`fixed top-0 left-0 h-full w-[320px] max-w-[85vw] bg-night-50/90 backdrop-blur-lg shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isFiltersOpen ? 'translate-x-0' : '-translate-x-full'} lg:hidden`}>
        <div className="p-4 h-full overflow-y-auto space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-xl font-bold">Фильтры</h2>
            <button onClick={() => setFiltersOpen(false)} className="text-2xl text-night-500 hover:text-night-900">&times;</button>
          </div>
          <SidebarContent />
        </div>
      </div>
    </div>
  );
};

const FilterGroup = ({ title, onReset, children }) => (
  <div className="glass-card p-4">
    <div className="flex items-center justify-between gap-4 px-1 mb-2">
      <h3 className="text-sm font-semibold text-night-900 uppercase tracking-wide">{title}</h3>
      {onReset && <button onClick={onReset} className="text-xs font-semibold text-night-400 hover:text-accent hover:underline">Сброс</button>}
    </div>
    <div className="mt-3 space-y-1">{children}</div>
  </div>
);

const FilterSection = ({ title, children }) => (
  <div className="pt-4 border-t border-night-100/80 first:border-t-0 first:pt-0">
    <div className="text-xs font-semibold text-night-500 uppercase tracking-wide px-1 mb-3">{title}</div>
    <div className="space-y-3 px-1">{children}</div>
  </div>
);

const CategoryLink = ({
  code,
  label,
  subs = [],
  active,
  setCategory,
  subActive,
  setSubCategory,
  expanded,
  onToggle,
  isKitchen,
  isKitchenModulesOpen,
  onToggleKitchenModules,
}) => {
  const isActive = active === code;
  return (
    <div>
      <button
        onClick={() => {
          onToggle?.();
          setCategory(code);
          setSubCategory(null);
        }}
        className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition ${isActive ? "bg-night-100 text-night-900" : "text-night-600 hover:bg-night-100/50"}`}
      >
        {label}
      </button>
      {expanded && subs.length > 0 && (
        <div className="pl-4 mt-2 space-y-1 border-l-2 border-night-200 ml-3 overflow-hidden">
          {subs
            .filter((sub) => {
              if (!isKitchen) return true;
              if (sub.isModuleItem) return Boolean(isKitchenModulesOpen);
              return true;
            })
            .map((sub) => (
              sub.isModulesToggle ? (
                <button
                  key={sub.code}
                  type="button"
                  onClick={() => onToggleKitchenModules?.()}
                  className="w-full text-left px-3 py-1.5 rounded-md text-xs font-semibold text-night-600 hover:bg-night-100/50 flex items-center justify-between"
                >
                  <span>{sub.label}</span>
                  <span className="text-night-400">{isKitchenModulesOpen ? "−" : "+"}</span>
                </button>
              ) : (
                <button
                  key={sub.code}
                  onClick={() => {
                    if (sub.isKits) {
                      setCategory(code);
                      setSubCategory(sub.code);
                      return;
                    }
                    if (sub.targetCategory) {
                      setCategory(sub.targetCategory);
                      setSubCategory(null);
                      return;
                    }
                    setSubCategory(sub.code);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition ${subActive === sub.code ? "bg-accent/20 text-accent-dark font-semibold" : "text-night-500 hover:bg-night-100/50"}`}
                >
                  {sub.label}
                </button>
              )
            ))}
        </div>
      )}
    </div>
  );
};

export default CatalogPage;
