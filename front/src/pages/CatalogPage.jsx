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
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState([]);
  const [kitSolutions, setKitSolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Проверяем, пришли ли мы со страницы товара
  const fromProduct = searchParams.get("fromProduct") === "1";
  const isInitialMount = useRef(true);
  const isFirstDebounce = useRef(true);
  
  // Инициализируем состояние с учетом того, пришли ли мы со страницы товара
  const [activeCategory, setActiveCategory] = useState(() => {
    if (!fromProduct) return "all";
    return searchParams.get("category") || "all";
  });
  const [activeSubCategory, setActiveSubCategory] = useState(() => {
    if (!fromProduct) return null;
    return searchParams.get("subCategory") || null;
  });
  
  // Инициализируем фильтры - сбрасываем если не пришли со страницы товара
  const [filters, setFilters] = useState(() => {
    if (!fromProduct) {
      return {
        facadeColor: "",
        corpusColor: "",
        priceFrom: "",
        priceTo: "",
        lengthFrom: "",
        lengthTo: "",
        categoryId: "",
        baseSku: "",
      };
    }
    return {
      facadeColor: searchParams.get("facadeColor") || "",
      corpusColor: searchParams.get("corpusColor") || "",
      priceFrom: searchParams.get("priceFrom") || "",
      priceTo: searchParams.get("priceTo") || "",
      lengthFrom: searchParams.get("lengthFrom") || "",
      lengthTo: searchParams.get("lengthTo") || "",
      categoryId: searchParams.get("categoryId") || "",
      baseSku: searchParams.get("baseSku") || "",
    };
  });
  
  // Debounced фильтры для оптимизации запросов
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  
  const [moduleCategories, setModuleCategories] = useState([]);
  const [moduleTypes, setModuleTypes] = useState([]);
  const getRef = useRef(get);
  const isFetchingRef = useRef(false);

  // Обновляем ref при изменении get
  useEffect(() => {
    getRef.current = get;
  }, [get]);

  // Сбрасываем фильтры при первом открытии каталога (если не пришли со страницы товара)
  useEffect(() => {
    if (isInitialMount.current && !fromProduct) {
      isInitialMount.current = false;
      // Очищаем параметр fromProduct из URL если он был
      const params = new URLSearchParams();
      setSearchParams(params, { replace: true });
    } else {
      isInitialMount.current = false;
    }
  }, [fromProduct, setSearchParams]);

  // Загружаем категории и типы модулей
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const [categoriesRes, typesRes] = await Promise.all([
          get("/module-categories"),
          get("/module-types"),
        ]);
        setModuleCategories(categoriesRes?.data || []);
        setModuleTypes(typesRes?.data || []);
      } catch (error) {
        console.error("Ошибка загрузки категорий", error);
      }
    };
    loadCategories();
  }, [get]);

  // Debounce для поискового запроса
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  // Debounce для фильтров (оптимизация запросов)
  useEffect(() => {
    // При первом рендере сразу устанавливаем debouncedFilters без задержки
    if (isFirstDebounce.current) {
      isFirstDebounce.current = false;
      setDebouncedFilters(filters);
      return;
    }
    
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 500);
    return () => clearTimeout(timer);
  }, [filters]);

  // Обновляем URL при изменении фильтров (используем debounced фильтры для URL)
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCategory !== "all") params.set("category", activeCategory);
    if (activeSubCategory) params.set("subCategory", activeSubCategory);
    Object.entries(debouncedFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    setSearchParams(params, { replace: true });
  }, [activeCategory, activeSubCategory, debouncedFilters, setSearchParams]);

  // Оптимизированный эффект загрузки данных с использованием debounced фильтров
  useEffect(() => {
    let active = true;
    const abortController = new AbortController();
    
    const fetchItems = async () => {
      // Проверяем, не идет ли уже запрос
      if (isFetchingRef.current) {
        return;
      }
      
      isFetchingRef.current = true;
      setLoading(true);
      
      try {
        // Формируем параметры запроса
        const queryParams = {};
        if (debouncedQuery) queryParams.search = debouncedQuery;
        
        // Добавляем debounced фильтры
        Object.entries(debouncedFilters).forEach(([key, value]) => {
          if (value) queryParams[key] = value;
        });
        
        // Загружаем данные в зависимости от выбранной категории
        if (activeCategory === "kitSolutions") {
          const response = await getRef.current("/kit-solutions", queryParams);
          if (active && !abortController.signal.aborted) {
            const list = Array.isArray(response?.data) ? response.data : [];
            setKitSolutions(list.map((x) => ({ ...x, __type: "kitSolution" })));
            setItems([]);
            setLoading(false);
            isFetchingRef.current = false;
          }
        } else if (activeCategory === "all") {
          const [modulesRes, kitsRes] = await Promise.all([
            getRef.current(
              "/modules",
              Object.keys(queryParams).length > 0 ? queryParams : undefined
            ),
            getRef.current(
              "/kit-solutions",
              Object.keys(queryParams).length > 0 ? queryParams : undefined
            ),
          ]);

          if (active && !abortController.signal.aborted) {
            const kits = Array.isArray(kitsRes?.data) ? kitsRes.data : [];
            setKitSolutions(kits.map((x) => ({ ...x, __type: "kitSolution" })));
            setItems(modulesRes?.data || []);
            setLoading(false);
            isFetchingRef.current = false;
          }
        } else {
          // Для модулей добавляем фильтр по категории
          if (activeCategory !== "all") {
            const category = moduleCategories.find(c => c.code === activeCategory);
            if (category) {
              queryParams.categoryId = category.id;
            }
          }
          
          // Фильтр по основе артикула для подкатегорий
          if (activeSubCategory) {
            queryParams.baseSku = activeSubCategory;
          }
          
          const response = await getRef.current("/modules", Object.keys(queryParams).length > 0 ? queryParams : undefined);
          if (active && !abortController.signal.aborted) {
            setItems(response?.data || []);
            setKitSolutions([]);
            setLoading(false);
            isFetchingRef.current = false;
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted && active) {
          console.error("Ошибка загрузки товаров:", error);
          setItems([]);
          setKitSolutions([]);
          setLoading(false);
          isFetchingRef.current = false;
        }
      }
    };
    
    // Вызываем загрузку сразу
    fetchItems();
    
    return () => {
      active = false;
      abortController.abort();
      isFetchingRef.current = false;
    };
  }, [debouncedQuery, activeCategory, activeSubCategory, debouncedFilters, moduleCategories]);

  // Получаем подкатегории для нижних и верхних модулей
  const bottomSubCategories = useMemo(() => {
    if (activeCategory !== "bottom") return [];
    return [
      { code: "НМР1", label: "НМР1 - Одностворчатый" },
      { code: "НМР2", label: "НМР2 - Двустворчатый" },
      { code: "НМР.М1", label: "НМР.М1 - Под мойку одностворчатый" },
      { code: "НМР.М2", label: "НМР.М2 - Под мойку двустворчатый" },
      { code: "НМЯ.М1", label: "НМЯ.М1 - С ящиком под мойку" },
      { code: "НМЯ.2", label: "НМЯ.2 - С двумя ящиками" },
      { code: "НМЯ.3", label: "НМЯ.3 - С тремя ящиками" },
    ];
  }, [activeCategory]);

  const topSubCategories = useMemo(() => {
    if (activeCategory !== "top") return [];
    return [
      { code: "ВМР1", label: "ВМР1 - Одностворчатый" },
      { code: "ВМР2", label: "ВМР2 - Двустворчатый" },
      { code: "ВМВ1", label: "ВМВ1 - Выдвижной" },
    ];
  }, [activeCategory]);

  const displayItems = useMemo(() => {
    if (activeCategory === "kitSolutions") return kitSolutions;
    if (activeCategory === "all") return [...kitSolutions, ...items];
    return items;
  }, [activeCategory, kitSolutions, items]);

  // Оптимизированная фильтрация активных товаров с useMemo
  const activeItems = useMemo(() => {
    return displayItems.filter((item) => item.is_active);
  }, [displayItems]);

  // Мемоизированная функция для добавления в корзину
  const handleAddToCart = useCallback((product) => {
    addItem(product);
  }, [addItem]);

  return (
    <div className="shop-container space-y-10 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-night-400">Каталог</p>
          <h1 className="text-3xl font-semibold text-night-900">Каталог мебели</h1>
          <p className="text-sm text-night-500">
            Найдите мебель под стиль Stolplit: кухни, гостиные, спальни и модули хранения.
          </p>
        </div>
        <SecureInput
          value={query}
          onChange={setQuery}
          placeholder="Поиск по названию или артикулу"
          className="min-w-[260px]"
        />
      </div>

      {/* Выбор категории */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <SecureButton
            variant={activeCategory === "all" ? "primary" : "outline"}
            onClick={() => {
              setActiveCategory("all");
              setActiveSubCategory(null);
            }}
          >
            Все
          </SecureButton>
          <SecureButton
            variant={activeCategory === "kitSolutions" ? "primary" : "outline"}
            onClick={() => {
              setActiveCategory("kitSolutions");
              setActiveSubCategory(null);
            }}
          >
            Готовые решения
          </SecureButton>
          <SecureButton
            variant={activeCategory === "bottom" ? "primary" : "outline"}
            onClick={() => {
              setActiveCategory("bottom");
              setActiveSubCategory(null);
            }}
          >
            Нижние модули
          </SecureButton>
          <SecureButton
            variant={activeCategory === "top" ? "primary" : "outline"}
            onClick={() => {
              setActiveCategory("top");
              setActiveSubCategory(null);
            }}
          >
            Верхние модули
          </SecureButton>
          <SecureButton
            variant={activeCategory === "tall" ? "primary" : "outline"}
            onClick={() => {
              setActiveCategory("tall");
              setActiveSubCategory(null);
            }}
          >
            Пеналы
          </SecureButton>
          <SecureButton
            variant={activeCategory === "filler" ? "primary" : "outline"}
            onClick={() => {
              setActiveCategory("filler");
              setActiveSubCategory(null);
            }}
          >
            Доборные элементы
          </SecureButton>
          <SecureButton
            variant={activeCategory === "accessory" ? "primary" : "outline"}
            onClick={() => {
              setActiveCategory("accessory");
              setActiveSubCategory(null);
            }}
          >
            Аксессуары
          </SecureButton>
        </div>

        {/* Подкатегории для нижних модулей */}
        {bottomSubCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-4 border-l-2 border-night-200">
            {bottomSubCategories.map((sub) => (
              <SecureButton
                key={sub.code}
                variant={activeSubCategory === sub.code ? "primary" : "outline"}
                className="text-sm"
                onClick={() => setActiveSubCategory(sub.code)}
              >
                {sub.label}
              </SecureButton>
            ))}
          </div>
        )}

        {/* Подкатегории для верхних модулей */}
        {topSubCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-4 border-l-2 border-night-200">
            {topSubCategories.map((sub) => (
              <SecureButton
                key={sub.code}
                variant={activeSubCategory === sub.code ? "primary" : "outline"}
                className="text-sm"
                onClick={() => setActiveSubCategory(sub.code)}
              >
                {sub.label}
              </SecureButton>
            ))}
          </div>
        )}
      </div>

      {/* Фильтры */}
      <div className="glass-card p-4 grid gap-4 md:grid-cols-4">
        <SecureInput
          value={filters.facadeColor}
          onChange={(value) => setFilters({ ...filters, facadeColor: value })}
          placeholder="Цвет фасада"
        />
        <SecureInput
          value={filters.corpusColor}
          onChange={(value) => setFilters({ ...filters, corpusColor: value })}
          placeholder="Цвет корпуса"
        />
        <SecureInput
          type="number"
          value={filters.priceFrom}
          onChange={(value) => setFilters({ ...filters, priceFrom: value })}
          placeholder="Цена от"
        />
        <SecureInput
          type="number"
          value={filters.priceTo}
          onChange={(value) => setFilters({ ...filters, priceTo: value })}
          placeholder="Цена до"
        />
        <SecureInput
          type="number"
          value={filters.lengthFrom}
          onChange={(value) => setFilters({ ...filters, lengthFrom: value })}
          placeholder="Длина от (мм)"
        />
        <SecureInput
          type="number"
          value={filters.lengthTo}
          onChange={(value) => setFilters({ ...filters, lengthTo: value })}
          placeholder="Длина до (мм)"
        />
        <div className="md:col-span-2 flex gap-2">
          <SecureButton
            variant="outline"
            onClick={() => {
              setFilters({
                facadeColor: "",
                corpusColor: "",
                priceFrom: "",
                priceTo: "",
                lengthFrom: "",
                lengthTo: "",
                categoryId: "",
                baseSku: "",
              });
            }}
          >
            Сбросить фильтры
          </SecureButton>
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-6 text-night-500">Загружаем товары...</div>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-night-900">
              {activeCategory === "kitSolutions" ? "Готовые решения" :
               activeCategory === "bottom" ? "Нижние модули" :
               activeCategory === "top" ? "Верхние модули" :
               activeCategory === "tall" ? "Пеналы" :
               activeCategory === "filler" ? "Доборные элементы" :
               activeCategory === "accessory" ? "Аксессуары" :
               "Все товары"}
            </h2>
            <span className="text-sm text-night-400">
              {activeItems.length} позици{activeItems.length > 1 ? "й" : "я"}
            </span>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {activeItems.map((product, index) => (
              <ProductCard 
                key={product.id ? `product-${product.id}` : `product-${index}-${product.sku || product.name}`} 
                product={product} 
                onAdd={handleAddToCart} 
              />
            ))}
          </div>
        </section>
      )}

      {!loading && activeItems.length === 0 && (
        <div className="glass-card p-6 text-night-500">
          Мы не нашли таких товаров. Попробуйте другой запрос или измените фильтры.
        </div>
      )}
    </div>
  );
};

export default CatalogPage;

