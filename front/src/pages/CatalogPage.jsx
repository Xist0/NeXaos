import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import useApi from "../hooks/useApi";
import useCart from "../hooks/useCart";
import SecureInput from "../components/ui/SecureInput";
import SecureButton from "../components/ui/SecureButton";
import ProductCard from "../components/ui/ProductCard";

const CatalogPage = () => {
  const { get } = useApi();
  const { addItem } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("search") || "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [items, setItems] = useState([]);
  const [kitSolutions, setKitSolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFiltersOpen, setFiltersOpen] = useState(false);

  const [activeCategory, setActiveCategory] = useState(() => searchParams.get("category") || "all");
  const [activeSubCategory, setActiveSubCategory] = useState(() => searchParams.get("subCategory") || null);

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
    setSearchParams(params, { replace: true });
  }, [debouncedQuery, activeCategory, activeSubCategory, debouncedFilters, setSearchParams]);

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
        const queryParams = { search: debouncedQuery, ...debouncedFilters };
        if (activeCategory === "kitSolutions") {
          const res = await get("/kit-solutions", queryParams);
          if (active) {
            setKitSolutions((res?.data || []).map(k => ({...k, __type: "kitSolution"})));
            setItems([]);
          }
        } else if (activeCategory === "all") {
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
  }, [debouncedQuery, debouncedFilters, activeCategory, activeSubCategory, moduleCategories, get]);

  const bottomSubCategories = useMemo(() => activeCategory !== "bottom" ? [] : [{ code: "НМР1", label: "Одностворчатые" }, { code: "НМР2", label: "Двустворчатые" }, { code: "НМР.М1", label: "Под мойку" }, { code: "НМЯ.М1", label: "С ящиком под мойку" }, { code: "НМЯ.2", label: "С 2 ящиками" }, { code: "НМЯ.3", label: "С 3 ящиками" }], [activeCategory]);
  const topSubCategories = useMemo(() => activeCategory !== "top" ? [] : [{ code: "ВМР1", label: "Одностворчатые" }, { code: "ВМР2", label: "Двустворчатые" }, { code: "ВМВ1", label: "Выдвижные" }], [activeCategory]);

  const displayItems = useMemo(() => (activeCategory === "kitSolutions" ? kitSolutions : activeCategory === "all" ? [...kitSolutions, ...items] : items).filter(item => item.is_active), [activeCategory, kitSolutions, items]);
  const handleAddToCart = useCallback((product) => addItem(product), [addItem]);

  const SidebarContent = () => (
    <aside className="space-y-4 md:space-y-6">
      <FilterGroup title="Категории">
        <CategoryLink code="all" label="Все" active={activeCategory} setCategory={setActiveCategory} setSubCategory={setActiveSubCategory} />
        <CategoryLink code="kitSolutions" label="Готовые решения" active={activeCategory} setCategory={setActiveCategory} setSubCategory={setActiveSubCategory} />
        <CategoryLink code="bottom" label="Нижние модули" subs={bottomSubCategories} active={activeCategory} setCategory={setActiveCategory} subActive={activeSubCategory} setSubCategory={setActiveSubCategory} />
        <CategoryLink code="top" label="Верхние модули" subs={topSubCategories} active={activeCategory} setCategory={setActiveCategory} subActive={activeSubCategory} setSubCategory={setActiveSubCategory} />
        <CategoryLink code="tall" label="Пеналы" active={activeCategory} setCategory={setActiveCategory} setSubCategory={setActiveSubCategory} />
        <CategoryLink code="filler" label="Доборные элементы" active={activeCategory} setCategory={setActiveCategory} setSubCategory={setActiveSubCategory} />
        <CategoryLink code="accessory" label="Аксессуары" active={activeCategory} setCategory={setActiveCategory} setSubCategory={setActiveSubCategory} />
      </FilterGroup>
      <FilterGroup title="Фильтры" onReset={() => setFilters({ facadeColor: "", corpusColor: "", priceFrom: "", priceTo: "", lengthFrom: "", lengthTo: "" })}>
        <FilterSection title="Цвета">
          <SecureInput value={filters.facadeColor} onChange={(v) => setFilters(f => ({ ...f, facadeColor: v }))} placeholder="Цвет фасада" />
          <SecureInput value={filters.corpusColor} onChange={(v) => setFilters(f => ({ ...f, corpusColor: v }))} placeholder="Цвет корпуса" />
        </FilterSection>
        <FilterSection title="Цена">
          <div className="grid grid-cols-2 gap-3">
            <SecureInput type="number" value={filters.priceFrom} onChange={(v) => setFilters(f => ({ ...f, priceFrom: v }))} placeholder="От" />
            <SecureInput type="number" value={filters.priceTo} onChange={(v) => setFilters(f => ({ ...f, priceTo: v }))} placeholder="До" />
          </div>
        </FilterSection>
        <FilterSection title="Размер (мм)">
          <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
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

const CategoryLink = ({ code, label, subs = [], active, setCategory, subActive, setSubCategory }) => {
  const isActive = active === code;
  return (
    <div>
      <button onClick={() => { setCategory(code); setSubCategory(null); }} className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition ${isActive ? "bg-night-100 text-night-900" : "text-night-600 hover:bg-night-100/50"}`}>
        {label}
      </button>
      {isActive && subs.length > 0 && (
        <div className="pl-4 mt-2 space-y-1 border-l-2 border-night-200 ml-3">
          {subs.map((sub) => (
            <button key={sub.code} onClick={() => setSubCategory(sub.code)} className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition ${subActive === sub.code ? "bg-accent/20 text-accent-dark font-semibold" : "text-night-500 hover:bg-night-100/50"}`}>
              {sub.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CatalogPage;
