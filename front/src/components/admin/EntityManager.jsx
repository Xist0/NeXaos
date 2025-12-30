import { useEffect, useMemo, useRef, useState } from "react";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import useApi from "../../hooks/useApi";
import useLogger from "../../hooks/useLogger";
import ImageManager from "./ImageManager";
import { FaEdit, FaTrash, FaPlus, FaSave, FaTimes } from "react-icons/fa";

const defaultField = (field) => ({
  type: "text",
  placeholder: "",
  ...field,
});

const EntityManager = ({ title, endpoint, fields }) => {
  const { request, get, post, put, del } = useApi();
  const logger = useLogger();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState("");
  const [uploadingField, setUploadingField] = useState(null);
  const [activeSection, setActiveSection] = useState("visible");
  const [filterBaseSku, setFilterBaseSku] = useState("");
  const [colors, setColors] = useState([]);
  const colorsLoadedRef = useRef(false);
  const [sizePresetTabByField, setSizePresetTabByField] = useState({});
  const [sizePresetsByField, setSizePresetsByField] = useState({});

  const [availableModules, setAvailableModules] = useState([]);
  const modulesLoadedRef = useRef(false);
  // Store modules with their quantities
  const [kitSelectedBottomModules, setKitSelectedBottomModules] = useState([]);
  const [kitSelectedTopModules, setKitSelectedTopModules] = useState([]);
  
  // Generate unique IDs for each module instance
  const generateModuleId = useRef(0);
  const [kitCalc, setKitCalc] = useState(null);
  const [kitCompat, setKitCompat] = useState(null);
  const kitCalcInFlightRef = useRef(false);

  const [availableMaterials, setAvailableMaterials] = useState([]);
  const materialsLoadedRef = useRef(false);

  const [availableKitchenTypes, setAvailableKitchenTypes] = useState([]);
  const kitchenTypesLoadedRef = useRef(false);

  const [availableModuleDescriptions, setAvailableModuleDescriptions] = useState([]);
  const moduleDescriptionsLoadedRef = useRef(false);

  const normalizedFields = useMemo(() => fields.map(defaultField), [fields]);

  const getSizePresetStorageKey = (fieldName) => `nexaos_size_presets_${fieldName}`;

  const getPresetsForField = useMemo(() => {
    const map = {};
    normalizedFields.forEach((f) => {
      if (f.type === "number" && typeof f.name === "string" && f.name.endsWith("_mm")) {
        try {
          const raw = localStorage.getItem(getSizePresetStorageKey(f.name));
          const parsed = raw ? JSON.parse(raw) : [];
          map[f.name] = Array.isArray(parsed) ? parsed.filter((v) => Number.isFinite(Number(v))) : [];
        } catch {
          map[f.name] = [];
        }
      }
    });
    return map;
  }, [normalizedFields]);

  useEffect(() => {
    setSizePresetsByField(getPresetsForField);
  }, [getPresetsForField]);
  
  // Группируем поля по секциям для модулей
  const fieldsBySection = useMemo(() => {
    if (endpoint === "/modules") {
      return {
        visible: normalizedFields.filter(f => !f.section || f.section === "visible"),
        price: normalizedFields.filter(f => f.section === "price"),
      };
    }
    
    return { all: normalizedFields };
  }, [normalizedFields, endpoint]);
  
  const currentFields = useMemo(() => {
    if (endpoint === "/modules") {
      return fieldsBySection[activeSection] || [];
    }
    return normalizedFields;
  }, [endpoint, normalizedFields, fieldsBySection, activeSection]);

  const fetchItems = async () => {
    if (!endpoint) return;
    setLoading(true);
    try {
      const response = await get(endpoint);
      const items = response?.data || [];
      // Принимаем все элементы, даже без ID (они могут появиться после создания)
      setItems(items.filter(item => item != null));
    } catch (error) {
      logger.error("Не удалось загрузить данные", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const runKitCalculations = async () => {
    if (endpoint !== "/kit-solutions") return;
    if (kitCalcInFlightRef.current) return;

    const bottomIds = kitSelectedBottomModules
      .flatMap((m) => Array(Math.max(1, Number(m.quantity) || 1)).fill(Number(m.moduleId)))
      .filter((v) => Number.isFinite(v));
    const topIds = kitSelectedTopModules
      .flatMap((m) => Array(Math.max(1, Number(m.quantity) || 1)).fill(Number(m.moduleId)))
      .filter((v) => Number.isFinite(v));

    if (bottomIds.length === 0) {
      logger.error("Выберите хотя бы один нижний модуль");
      return;
    }

    kitCalcInFlightRef.current = true;
    try {
      const [countertopRes, compatRes] = await Promise.all([
        post("/modules/calculate-countertop", { moduleIds: bottomIds }),
        post("/modules/check-compatibility", { bottomModuleIds: bottomIds, topModuleIds: topIds }),
      ]);

      const countertop = countertopRes?.data || countertopRes;
      const compat = compatRes?.data || compatRes;

      const nextCalc = {
        bottomTotalLength: countertop?.totalLengthMm,
        topTotalLength: undefined,
        maxDepth: countertop?.maxDepthMm,
        countertopLength: countertop?.totalLengthMm,
        countertopDepth: countertop?.maxDepthMm,
      };

      setKitCalc(nextCalc);
      setKitCompat(compat);

      // также обновим поля формы
      setForm((prev) => ({
        ...prev,
        countertop_length_mm: countertop?.totalLengthMm,
        countertop_depth_mm: countertop?.maxDepthMm,
        total_length_mm: countertop?.totalLengthMm,
        total_depth_mm: countertop?.maxDepthMm,
      }));
    } catch (e) {
      logger.error("Не удалось выполнить расчет комплекта", e);
    } finally {
      kitCalcInFlightRef.current = false;
    }
  };

  // Загружаем цвета, если есть поля типа "color"
  useEffect(() => {
    const hasColorFields = normalizedFields.some(f => f.type === "color");
    if (hasColorFields && !colorsLoadedRef.current) {
      const loadColors = async () => {
        try {
          const response = await get("/colors");
          setColors(response?.data || []);
          colorsLoadedRef.current = true;
        } catch (error) {
          logger.error("Не удалось загрузить цвета", error);
          setColors([]);
        }
      };
      loadColors();
    }
  }, [normalizedFields, get]);

  // Загружаем модули для комплекта (готовых решений)
  useEffect(() => {
    if (endpoint !== "/kit-solutions") return;
    if (modulesLoadedRef.current) return;

    const loadModules = async () => {
      try {
        const response = await get("/modules", { limit: 500, isActive: true });
        setAvailableModules(Array.isArray(response?.data) ? response.data : []);
        modulesLoadedRef.current = true;
      } catch (error) {
        logger.error("Не удалось загрузить список модулей", error);
        setAvailableModules([]);
      }
    };

    loadModules();
  }, [endpoint, get]);

  // Загружаем подтипы/описания модулей для выбора description_id в модулях
  useEffect(() => {
    if (endpoint !== "/modules") return;
    if (moduleDescriptionsLoadedRef.current) return;

    const loadDescriptions = async () => {
      try {
        const res = await get("/module-descriptions", { limit: 500 });
        setAvailableModuleDescriptions(Array.isArray(res?.data) ? res.data : []);
        moduleDescriptionsLoadedRef.current = true;
      } catch (e) {
        logger.error("Не удалось загрузить подтипы модулей", e);
        setAvailableModuleDescriptions([]);
      }
    };

    loadDescriptions();
  }, [endpoint, get]);

  // Загружаем материалы для комплекта (готовых решений)
  useEffect(() => {
    if (endpoint !== "/kit-solutions") return;
    if (materialsLoadedRef.current) return;

    const loadMaterials = async () => {
      try {
        const res = await get("/materials", { limit: 500, isActive: true });
        setAvailableMaterials(Array.isArray(res?.data) ? res.data : []);
        materialsLoadedRef.current = true;
      } catch (e) {
        logger.error("Не удалось загрузить список материалов", e);
        setAvailableMaterials([]);
      }
    };

    loadMaterials();
  }, [endpoint, get]);

  // Загружаем типы кухни
  useEffect(() => {
    if (endpoint !== "/kit-solutions") return;
    if (kitchenTypesLoadedRef.current) return;

    const loadKitchenTypes = async () => {
      try {
        const res = await get("/kitchen-types", { limit: 500, isActive: true });
        setAvailableKitchenTypes(Array.isArray(res?.data) ? res.data : []);
        kitchenTypesLoadedRef.current = true;
      } catch (e) {
        logger.error("Не удалось загрузить типы кухни", e);
        setAvailableKitchenTypes([]);
      }
    };

    loadKitchenTypes();
  }, [endpoint, get]);

  useEffect(() => {
    // Очищаем список и форму при смене endpoint
    setItems([]);
    setForm({});
    setEditingId(null);
    setSearch("");
    setFilterBaseSku("");
    setActiveSection("visible");
    
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const response = await get(endpoint);
        if (active) {
          const items = response?.data || [];
          // Принимаем все элементы, даже без ID
          setItems(items.filter(item => item != null));
        }
      } catch (error) {
        if (active) {
          logger.error("Не удалось загрузить данные", error);
          setItems([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (endpoint) {
      load();
    }

    return () => {
      active = false;
    };
  }, [endpoint, get]);

  const handleEdit = (item) => {
    if (!item || !item.id) {
      logger.error("Не удалось редактировать: отсутствует ID записи");
      return;
    }
    setEditingId(item.id);

    // Для готовых решений подгружаем полный состав модулей
    if (endpoint === "/kit-solutions") {
      setLoading(true);
      get(`${endpoint}/${item.id}`)
        .then((res) => {
          const data = res?.data || {};
          setForm(data);
          const bottom = Array.isArray(data?.modules?.bottom)
            ? data.modules.bottom.map(m => ({
                id: generateModuleId.current++,
                moduleId: m.id,
                moduleData: m,
                quantity: 1
              }))
            : [];
          const top = Array.isArray(data?.modules?.top)
            ? data.modules.top.map(m => ({
                id: generateModuleId.current++,
                moduleId: m.id,
                moduleData: m,
                quantity: 1
              }))
            : [];
          setKitSelectedBottomModules(bottom);
          setKitSelectedTopModules(top);
          setKitCalc(data?.calculatedDimensions || null);
          setKitCompat(null);
        })
        .catch((e) => {
          logger.error("Не удалось загрузить состав готового решения", e);
          setForm(item);
        })
        .finally(() => setLoading(false));
    } else {
      setForm(item);
    }
    // Обновляем изображения после начала редактирования
    setTimeout(() => {
      if (endpoint === "/modules") {
        // Небольшая задержка чтобы убедиться что editingId установлен
      }
    }, 100);
  };

  const handleDelete = async (id, item) => {
    // Проверяем ID из параметра или из объекта
    const itemId = id || item?.id;
    
    if (!itemId) {
      logger.error("Не удалось удалить: отсутствует ID записи", { item, id });
      return;
    }
    
    if (!confirm(`Вы уверены, что хотите удалить запись #${itemId}?`)) {
      return;
    }

    try {
      await del(`${endpoint}/${itemId}`);
      logger.info("Запись удалена");
      // Обновляем список после удаления
      await fetchItems();
    } catch (error) {
      logger.error("Не удалось удалить запись", error);
      // Все равно обновляем список на случай если удаление прошло на сервере
      await fetchItems();
    }
  };

  const handleUpload = async (fieldName, file) => {
    if (!file) return;
    setUploadingField(fieldName);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await request({
        method: "POST",
        url: "/upload",
        data: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const url = response?.url || response?.data?.url;
      if (url) {
        setForm((prev) => ({ ...prev, [fieldName]: url }));
        logger.info("Файл загружен", { url });
      } else {
        logger.error("Сервер не вернул ссылку на файл");
      }
    } catch (error) {
      logger.error("Не удалось загрузить файл", error);
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    // Собираем payload из всех полей (включая все секции для модулей)
    const allFields = endpoint === "/modules" 
      ? normalizedFields 
      : normalizedFields;
    
    const payload = allFields.reduce((acc, field) => {
      const rawValue = form[field.name];
      // Пропускаем undefined и пустые строки, но сохраняем 0 для чисел
      if (rawValue === undefined || rawValue === "") return acc;
      acc[field.name] =
        field.type === "number" ? Number(rawValue) : rawValue;
      return acc;
    }, {});

    // Готовые решения: добавляем состав модулей и автозаполняем размеры
    if (endpoint === "/kit-solutions") {
      // Flatten modules with quantities
      const moduleIds = [
        ...kitSelectedBottomModules.flatMap(m => 
          Array(m.quantity).fill(Number(m.moduleId))
        ),
        ...kitSelectedTopModules.flatMap(m => 
          Array(m.quantity).fill(Number(m.moduleId))
        )
      ].filter(Boolean);

      // Материал: приводим к числу или null
      if (payload.material_id !== undefined) {
        const mid = Number(payload.material_id);
        payload.material_id = Number.isFinite(mid) && mid > 0 ? mid : null;
      }

      // Тип кухни: приводим к числу или null
      if (payload.kitchen_type_id !== undefined) {
        const kt = Number(payload.kitchen_type_id);
        payload.kitchen_type_id = Number.isFinite(kt) && kt > 0 ? kt : null;
      }

      // Автоподсчет габаритов (без лишних запросов):
      // total_length_mm = сумма длин нижних модулей
      // total_depth_mm = max глубина нижних
      // total_height_mm = max высота нижних + max высота верхних
      const byId = new Map(availableModules.map((m) => [Number(m.id), m]));
      const bottomMods = kitSelectedBottomModules.flatMap(({moduleId, quantity}) => 
        Array(quantity).fill(byId.get(Number(moduleId))).filter(Boolean)
      );
      const topMods = kitSelectedTopModules.flatMap(({moduleId, quantity}) => 
        Array(quantity).fill(byId.get(Number(moduleId))).filter(Boolean)
      );
      const bottomTotal = bottomMods.reduce((s, m) => s + (Number(m.length_mm) || 0), 0);
      const bottomMaxDepth = Math.max(0, ...bottomMods.map((m) => Number(m.depth_mm) || 0));
      const bottomMaxHeight = Math.max(0, ...bottomMods.map((m) => Number(m.height_mm) || 0));
      const topMaxHeight = Math.max(0, ...topMods.map((m) => Number(m.height_mm) || 0));

      payload.total_length_mm = bottomTotal;
      payload.total_depth_mm = bottomMaxDepth;
      payload.total_height_mm = bottomMaxHeight + topMaxHeight;

      // Столешница: если есть рассчитанное значение — используем, иначе берем bottomTotal
      payload.countertop_length_mm = Number(kitCalc?.countertopLength ?? bottomTotal);
      payload.countertop_depth_mm = Number(kitCalc?.countertopDepth ?? bottomMaxDepth);

      payload.moduleIds = moduleIds;
    }

    // Проверка уникальности SKU для kit-solutions
    if (endpoint === "/kit-solutions" && payload.sku && !editingId) {
      const existingSku = items.find(item => 
        item.sku && item.sku.toLowerCase() === payload.sku.toLowerCase()
      );
      if (existingSku) {
        logger.error(`Готовое решение с артикулом "${payload.sku}" уже существует (ID: ${existingSku.id})`);
        return;
      }
    }
    
    // Валидация: проверяем обязательные поля
    const requiredFields = allFields.filter(f => f.required);
    const missingFields = requiredFields.filter(field => {
      const value = payload[field.name];
      return value === undefined || value === "" || (field.type === "number" && isNaN(value));
    });

    if (missingFields.length > 0) {
      const missingNames = missingFields.map(f => f.label).join(", ");
      logger.error(`Не заполнены обязательные поля: ${missingNames}`);
      return;
    }

    // Валидация: нельзя создать/обновить полностью пустой объект
    if (Object.keys(payload).length === 0) {
      logger.error("Нельзя сохранить пустой объект. Заполните хотя бы одно поле.");
      return;
    }

    // Дополнительная проверка для редактирования
    if (editingId && !editingId) {
      logger.error("Не удалось обновить: отсутствует ID записи");
      return;
    }

    try {
      let response;
      if (editingId) {
        response = await put(`${endpoint}/${editingId}`, payload);
        logger.info("Запись обновлена");
      } else {
        response = await post(endpoint, payload);
        // Проверяем наличие ID в ответе при создании
        const createdItem = response?.data || response;
        if (!createdItem || !createdItem.id) {
          logger.warn("Созданная запись не содержит ID в ответе", { response, createdItem });
        } else {
          logger.info("Запись создана", { id: createdItem.id });
        }
      }

      setForm({});
      setEditingId(null);
      // Небольшая задержка перед обновлением списка, чтобы сервер успел обработать
      setTimeout(() => {
        fetchItems();
      }, 100);
    } catch (error) {
      logger.error("Не удалось сохранить запись", error);
      // Все равно обновляем список на случай частичного успеха
      setTimeout(() => {
        fetchItems();
      }, 100);
    }
  };

  // Получаем уникальные подтипы модулей для фильтра
  const availableBaseSkus = useMemo(() => {
    if (endpoint !== "/modules") return [];
    const skus = [...new Set(items.map((item) => item.base_sku).filter(Boolean))];
    return skus.sort();
  }, [items, endpoint]);

  const filteredItems = useMemo(() => {
    let filtered = items;
    
    // Фильтрация по подтипу модуля
    if (endpoint === "/modules" && filterBaseSku) {
      filtered = filtered.filter((item) => item.base_sku === filterBaseSku);
    }
    
    // Поиск по тексту
    if (search) {
      filtered = filtered.filter((item) =>
        Object.values(item)
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    }
    
    return filtered;
  }, [items, search, filterBaseSku, endpoint]);

  return (
    <section className="glass-card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-night-900">{title}</h2>
          <p className="text-sm text-night-400">
            {loading ? "Загружаем..." : `${filteredItems.length} записей`}
          </p>
        </div>
        <SecureInput
          className="max-w-xs"
          value={search}
          onChange={setSearch}
          placeholder="Поиск..."
        />
      </div>

      {/* Фильтр по подтипу модуля */}
      {endpoint === "/modules" && availableBaseSkus.length > 0 && (
        <div className="flex gap-4 items-center border-b border-night-200 pb-4">
          <label className="text-sm font-semibold text-night-700">Фильтр по подтипу:</label>
          <select
            value={filterBaseSku}
            onChange={(e) => setFilterBaseSku(e.target.value)}
            className="px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          >
            <option value="">Все подтипы</option>
            {availableBaseSkus.map((sku) => (
              <option key={sku} value={sku}>
                {sku}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Вкладки для модулей */}
      {endpoint === "/modules" && (
        <div className="flex gap-2 border-b border-night-200 pb-2">
          <SecureButton
            variant={activeSection === "visible" ? "primary" : "outline"}
            className="px-4 py-2 text-sm"
            onClick={() => setActiveSection("visible")}
            type="button"
          >
            Видимые параметры
          </SecureButton>
          <SecureButton
            variant={activeSection === "price" ? "primary" : "outline"}
            className="px-4 py-2 text-sm"
            onClick={() => setActiveSection("price")}
            type="button"
          >
            ЦЕНА модуля
          </SecureButton>
        </div>
      )}


      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        {endpoint === "/kit-solutions" && (
          <div className="md:col-span-2 space-y-3 border border-night-200 rounded-lg p-4 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-night-900">Состав кухни</p>
                <p className="text-xs text-night-500">Выберите нижние и верхние модули для готового решения</p>
              </div>
              <SecureButton type="button" variant="outline" className="px-4 py-2 text-xs" onClick={runKitCalculations}>
                Рассчитать столешницу / совместимость
              </SecureButton>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-night-700">Тип кухни</p>
                <select
                  value={form.kitchen_type_id ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      kitchen_type_id: e.target.value ? Number(e.target.value) : "",
                    }))
                  }
                  className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900"
                >
                  <option value="">Не выбран</option>
                  {availableKitchenTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.id} {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-night-700">Материал</p>
                <select
                  value={form.material_id ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      material_id: e.target.value ? Number(e.target.value) : "",
                    }))
                  }
                  className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900"
                >
                  <option value="">Не выбран</option>
                  {availableMaterials.map((m) => (
                    <option key={m.id} value={m.id}>
                      #{m.id} {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-night-700">Нижние модули</p>
                <select
                  value={""}
                  onChange={(e) => {
                    const moduleId = Number(e.target.value);
                    if (!moduleId) return;
                    
                    const moduleData = availableModules.find(m => m.id === moduleId);
                    if (!moduleData) return;

                    setKitSelectedBottomModules(prev => [
                      ...prev,
                      {
                        id: generateModuleId.current++,
                        moduleId,
                        moduleData,
                        quantity: 1
                      }
                    ]);
                  }}
                  className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900"
                >
                  <option value="">+ Добавить нижний модуль...</option>
                  {availableModules
                    .filter((m) => String(m.base_sku || "").startsWith("Н") || 
                             (m.module_category_id && m.module_category_id.toString().includes('bottom')))
                    .map((m) => (
                      <option key={`bottom-${m.id}`} value={m.id}>
                        #{m.id} {m.name} ({m.length_mm}×{m.depth_mm}×{m.height_mm})
                      </option>
                    ))}
                </select>

                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {kitSelectedBottomModules.map(({id, moduleId, moduleData, quantity}) => {
                    const moduleInfo = moduleData || availableModules.find(m => m.id === moduleId);
                    return (
                      <div key={`b-${id}`} className="flex flex-col border border-night-200 rounded-lg p-2 bg-white">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-night-900 truncate">
                              {moduleInfo?.name || `Модуль #${moduleId}`}
                            </p>
                            {moduleInfo && (
                              <p className="text-xs text-night-500">
                                {moduleInfo.length_mm}×{moduleInfo.depth_mm}×{moduleInfo.height_mm} мм
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <button
                              type="button"
                              className="w-6 h-6 flex items-center justify-center border border-night-200 rounded-full text-xs"
                              onClick={() => setKitSelectedBottomModules(prev => 
                                prev.map(m => m.id === id ? {...m, quantity: Math.max(1, m.quantity - 1)} : m)
                              )}
                            >
                              -
                            </button>
                            <span className="text-sm w-4 text-center">{quantity}</span>
                            <button
                              type="button"
                              className="w-6 h-6 flex items-center justify-center border border-night-200 rounded-full text-xs"
                              onClick={() => setKitSelectedBottomModules(prev => 
                                prev.map(m => m.id === id ? {...m, quantity: m.quantity + 1} : m)
                              )}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className="text-red-600 hover:text-red-800 ml-1"
                              onClick={() => setKitSelectedBottomModules(prev => 
                                prev.filter(m => m.id !== id)
                              )}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        {moduleInfo?.preview_url && (
                          <img 
                            src={moduleInfo.preview_url} 
                            alt={moduleInfo.name}
                            className="mt-2 h-16 w-full object-contain rounded"
                            onError={(e) => {
                              if (e.target) e.target.style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-night-700">Верхние модули</p>
                <select
                  value={""}
                  onChange={(e) => {
                    const moduleId = Number(e.target.value);
                    if (!moduleId) return;
                    
                    const moduleData = availableModules.find(m => m.id === moduleId);
                    if (!moduleData) return;

                    setKitSelectedTopModules(prev => [
                      ...prev,
                      {
                        id: generateModuleId.current++,
                        moduleId,
                        moduleData,
                        quantity: 1
                      }
                    ]);
                  }}
                  className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900"
                >
                  <option value="">+ Добавить верхний модуль...</option>
                  {availableModules
                    .filter((m) => String(m.base_sku || "").startsWith("В") || 
                             (m.module_category_id && m.module_category_id.toString().includes('top')))
                    .map((m) => (
                      <option key={`top-${m.id}`} value={m.id}>
                        #{m.id} {m.name} ({m.length_mm}×{m.depth_mm}×{m.height_mm})
                      </option>
                    ))}
                </select>

                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {kitSelectedTopModules.map(({id, moduleId, moduleData, quantity}) => {
                    const moduleInfo = moduleData || availableModules.find(m => m.id === moduleId);
                    return (
                      <div key={`t-${id}`} className="flex flex-col border border-night-200 rounded-lg p-2 bg-white">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-night-900 truncate">
                              {moduleInfo?.name || `Модуль #${moduleId}`}
                            </p>
                            {moduleInfo && (
                              <p className="text-xs text-night-500">
                                {moduleInfo.length_mm}×{moduleInfo.depth_mm}×{moduleInfo.height_mm} мм
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <button
                              type="button"
                              className="w-6 h-6 flex items-center justify-center border border-night-200 rounded-full text-xs"
                              onClick={() => setKitSelectedTopModules(prev => 
                                prev.map(m => m.id === id ? {...m, quantity: Math.max(1, m.quantity - 1)} : m)
                              )}
                            >
                              -
                            </button>
                            <span className="text-sm w-4 text-center">{quantity}</span>
                            <button
                              type="button"
                              className="w-6 h-6 flex items-center justify-center border border-night-200 rounded-full text-xs"
                              onClick={() => setKitSelectedTopModules(prev => 
                                prev.map(m => m.id === id ? {...m, quantity: m.quantity + 1} : m)
                              )}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className="text-red-600 hover:text-red-800 ml-1"
                              onClick={() => setKitSelectedTopModules(prev => 
                                prev.filter(m => m.id !== id)
                              )}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        {moduleInfo?.preview_url && (
                          <img 
                            src={moduleInfo.preview_url} 
                            alt={moduleInfo.name}
                            className="mt-2 h-16 w-full object-contain rounded"
                            onError={(e) => {
                              if (e.target) e.target.style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {kitCalc && (
              <div className="text-xs text-night-700">
                <div>Столешница: {kitCalc.countertopLength} мм × {kitCalc.countertopDepth} мм</div>
              </div>
            )}
            {kitCompat && (
              <div className="text-xs">
                <div className={kitCompat.compatible ? "text-green-700" : "text-red-700"}>
                  {kitCompat.compatible ? "Совместимость OK" : "Есть несоответствия"}
                </div>
                {!kitCompat.compatible && Array.isArray(kitCompat.warnings) && kitCompat.warnings.length > 0 && (
                  <div className="mt-2 space-y-1 text-red-700">
                    {kitCompat.warnings.map((w, idx) => (
                      <div key={idx}>{w.message || JSON.stringify(w)}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {currentFields.map((field) => (
          <label key={field.name} className="text-sm text-night-700 space-y-1">
            <span>{field.label}</span>
            {field.inputType === "image" ? (
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    handleUpload(field.name, event.target.files?.[0] || null)
                  }
                  className="block w-full text-xs text-night-600 file:mr-3 file:rounded-full file:border-0 file:bg-night-900 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-night-800"
                />
                {form[field.name] && (
                  <img
                    src={form[field.name].startsWith('/uploads/') 
                      ? (import.meta.env.DEV ? `http://localhost:5000${form[field.name]}` : form[field.name])
                      : form[field.name]}
                    alt={field.label}
                    className="h-20 w-20 rounded-md object-cover border border-night-100"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      console.error("Ошибка загрузки изображения:", form[field.name]);
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                {uploadingField === field.name && (
                  <p className="text-xs text-night-400">Загружаем файл...</p>
                )}
              </div>
            ) : field.type === "select" ? (
              <select
                value={form[field.name] ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [field.name]: e.target.value }))
                }
                className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                required={field.required}
              >
                <option value="">Выберите...</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === "color" ? (
              <div className="space-y-2">
                <select
                  value={form[field.name] ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [field.name]: e.target.value ? Number(e.target.value) : "" }))
                  }
                  className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  required={field.required}
                >
                  <option value="">Выберите цвет...</option>
                  {colors.map((color) => (
                    <option key={color.id} value={color.id}>
                      {color.name}
                    </option>
                  ))}
                </select>
                {form[field.name] && (() => {
                  const selectedColor = colors.find(c => c.id === Number(form[field.name]));
                  if (selectedColor && selectedColor.image_url) {
                    const imageUrl = selectedColor.image_url.startsWith('/uploads/')
                      ? (import.meta.env.DEV ? `http://localhost:5000${selectedColor.image_url}` : selectedColor.image_url)
                      : selectedColor.image_url;
                    return (
                      <div className="flex items-center gap-3 p-2 border border-night-200 rounded-lg bg-night-50">
                        <img
                          src={imageUrl}
                          alt={selectedColor.name}
                          className="h-12 w-12 rounded object-cover border border-night-200"
                          crossOrigin="anonymous"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                        <div>
                          <p className="text-sm font-medium text-night-900">{selectedColor.name}</p>
                          {selectedColor.sku && (
                            <p className="text-xs text-night-500">Артикул: {selectedColor.sku}</p>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            ) : endpoint === "/modules" && field.name === "description_id" ? (
              <select
                value={form[field.name] ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    [field.name]: e.target.value ? Number(e.target.value) : "",
                  }))
                }
                className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                <option value="">Не выбран</option>
                {availableModuleDescriptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    #{d.id} {d.base_sku} — {d.name}
                  </option>
                ))}
              </select>
            ) : (
              (() => {
                const isMmNumberField =
                  field.type === "number" &&
                  typeof field.name === "string" &&
                  field.name.endsWith("_mm");

                if (!isMmNumberField) {
                  return (
                    <SecureInput
                      type={field.type}
                      value={form[field.name] ?? ""}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, [field.name]: value }))
                      }
                      placeholder={field.placeholder}
                      required={field.required}
                    />
                  );
                }

                const activeTab = sizePresetTabByField[field.name] || "input";
                const presets = sizePresetsByField[field.name] || [];
                const currentValue = form[field.name] ?? "";
                const numericValue = Number(currentValue);
                const canSave = Number.isFinite(numericValue) && numericValue > 0;

                const savePreset = () => {
                  if (!canSave) return;
                  const next = Array.from(new Set([numericValue, ...presets])).sort((a, b) => a - b);
                  setSizePresetsByField((prev) => ({ ...prev, [field.name]: next }));
                  try {
                    localStorage.setItem(getSizePresetStorageKey(field.name), JSON.stringify(next));
                  } catch {
                    // ignore
                  }
                };

                const removePreset = (valueToRemove) => {
                  const next = presets.filter((v) => Number(v) !== Number(valueToRemove));
                  setSizePresetsByField((prev) => ({ ...prev, [field.name]: next }));
                  try {
                    localStorage.setItem(getSizePresetStorageKey(field.name), JSON.stringify(next));
                  } catch {
                    // ignore
                  }
                };

                return (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <SecureButton
                        type="button"
                        variant={activeTab === "input" ? "primary" : "outline"}
                        className="px-3 py-2 text-xs"
                        onClick={() =>
                          setSizePresetTabByField((prev) => ({ ...prev, [field.name]: "input" }))
                        }
                      >
                        Ввод
                      </SecureButton>
                      <SecureButton
                        type="button"
                        variant={activeTab === "presets" ? "primary" : "outline"}
                        className="px-3 py-2 text-xs"
                        onClick={() =>
                          setSizePresetTabByField((prev) => ({ ...prev, [field.name]: "presets" }))
                        }
                      >
                        Шаблоны
                      </SecureButton>
                    </div>

                    {activeTab === "input" ? (
                      <div className="space-y-2">
                        <SecureInput
                          type={field.type}
                          value={currentValue}
                          onChange={(value) =>
                            setForm((prev) => ({ ...prev, [field.name]: value }))
                          }
                          placeholder={field.placeholder}
                          required={field.required}
                        />
                        <SecureButton
                          type="button"
                          variant="outline"
                          disabled={!canSave}
                          className="px-3 py-2 text-xs"
                          onClick={savePreset}
                        >
                          Сохранить как шаблон
                        </SecureButton>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <select
                          value={""}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            setForm((prev) => ({ ...prev, [field.name]: Number(v) }));
                          }}
                          className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                        >
                          <option value="">Выберите размер...</option>
                          {presets.map((v) => (
                            <option key={v} value={v}>
                              {v} мм
                            </option>
                          ))}
                        </select>

                        {presets.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {presets.map((v) => (
                              <div
                                key={`preset-${field.name}-${v}`}
                                className="flex items-center gap-1 border border-night-200 rounded-lg px-2 py-1 bg-white"
                              >
                                <button
                                  type="button"
                                  className="text-xs text-night-900"
                                  onClick={() =>
                                    setForm((prev) => ({ ...prev, [field.name]: Number(v) }))
                                  }
                                >
                                  {v} мм
                                </button>
                                <button
                                  type="button"
                                  className="text-xs text-red-600"
                                  onClick={() => removePreset(v)}
                                  aria-label="Удалить шаблон"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </label>
        ))}
        <div className="md:col-span-2 flex gap-3">
          <SecureButton type="submit" className="px-6 py-3 flex items-center gap-2">
            {editingId ? (
              <>
                <FaSave />
                Сохранить изменения
              </>
            ) : (
              <>
                <FaPlus />
                Добавить запись
              </>
            )}
          </SecureButton>
          {editingId && (
            <SecureButton
              type="button"
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setForm({});
              }}
              className="flex items-center gap-2"
            >
              <FaTimes />
              Отмена
            </SecureButton>
          )}
        </div>
      </form>

      {/* Image Manager для модулей - показываем всегда при редактировании */}
      {endpoint === "/modules" && editingId && (
        <div className="border-t border-night-200 pt-6 mt-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-night-900 mb-2">Управление изображениями</h3>
            <p className="text-sm text-night-500">
              Загрузите несколько фотографий товара. Первое фото будет использоваться как превью.
              Перетаскивайте фото для изменения порядка.
            </p>
          </div>
          <ImageManager
            entityType="modules"
            entityId={editingId}
            onUpdate={fetchItems}
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-night-400">
              <th className="py-3 pr-4">ID</th>
              {normalizedFields.map((field) => (
                <th key={field.name} className="py-3 pr-4">
                  {field.label}
                </th>
              ))}
              <th className="py-3 pr-4">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, index) => (
              <tr
                key={item.id || `item-${index}`}
                className="border-t border-night-100 text-night-900"
              >
                <td className="py-3 pr-4 font-semibold">#{item.id || '—'}</td>
                {normalizedFields.map((field) => (
                  <td key={field.name} className="py-3 pr-4">
                    {field.inputType === "image" && item[field.name] ? (
                      <img
                        src={item[field.name].startsWith('/uploads/') 
                          ? (import.meta.env.DEV ? `http://localhost:5000${item[field.name]}` : item[field.name])
                          : item[field.name]}
                        alt={field.label}
                        className="h-10 w-10 rounded object-cover border border-night-100"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : field.type === "color" && item[field.name] ? (
                      (() => {
                        const colorId = Number(item[field.name]);
                        const color = colors.find(c => c.id === colorId);
                        if (color) {
                          const imageUrl = color.image_url?.startsWith('/uploads/')
                            ? (import.meta.env.DEV ? `http://localhost:5000${color.image_url}` : color.image_url)
                            : color.image_url;
                          return (
                            <div className="flex items-center gap-2">
                              {imageUrl && (
                                <img
                                  src={imageUrl}
                                  alt={color.name}
                                  className="h-8 w-8 rounded object-cover border border-night-200"
                                  crossOrigin="anonymous"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              )}
                              <span className="text-sm text-night-900">{color.name}</span>
                            </div>
                          );
                        }
                        return item[field.name] ?? "—";
                      })()
                    ) : (
                      item[field.name] ?? "—"
                    )}
                  </td>
                ))}
                <td className="py-3 pr-4">
                  <div className="flex gap-2">
                    <SecureButton
                      variant="outline"
                      className="px-3 py-2 text-xs flex items-center gap-1.5"
                      onClick={() => handleEdit(item)}
                      title="Редактировать"
                    >
                      <FaEdit />
                      Редактировать
                    </SecureButton>
                    <SecureButton
                      variant="ghost"
                      className="px-3 py-2 text-xs flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(item.id, item)}
                      title="Удалить"
                    >
                      <FaTrash />
                      Удалить
                    </SecureButton>
                  </div>
                </td>
              </tr>
            ))}
            {!filteredItems.length && !loading && (
              <tr>
                <td
                  colSpan={normalizedFields.length + 2}
                  className="py-6 text-center text-night-400"
                >
                  Нет записей
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default EntityManager;

