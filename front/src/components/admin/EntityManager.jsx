import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import useApi from "../../hooks/useApi";
import useLogger from "../../hooks/useLogger";
import ImageManager from "./ImageManager";
import { FaPlus, FaSave, FaTimes } from "react-icons/fa";
import useHeroWorksMedia from "./entityManager/useHeroWorksMedia";
import HeroWorksMediaSection from "./entityManager/HeroWorksMediaSection";
import HeroWorksMediaModal from "./entityManager/HeroWorksMediaModal";
import useDragSort from "./entityManager/useDragSort";
import EntityTable from "./entityManager/EntityTable";
import EntityFormFields from "./entityManager/EntityFormFields";

let colorsCache = null;
let colorsCachePromise = null;
let collectionsCache = null;
let collectionsCachePromise = null;

const defaultField = (field) => ({
  type: "text",
  placeholder: "",
  ...field,
});

const EntityManager = ({ title, endpoint, fields, fixedValues }) => {
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
  const [filterModuleCategoryId, setFilterModuleCategoryId] = useState("");
  const [colors, setColors] = useState([]);
  const colorsLoadedRef = useRef(false);
  const [collections, setCollections] = useState([]);
  const collectionsLoadedRef = useRef(false);
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

  const [availableModuleCategories, setAvailableModuleCategories] = useState([]);
  const moduleCategoriesLoadedRef = useRef(false);

  const heroWorksMedia = useHeroWorksMedia({
    endpoint,
    editingId,
    request,
    get,
    post,
    del,
    logger,
  });

  const slugify = (input) => {
    const map = {
      а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
      к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
      х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
    };

    const s = String(input || "").trim().toLowerCase();
    const translit = s
      .split("")
      .map((ch) => (map[ch] != null ? map[ch] : ch))
      .join("");

    return translit
      .replace(/[^a-z0-9\s_-]/g, "")
      .replace(/[\s_-]+/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  const selectedModuleCategory = useMemo(() => {
    if (!filterModuleCategoryId) return null;
    return availableModuleCategories.find((c) => String(c.id) === String(filterModuleCategoryId)) || null;
  }, [availableModuleCategories, filterModuleCategoryId]);

  const selectedCategoryPrefix = useMemo(() => {
    const explicit = selectedModuleCategory?.sku_prefix ? String(selectedModuleCategory.sku_prefix) : "";
    if (explicit) return explicit.toUpperCase();

    const code = String(selectedModuleCategory?.code || "").toLowerCase();
    if (code === "bottom") return "НМ";
    if (code === "top") return "ВМ";
    return "";
  }, [selectedModuleCategory]);

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
    if (endpoint === "/module-descriptions") {
      return normalizedFields.filter((f) => f.name !== "module_category_id");
    }
    return normalizedFields;
  }, [endpoint, normalizedFields, fieldsBySection, activeSection]);

  const fetchItems = useCallback(
    async ({ active } = {}) => {
      if (!endpoint) return;
      const isActive = typeof active === "function" ? active : () => true;
      if (!isActive()) return;

      setLoading(true);
      try {
        const response = await get(endpoint, {
          ...(fixedValues || {}),
          limit: 500,
        });
        const items = response?.data || [];
        if (!isActive()) return;
        // Принимаем все элементы, даже без ID (они могут появиться после создания)
        setItems(items.filter((item) => item != null));
      } catch (error) {
        if (!isActive()) return;
        logger.error("Не удалось загрузить данные", error);
        setItems([]);
      } finally {
        if (isActive()) {
          setLoading(false);
        }
      }
    },
    [endpoint, get, logger, fixedValues]
  );

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
          if (Array.isArray(colorsCache)) {
            setColors(colorsCache);
            colorsLoadedRef.current = true;
            return;
          }

          if (!colorsCachePromise) {
            colorsCachePromise = get("/colors").then((response) => {
              const data = Array.isArray(response?.data) ? response.data : [];
              colorsCache = data;
              return data;
            });
          }

          const data = await colorsCachePromise;
          setColors(data);
          colorsLoadedRef.current = true;
        } catch (error) {
          logger.error("Не удалось загрузить цвета", error);
          setColors([]);
        }
      };
      loadColors();
    }
  }, [normalizedFields, get]);

  // Загружаем коллекции (бренды), если есть поля типа "collection"
  useEffect(() => {
    const hasCollectionFields = normalizedFields.some((f) => f.type === "collection");
    if (hasCollectionFields && !collectionsLoadedRef.current) {
      const loadCollections = async () => {
        try {
          if (Array.isArray(collectionsCache)) {
            setCollections(collectionsCache);
            collectionsLoadedRef.current = true;
            return;
          }

          if (!collectionsCachePromise) {
            collectionsCachePromise = get("/collections", { limit: 500, isActive: true }).then((response) => {
              const data = Array.isArray(response?.data) ? response.data : [];
              collectionsCache = data;
              return data;
            });
          }

          const data = await collectionsCachePromise;
          setCollections(data);
          collectionsLoadedRef.current = true;
        } catch (error) {
          logger.error("Не удалось загрузить коллекции", error);
          setCollections([]);
        }
      };
      loadCollections();
    }
  }, [normalizedFields, get, logger]);

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
  }, [endpoint, get, logger]);

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

  // Загружаем категории модулей для select полей
  useEffect(() => {
    const needsModuleCategories =
      endpoint === "/kit-solutions" || normalizedFields.some((f) => f.type === "moduleCategory");
    if (!needsModuleCategories) return;
    if (moduleCategoriesLoadedRef.current) return;

    const loadCategories = async () => {
      try {
        const res = await get("/module-categories", { limit: 500 });
        setAvailableModuleCategories(Array.isArray(res?.data) ? res.data : []);
        moduleCategoriesLoadedRef.current = true;
      } catch (e) {
        logger.error("Не удалось загрузить категории модулей", e);
        setAvailableModuleCategories([]);
      }
    };

    loadCategories();
  }, [normalizedFields, get, logger]);

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
    heroWorksMedia.resetAll();
    setSearch("");
    setFilterBaseSku("");
    setFilterModuleCategoryId("");
    setActiveSection("visible");
    
    let active = true;

    if (endpoint) {
      fetchItems({ active: () => active });
    }

    return () => {
      active = false;
    };
  }, [endpoint, fetchItems]);

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
      if (endpoint === "/colors") {
        const normalized = { ...item };
        if (!normalized.type) {
          normalized.type = "universal";
        }
        setForm(normalized);
      } else {
        setForm(item);
      }
    }

    heroWorksMedia.resetPending();
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

    const maxBytes = 512 * 1024 * 1024;
    if (file.size > maxBytes) {
      logger.error("Файл слишком большой. Максимальный размер: 512MB");
      return;
    }

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
      if (error?.response?.status === 413) {
        logger.error("Файл слишком большой для загрузки. Уменьшите размер или загрузите файл меньшего объема.");
        return;
      }
      const serverMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message;
      logger.error(serverMessage || "Не удалось загрузить файл", error);
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!editingId && heroWorksMedia.requireMediaForCreate && !heroWorksMedia.hasPendingMedia) {
      logger.error("Сначала выберите фотографию");
      return;
    }
    
    // Собираем payload из всех полей (включая все секции для модулей)
    const allFields = endpoint === "/modules" 
      ? normalizedFields 
      : normalizedFields;
    
    const payload = allFields.reduce((acc, field) => {
      // пропускаем виртуальные/скрытые поля
      if (field.virtual) return acc;
      // Пропускаем undefined и пустые строки, но сохраняем 0 для чисел
      const rawValue = form[field.name];
      if (rawValue === undefined || rawValue === "") {
        // для чекбоксов важно отправлять явное false, если значение задано
        if (field.type === "checkbox" && rawValue === false) {
          acc[field.name] = false;
        }
        return acc;
      }

      if (field.type === "number") {
        acc[field.name] = Number(rawValue);
        return acc;
      }

      if (field.type === "checkbox") {
        acc[field.name] = Boolean(rawValue);
        return acc;
      }

      acc[field.name] = rawValue;
      return acc;
    }, {});

    // Жестко фиксируем значения (например, category_group для вкладок каталога)
    if (fixedValues && typeof fixedValues === "object") {
      Object.assign(payload, fixedValues);
    }

    if (endpoint === "/colors") {
      if (payload.type === "universal") {
        payload.type = null;
      }
    }

    if (!editingId) {
      const missingFields = allFields.filter((field) => {
        if (endpoint === "/module-descriptions" && field.name === "module_category_id") return false;
        const value = payload[field.name];
        if (field.type === "checkbox") {
          return value === undefined;
        }
        if (value === undefined || value === "") return true;
        if (field.type === "number") {
          const n = Number(value);
          return !Number.isFinite(n);
        }
        return false;
      });

      if (missingFields.length > 0) {
        const missingNames = missingFields.map((f) => f.label).join(", ");
        logger.error(`Не заполнены поля: ${missingNames}`);
        return;
      }
    }

    if (endpoint === "/module-categories") {
      if (payload.name != null) {
        payload.name = String(payload.name).trim();
      }
      if (payload.sku_prefix != null) {
        payload.sku_prefix = String(payload.sku_prefix).trim().toUpperCase();
      }
      if (!payload.code) {
        const slug = slugify(payload.name);
        payload.code = slug || `cat_${Date.now()}`;
      }
    }

    if (endpoint === "/module-descriptions") {
      if (!filterModuleCategoryId) {
        logger.error("Сначала выберите категорию");
        return;
      }
      payload.module_category_id = Number(filterModuleCategoryId);

      if (payload.base_sku != null) {
        payload.base_sku = String(payload.base_sku).trim().toUpperCase();
      }
      if (payload.name != null) {
        payload.name = String(payload.name).trim();
      }

      if (!payload.base_sku) {
        logger.error("Заполните основу артикула");
        return;
      }
      if (selectedCategoryPrefix && !String(payload.base_sku).startsWith(selectedCategoryPrefix)) {
        logger.error(`Основа артикула должна начинаться с "${selectedCategoryPrefix}"`);
        return;
      }
      if (!payload.name) {
        logger.error("Заполните название");
        return;
      }

      if (!editingId) {
        const existing = items.find(
          (it) => String(it?.base_sku || "").toLowerCase() === String(payload.base_sku || "").toLowerCase()
        );
        if (existing) {
          logger.error(`Подтип с основой артикула "${payload.base_sku}" уже существует (ID: ${existing.id})`);
          return;
        }
      }
    }

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
    const requiredFields = allFields.filter((f) => f.required);
    const missingRequiredFields = requiredFields.filter((field) => {
      const value = payload[field.name];
      if (field.type === "checkbox") {
        return value === undefined;
      }
      return value === undefined || value === "" || (field.type === "number" && isNaN(value));
    });

    if (missingRequiredFields.length > 0) {
      const missingNames = missingRequiredFields.map((f) => f.label).join(", ");
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
        } else if (heroWorksMedia.isHeroOrWorks) {
          try {
            await heroWorksMedia.uploadPendingToEntity(createdItem.id);
          } catch (e) {
            try {
              await del(`${endpoint}/${createdItem.id}`);
            } catch {
              // ignore
            }
            logger.error("Не удалось загрузить медиа. Запись не создана.", e);
            return;
          }
        } else {
          logger.info("Запись создана", { id: createdItem.id });
        }
      }

      setForm({});
      setEditingId(null);
      heroWorksMedia.resetAll();
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

    if (endpoint === "/module-descriptions" && !filterModuleCategoryId) {
      return [];
    }
    
    if (fixedValues && typeof fixedValues === "object") {
      filtered = filtered.filter((item) => {
        return Object.entries(fixedValues).every(([k, v]) => String(item?.[k] ?? "") === String(v ?? ""));
      });
    }

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

    // Фильтрация подтипов по выбранной категории
    if (endpoint === "/module-descriptions" && filterModuleCategoryId) {
      const cid = Number(filterModuleCategoryId);
      filtered = filtered.filter((item) => Number(item.module_category_id) === cid);
    }
    
    return filtered;
  }, [items, search, normalizedFields, filterBaseSku, selectedModuleCategory, fixedValues, endpoint, filterModuleCategoryId]);

  const dragSort = useDragSort({
    endpoint,
    items: filteredItems,
    put,
    fetchItems,
    logger,
  });

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

      {endpoint === "/module-descriptions" && (
        <div className="flex flex-wrap gap-3 items-center border-b border-night-200 pb-4">
          <label className="text-sm font-semibold text-night-700">Категория:</label>
          <select
            value={filterModuleCategoryId}
            onChange={(e) => {
              const nextId = e.target.value;
              setFilterModuleCategoryId(nextId);
              setEditingId(null);
              const cat = availableModuleCategories.find((c) => String(c.id) === String(nextId)) || null;
              const prefix = (cat?.sku_prefix ? String(cat.sku_prefix) : "").trim().toUpperCase();
              const fallbackCode = String(cat?.code || "").toLowerCase();
              const fallbackPrefix = fallbackCode === "bottom" ? "НМ" : fallbackCode === "top" ? "ВМ" : "";
              const nextPrefix = prefix || fallbackPrefix;

              setForm({
                base_sku: nextPrefix,
                name: "",
              });
            }}
            className="px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          >
            <option value="">Выберите категорию...</option>
            {availableModuleCategories
              .slice()
              .sort((a, b) => Number(a.id) - Number(b.id))
              .map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
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

      <form className="grid gap-4 md:grid-cols-2 items-start" onSubmit={handleSubmit}>
        {endpoint === "/kit-solutions" && (
          <div className="md:col-span-2 space-y-3 border border-night-200 rounded-lg p-4 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-night-900">Состав модулей</h3>
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
                    .filter((m) => {
                      const baseSku = String(m.base_sku || "");
                      if (baseSku.startsWith("Н")) return true;
                      const cat = availableModuleCategories.find((c) => c.id === Number(m.module_category_id));
                      return cat?.code === "bottom";
                    })
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
                    .filter((m) => {
                      const baseSku = String(m.base_sku || "");
                      if (baseSku.startsWith("В")) return true;
                      const cat = availableModuleCategories.find((c) => c.id === Number(m.module_category_id));
                      return cat?.code === "top";
                    })
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

        <EntityFormFields
          endpoint={endpoint}
          filterModuleCategoryId={filterModuleCategoryId}
          currentFields={currentFields}
          form={form}
          setForm={setForm}
          handleUpload={handleUpload}
          uploadingField={uploadingField}
          availableModuleCategories={availableModuleCategories}
          colors={colors}
          collections={collections}
          availableModuleDescriptions={availableModuleDescriptions}
          selectedCategoryPrefix={selectedCategoryPrefix}
          sizePresetTabByField={sizePresetTabByField}
          setSizePresetTabByField={setSizePresetTabByField}
          sizePresetsByField={sizePresetsByField}
          setSizePresetsByField={setSizePresetsByField}
          getSizePresetStorageKey={getSizePresetStorageKey}
        />

        <div className="md:col-span-2">
          <HeroWorksMediaSection
            endpoint={endpoint}
            editingId={editingId}
            existingMedia={heroWorksMedia.existingMedia}
            mediaLoading={heroWorksMedia.mediaLoading}
            pendingMediaPreviewUrls={heroWorksMedia.pendingMediaPreviewUrls}
            pendingMediaFiles={heroWorksMedia.pendingMediaFiles}
            openMediaModal={heroWorksMedia.openMediaModal}
            deleteExistingMediaItem={heroWorksMedia.deleteExistingMediaItem}
            setExistingMediaPreview={heroWorksMedia.setExistingMediaPreview}
            removePendingMediaFile={heroWorksMedia.removePendingMediaFile}
            setPendingPreview={heroWorksMedia.setPendingPreview}
          />
        </div>

        <div className="md:col-span-2 flex gap-3">
          <SecureButton
            type="submit"
            disabled={
              (!editingId && heroWorksMedia.requireMediaForCreate && !heroWorksMedia.hasPendingMedia) ||
              heroWorksMedia.mediaUploading
            }
            className="px-6 py-3 flex items-center gap-2"
          >
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

      <EntityTable
        items={filteredItems}
        loading={loading}
        normalizedFields={normalizedFields}
        colors={colors}
        onEdit={handleEdit}
        onDelete={handleDelete}
        dragSort={dragSort}
      />

      <HeroWorksMediaModal
        endpoint={endpoint}
        editingId={editingId}
        mediaModalOpen={heroWorksMedia.mediaModalOpen}
        closeMediaModal={heroWorksMedia.closeMediaModal}
        onMediaInputChange={heroWorksMedia.onMediaInputChange}
        modalMediaPreviewUrls={heroWorksMedia.modalMediaPreviewUrls}
        mediaModalFiles={heroWorksMedia.mediaModalFiles}
        mediaUploading={heroWorksMedia.mediaUploading}
        removeMediaModalFile={heroWorksMedia.removeMediaModalFile}
        setMediaModalPreview={heroWorksMedia.setMediaModalPreview}
        submitMediaModal={heroWorksMedia.submitMediaModal}
      />
    </section>
  );
};

export default EntityManager;

