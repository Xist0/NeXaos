import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  FaSave,
  FaTimes,
  FaArrowLeft,
  FaCheckCircle,
  FaSpinner,
  FaImage,
  FaCamera,
  FaCog,
  FaDollarSign,
  FaClipboardList,
  FaCalculator,
} from "react-icons/fa";
import ProductCharacteristicsEditor from "../../ProductCharacteristicsEditor";
import ColorSelectPair from "../../../ui/ColorSelectPair";
import useCatalogParameters from "../../../../hooks/useCatalogParameters";
import useMaterialsForSelect from "../../../../hooks/useMaterialsForSelect";
import {
  characteristicsFromApi,
  createEmptyCharacteristicsForm,
  normalizeCharacteristicsForSave,
  parseCharacteristicField,
} from "../../../../utils/characteristics";
import { MATERIAL_SELECT_SOURCE_TYPES } from "../../../../constants/productCharacteristics";
import ModuleCalculationTables from "./ModuleCalculationTables";
import SecureButton from "../../../ui/SecureButton";
import SecureInput from "../../../ui/SecureInput";
import SmallButton from "../../ui/SmallButton";
import useApi from "../../../../hooks/useApi";
import useLogger from "../../../../hooks/useLogger";
import ImageManager from "../../ImageManager";
import { formatCurrency } from "../../../../utils/format";
import { getThumbUrl } from "../../../../utils/image";
import PopoverSelect from "../../../ui/PopoverSelect";

const LazyImg = ({ src, alt, className, onError }) => {
  const holderRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) return;
    const el = holderRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setIsVisible(true));
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setIsVisible(true);
          obs.disconnect();
        }
      },
      { root: null, rootMargin: "50px", threshold: 0.01 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [isVisible]);

  return (
    <span ref={holderRef} className={className}>
      {isVisible && (
        <img
          src={src}
          alt={alt}
          className={className}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          onError={onError}
        />
      )}
    </span>
  );
};

const toOptionalInt = (value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const toOptionalNumber = (value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const toOptionalString = (value) => {
  if (value === null || value === undefined) return undefined;
  const str = String(value).trim();
  return str ? str : undefined;
};

const ModuleCreator = ({
  moduleId: initialModuleId = null,
  duplicateFromId = null,
  submitLabel = "Сохранить",
  fixedModuleCategoryId = null,
  fixedDescriptionId = null,
  onDone,
}) => {
  const { get, post, put } = useApi();
  const logger = useLogger();
  const getRef = useRef(get);
  const loggerRef = useRef(logger);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [isActive, setIsActive] = useState(false);

  // Реальный ID созданного модуля
  const [moduleId, setModuleId] = useState(initialModuleId);

  // Защита от двойного create при быстрых кликах/рендерах
  const createLockRef = useRef(false);
  const skuNonceRef = useRef(null);

  const [form, setForm] = useState({
    // UI-поля
    baseSku: "",
    description_id: null,
    module_category_id: "",

    collection_id: "",

    sku: "",
    name: "",
    short_desc: "",

    length_mm: "",
    depth_mm: "",
    height_mm: "",

    facade_color: "",
    corpus_color: "",

    primary_color_id: "",
    secondary_color_id: "",

    preview_url: null, // ставим из ImageManager
    final_price: "",

    characteristics: createEmptyCharacteristicsForm(),
  });

  const [selectedParameters, setSelectedParameters] = useState([]);
  const [selectedParameterCategories, setSelectedParameterCategories] = useState([]);
  const [calculatedPrice, setCalculatedPrice] = useState(null);

  const [fieldBreakdown, setFieldBreakdown] = useState({});
  const [hardwareMatrix, setHardwareMatrix] = useState({});

  const [referenceData, setReferenceData] = useState({
    baseSkus: [],
    colorsFacade: [],
    colorsCorpus: [],
    collections: [],
    moduleCategories: [],
    productParameters: [],
    productParameterCategories: [],
    isLoaded: false
  });
  const [isLoadingReferences, setIsLoadingReferences] = useState(true);

  useEffect(() => {
    getRef.current = get;
    loggerRef.current = logger;
  }, [get]);

  const [parameterTemplatesById, setParameterTemplatesById] = useState({});
  const templatesLoadingRef = useRef(new Set());

  const ensureParameterTemplatesLoaded = useCallback(
    async (parameterId) => {
      const id = Number(parameterId);
      if (!Number.isFinite(id) || id <= 0) return;
      if (parameterTemplatesById[String(id)]) return;
      if (templatesLoadingRef.current.has(id)) return;
      templatesLoadingRef.current.add(id);
      try {
        const res = await getRef.current("/product-parameter-value-templates", { limit: 200, parameterId: id });
        const list = Array.isArray(res?.data) ? res.data : [];
        setParameterTemplatesById((prev) => ({ ...prev, [String(id)]: list }));
      } catch (_e) {
        setParameterTemplatesById((prev) => ({ ...prev, [String(id)]: [] }));
      } finally {
        templatesLoadingRef.current.delete(id);
      }
    },
    [parameterTemplatesById]
  );

  useEffect(() => {
    if (!fixedModuleCategoryId) return;
    setForm((prev) => {
      const next = String(fixedModuleCategoryId);
      if (String(prev.module_category_id || "") === next) return prev;
      return {
        ...prev,
        module_category_id: next,
        baseSku: fixedDescriptionId ? prev.baseSku : "",
        description_id: fixedDescriptionId ? prev.description_id : null,
        sku: fixedDescriptionId ? prev.sku : "",
      };
    });
  }, [fixedModuleCategoryId, fixedDescriptionId]);

  const addParameter = (parameterId) => {
    const id = Number(parameterId);
    if (!Number.isFinite(id) || id <= 0) return;
    setSelectedParameters((prev) => {
      const idx = prev.findIndex((x) => Number(x.parameterId) === id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: Math.max(1, Number(next[idx].quantity || 1) + 1) };
        return next;
      }
      return [...prev, { parameterId: id, quantity: 1, value: "" }];
    });
  };

  const updateParameterQty = (index, qty) => {
    setSelectedParameters((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      const q = Number(qty);
      next[index] = { ...next[index], quantity: Number.isFinite(q) ? Math.max(1, Math.round(q)) : 1 };
      return next;
    });
  };

  const removeParameter = (index) => {
    setSelectedParameters((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const updateParameterValue = (index, value) => {
    setSelectedParameters((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], value: value === null || value === undefined ? "" : String(value) };
      return next;
    });
  };

  const applyTemplateToParameter = useCallback(({ parameterId, template }) => {
    const pid = Number(parameterId);
    if (!Number.isFinite(pid) || pid <= 0 || !template) return;
    const nextValue = template?.value ?? "";
    const nextQty = Number(template?.quantity) || 1;
    setSelectedParameters((prev) => {
      const idx = prev.findIndex((x) => Number(x?.parameterId) === pid);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], value: nextValue, quantity: nextQty };
        return next;
      }
      return [...prev, { parameterId: pid, quantity: nextQty, value: nextValue }];
    });
  }, []);

  const addParameterCategory = (categoryId) => {
    const id = Number(categoryId);
    if (!Number.isFinite(id) || id <= 0) return;
    setSelectedParameterCategories((prev) => {
      if (prev.some((x) => Number(x) === id)) return prev;
      return [...prev, id];
    });
  };

  const removeParameterCategory = (index) => {
    setSelectedParameterCategories((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const applyLoadedModuleToForm = useCallback((data) => {
    const sku = String(data?.sku || "");
    const skuParts = sku.split("-");
    const maybeNonce = skuParts[skuParts.length - 1];
    if (/^[a-z0-9]{4}$/i.test(maybeNonce)) {
      skuNonceRef.current = maybeNonce;
    }

    setForm((prev) => ({
      ...prev,
      baseSku: data.base_sku || "",
      description_id: data.description_id ?? null,
      module_category_id: data.module_category_id ?? "",
      collection_id: data.collection_id != null ? String(data.collection_id) : "",
      sku: data.sku || "",
      name: data.name || "",
      short_desc: data.short_desc || "",
      length_mm: data.length_mm != null ? String(data.length_mm) : prev.length_mm,
      depth_mm: data.depth_mm != null ? String(data.depth_mm) : prev.depth_mm,
      height_mm: data.height_mm != null ? String(data.height_mm) : prev.height_mm,
      facade_color: data.facade_color || "",
      corpus_color: data.corpus_color || "",
      primary_color_id: data.primary_color_id != null ? String(data.primary_color_id) : "",
      secondary_color_id: data.secondary_color_id != null ? String(data.secondary_color_id) : "",
      preview_url: data.preview_url || null,
      final_price: data.final_price != null ? String(data.final_price) : "",
      characteristics: characteristicsFromApi(data.characteristics),
    }));

    setIsActive(!!data.is_active);

    if (data.hardware_matrix && typeof data.hardware_matrix === "object" && !Array.isArray(data.hardware_matrix)) {
      setHardwareMatrix(data.hardware_matrix);
    }

    const params = Array.isArray(data.parameters) ? data.parameters : [];
    setSelectedParameters(
      params
        .map((p) => ({
          parameterId: Number(p.id),
          quantity: Number.isFinite(Number(p.quantity)) ? Number(p.quantity) : 1,
          value: p?.value === null || p?.value === undefined ? "" : String(p.value),
        }))
        .filter((x) => Number.isFinite(x.parameterId) && x.parameterId > 0)
    );

    const cats = Array.isArray(data.parameterCategories) ? data.parameterCategories : [];
    setSelectedParameterCategories(
      cats
        .map((c) => Number(c?.id))
        .filter((x) => Number.isFinite(x) && x > 0)
    );
  }, []);

  const isStepValid = useCallback(
    (s) => {
      switch (s) {
        case 1:
          return !!form.baseSku && !!form.description_id && !!form.module_category_id;
        case 2:
          return !!form.name?.trim() && !!form.module_category_id;
        case 3:
          return true;
        case 4:
          return true;
        case 5:
          return Number(form.final_price || 0) > 0;
        case 6:
          return Number(form.final_price || 0) > 0;
        default:
          return false;
      }
    },
    [form]
  );

  const saveModuleNow = useCallback(async () => {
    if (!moduleId) {
      loggerRef.current?.error("Нет moduleId. Сначала создайте модуль.");
      return;
    }

    if (!isStepValid(1) || !isStepValid(2) || !isStepValid(3)) {
      loggerRef.current?.error("Не заполнены обязательные поля (тип/размеры/цвет фасада).");
      return;
    }

    if (isActive) {
      if (!form.preview_url) {
        loggerRef.current?.error("Для активного товара нужно выбрать превью.");
        return;
      }
      if (!isStepValid(5)) {
        loggerRef.current?.error("Для активного товара цена должна быть > 0.");
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        name: String(form.name || "").trim(),
        sku: toOptionalString(form.sku),
        short_desc: form.short_desc ? String(form.short_desc) : null,
        preview_url: form.preview_url || null,

        characteristics: memoizedCharacteristics,

        base_sku: toOptionalString(form.baseSku),
        description_id: toOptionalInt(form.description_id),
        collection_id: toOptionalInt(form.collection_id),

        length_mm: toOptionalInt(form.length_mm),
        depth_mm: toOptionalInt(form.depth_mm),
        height_mm: toOptionalInt(form.height_mm),

        facade_color: form.facade_color || null,
        corpus_color: form.corpus_color || null,
        primary_color_id: toOptionalInt(form.primary_color_id),
        secondary_color_id: toOptionalInt(form.secondary_color_id),
        module_category_id: toOptionalInt(form.module_category_id),

        final_price: isActive ? toOptionalNumber(form.final_price) : toOptionalNumber(form.final_price) ?? 0,
        price: isActive ? toOptionalNumber(form.final_price) : toOptionalNumber(form.final_price) ?? 0,
        hardware_matrix: hardwareMatrix || {},
        is_active: !!isActive,

        parameters: selectedParameters.map((x) => ({ parameter_id: x.parameterId, quantity: x.quantity, value: x.value })),
        parameterCategories: selectedParameterCategories.map((id) => ({ category_id: id })),
      };

      await put(`/modules/${moduleId}`, payload);
      loggerRef.current?.info("Сохранено");
      onDone?.();
    } catch (e) {
      loggerRef.current?.error("Не удалось сохранить модуль", e);
    } finally {
      setLoading(false);
    }
  }, [form, isActive, isStepValid, moduleId, onDone, put, selectedParameterCategories, selectedParameters]);

  useEffect(() => {
    if (!initialModuleId) return;

    let active = true;
    setLoading(true);
    getRef.current(`/modules/${initialModuleId}`)
      .then((res) => {
        const data = res?.data;
        if (!active || !data) return;

        applyLoadedModuleToForm(data);
        setStep(2);
      })
      .catch((e) => {
        loggerRef.current?.error("Не удалось загрузить модуль для редактирования", e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applyLoadedModuleToForm, initialModuleId]);

  useEffect(() => {
    if (!duplicateFromId) return;

    let active = true;
    setLoading(true);
    getRef.current(`/modules/${duplicateFromId}`)
      .then((res) => {
        const data = res?.data;
        if (!active || !data) return;
        applyLoadedModuleToForm(data);

        // important: duplication must create a new module
        setModuleId(null);
        createLockRef.current = false;
        skuNonceRef.current = null;
        setStep(2);
      })
      .catch((e) => {
        loggerRef.current?.error("Не удалось загрузить модуль для создания копии", e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applyLoadedModuleToForm, duplicateFromId]);

  useEffect(() => {
    const loadReferencesOnce = async () => {
      if (referenceData.isLoaded) return;
      setIsLoadingReferences(true);
      try {
        const [descriptionsRes, allColorsRes, moduleCategoriesRes, collectionsRes, productParametersRes, productParameterCategoriesRes] = await Promise.all([
          getRef.current("/module-descriptions", { limit: 200 }),
          getRef.current("/colors", { limit: 500, isActive: true }),
          getRef.current("/module-categories", { limit: 200 }),
          getRef.current("/collections", { limit: 500, isActive: true }),
          getRef.current("/product-parameters", { limit: 500 }),
          getRef.current("/product-parameter-categories", { limit: 500 }),
        ]);

        const baseSkus = Array.isArray(descriptionsRes?.data)
          ? descriptionsRes.data.map((d) => ({
              id: d.id,
              code: d.base_sku,
              name: d.name || d.base_sku,
              description: d.description,
              module_category_id: d.module_category_id ?? null,
            }))
          : [];

        const allColors = Array.isArray(allColorsRes?.data) ? allColorsRes.data : [];
        // В colors нет type в entities.config.js, но в данных у тебя оно встречается — оставляем фильтр.
        const colorsFacade = allColors.filter((c) => c.type === "facade" || !c.type);
        const colorsCorpus = allColors.filter((c) => c.type === "corpus");

        const moduleCategories = Array.isArray(moduleCategoriesRes?.data) ? moduleCategoriesRes.data : [];
        const collections = Array.isArray(collectionsRes?.data) ? collectionsRes.data : [];
        const productParameters = Array.isArray(productParametersRes?.data) ? productParametersRes.data : [];
        const productParameterCategories = Array.isArray(productParameterCategoriesRes?.data) ? productParameterCategoriesRes.data : [];
        setReferenceData({
          baseSkus,
          colorsFacade,
          colorsCorpus,
          collections,
          moduleCategories,
          productParameters,
          productParameterCategories,
          isLoaded: true
        });
      } catch (e) {
        loggerRef.current?.error("Ошибка загрузки справочников:", e);
      } finally {
        setIsLoadingReferences(false);
      }
    };

    loadReferencesOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { sections: catalogSections, templatesByField, fieldLabels, allFieldKeys } = useCatalogParameters(get);
  const { materials: materialsData, getItemsForField } = useMaterialsForSelect(get);

  const materialsBySourceType = useMemo(() => {
    const map = {};
    for (const [, value] of Object.entries(MATERIAL_SELECT_SOURCE_TYPES)) {
      map[value] = getItemsForField(value);
    }
    return map;
  }, [materialsData, getItemsForField]);

  const fasteningItems = useMemo(() => {
    return (materialsBySourceType.hardware || [])
      .filter((item) => String(item.category || "").trim() === "Крепежная фурнитура")
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ru"));
  }, [materialsBySourceType.hardware]);

  const allColorsForPicker = useMemo(() => {
    const all = [...referenceData.colorsFacade, ...referenceData.colorsCorpus];
    return all.sort((a, b) => {
      const aU = a.type === "facade" || !a.type ? 0 : 1;
      const bU = b.type === "facade" || !b.type ? 0 : 1;
      return aU - bU || String(a.name || "").localeCompare(String(b.name || ""), "ru");
    });
  }, [referenceData.colorsFacade, referenceData.colorsCorpus]);

  const memoizedCharacteristics = useMemo(
    () => normalizeCharacteristicsForSave(form.characteristics),
    [form.characteristics]
  );

  useEffect(() => {
    if (!allFieldKeys?.length) return;
    setForm((prev) => ({
      ...prev,
      characteristics: characteristicsFromApi(prev.characteristics, allFieldKeys),
    }));
  }, [allFieldKeys]);

  const steps = useMemo(
    () => [
      { number: 1, title: "Тип", icon: FaCog },
      { number: 2, title: "Основное", icon: FaClipboardList },
      { number: 3, title: "Характеристики", icon: FaClipboardList },
      { number: 4, title: "Фото", icon: FaCamera },
      { number: 5, title: "Цена", icon: FaDollarSign },
    ],
    []
  );

  const moduleCategoryItems = useMemo(() => {
    return (referenceData.moduleCategories || [])
      .slice()
      .sort((a, b) => Number(a.id) - Number(b.id));
  }, [referenceData.moduleCategories]);

  const collectionItems = useMemo(() => {
    return (referenceData.collections || [])
      .slice()
      .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "ru"));
  }, [referenceData.collections]);

  const productParameterItems = useMemo(() => {
    return (referenceData.productParameters || [])
      .slice()
      .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "ru"));
  }, [referenceData.productParameters]);

  const productParameterCategoryItems = useMemo(() => {
    return (referenceData.productParameterCategories || [])
      .slice()
      .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "ru"));
  }, [referenceData.productParameterCategories]);

  const buildSku = useCallback((draft, characteristics) => {
    const parts = [draft.baseSku];
    const len = Number(draft.length_mm);
    if (Number.isFinite(len) && len > 0) parts.push(String(Math.round(len)));
    const facadeVal = characteristics ? parseCharacteristicField(characteristics.facade_color).value : draft.facade_color;
    if (facadeVal) parts.push(facadeVal);

    if (!skuNonceRef.current) {
      const fromSku = String(draft.sku || "").split("-").pop();
      if (/^[a-z0-9]{4}$/i.test(fromSku)) {
        skuNonceRef.current = fromSku;
      } else {
        skuNonceRef.current = Math.random().toString(36).substring(2, 6);
      }
    }

    parts.push(skuNonceRef.current);
    return parts.filter(Boolean).join("-");
  }, []);

  useEffect(() => {
    if (!fixedDescriptionId || !referenceData.isLoaded) return;
    const baseSku = referenceData.baseSkus.find((d) => Number(d.id) === Number(fixedDescriptionId));
    if (!baseSku) return;

    setForm((prev) => {
      if (Number(prev.description_id) === Number(baseSku.id) && prev.baseSku === baseSku.code) return prev;
      const initialSku = buildSku({ baseSku: baseSku.code, length_mm: prev.length_mm || "" }, prev.characteristics);
      return {
        ...prev,
        baseSku: baseSku.code,
        description_id: baseSku.id,
        module_category_id: String(fixedModuleCategoryId || baseSku.module_category_id || prev.module_category_id || ""),
        sku: prev.sku || initialSku,
        name: prev.name || `${baseSku.name}`,
      };
    });
  }, [fixedDescriptionId, fixedModuleCategoryId, referenceData.isLoaded, referenceData.baseSkus, initialModuleId, duplicateFromId, buildSku]);

  const handleTypeSelect = (baseSku) => {
    const initialSku = buildSku({ baseSku: baseSku.code, length_mm: "" }, form.characteristics);

    const categories = Array.isArray(referenceData.moduleCategories) ? referenceData.moduleCategories : [];
    const skuPrefix = String(baseSku.code || "").trim().toUpperCase();
    const inferredCategoryId = form.module_category_id
      ? Number(form.module_category_id)
      : categories.find((c) => {
          const prefix = String(c?.sku_prefix || "").trim().toUpperCase();
          if (!prefix) return false;
          return skuPrefix.startsWith(prefix);
        })?.id;

    setForm((prev) => {
      const next = {
        ...prev,
        baseSku: baseSku.code,
        description_id: baseSku.id,
        module_category_id:
          prev.module_category_id ||
          inferredCategoryId ||
          baseSku.module_category_id ||
          prev.module_category_id,
        sku: initialSku,
        name: `${baseSku.name}`,
        length_mm: "",
        depth_mm: "",
        height_mm: ""
      };
      // Auto-fill product_type from baseSKU name
      const chars = { ...prev.characteristics };
      const currentProductType = parseCharacteristicField(chars.product_type);
      chars.product_type = { ...currentProductType, value: baseSku.name || baseSku.code };
      next.characteristics = chars;
      return next;
    });
    setStep(2);
  };

  

  const handleDimensionChange = (value, field) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "length_mm") {
        next.sku = buildSku(next, next.characteristics);
      }
      return next;
    });
  };

  // Синхронизация form.facade_color и form.corpus_color из характеристик
  // (для SKU, фильтрации поиска на бэкенде)
  // + primary_color_id / secondary_color_id — только SET при совпадении, NEVER CLEAR
  useEffect(() => {
    const facadeVal = parseCharacteristicField(form.characteristics.facade_color).value;
    const corpusVal = parseCharacteristicField(form.characteristics.corpus_color).value;
    const allColors = [...referenceData.colorsFacade, ...referenceData.colorsCorpus];
    const primaryColor = allColors.find((c) => c.name === facadeVal || c.code === facadeVal || c.sku === facadeVal);
    const secondaryColor = allColors.find((c) => c.name === corpusVal || c.code === corpusVal || c.sku === corpusVal);
    setForm((prev) => {
      const next = {};
      if (prev.facade_color !== facadeVal) next.facade_color = facadeVal || "";
      if (prev.corpus_color !== corpusVal) next.corpus_color = corpusVal || "";
      if (primaryColor && prev.primary_color_id !== String(primaryColor.id)) next.primary_color_id = String(primaryColor.id);
      if (secondaryColor && prev.secondary_color_id !== String(secondaryColor.id)) next.secondary_color_id = String(secondaryColor.id);
      if (Object.keys(next).length === 0) return prev;
      return { ...prev, ...next };
    });
  }, [form.characteristics.facade_color, form.characteristics.corpus_color, referenceData.colorsFacade, referenceData.colorsCorpus]);

  // ВАЖНО: создаем модуль сразу перед шагом "Фото", чтобы получить числовой ID для images.
  const createModuleIfNeeded = useCallback(async () => {
    if (moduleId) return moduleId;
    if (createLockRef.current) return null;

    if (!isStepValid(1) || !isStepValid(2) || !isStepValid(3)) {
      logger.error("Нельзя перейти к фото: не заполнены тип/размеры/цвет фасада.");
      return null;
    }

    createLockRef.current = true;
    setLoading(true);

    try {
      // Собираем payload строго по columns modules.
      const payload = {
        name: String(form.name || "").trim(),
        sku: toOptionalString(form.sku),
        short_desc: form.short_desc ? String(form.short_desc) : null,
        preview_url: form.preview_url || null,

        characteristics: memoizedCharacteristics,

        base_sku: toOptionalString(form.baseSku),
        description_id: toOptionalInt(form.description_id),

        collection_id: toOptionalInt(form.collection_id),

        length_mm: toOptionalInt(form.length_mm),
        depth_mm: toOptionalInt(form.depth_mm),
        height_mm: toOptionalInt(form.height_mm),

        facade_color: form.facade_color || null,
        corpus_color: form.corpus_color || null,

        primary_color_id: toOptionalInt(form.primary_color_id),
        secondary_color_id: toOptionalInt(form.secondary_color_id),

        // цена будет установлена позже
        final_price: 0,
        price: 0,

        // чтобы модуль не светился до финального шага
        is_active: false,
        hardware_matrix: hardwareMatrix || {},

        parameters: selectedParameters.map((x) => ({ parameter_id: x.parameterId, quantity: x.quantity, value: x.value })),
        parameterCategories: selectedParameterCategories.map((id) => ({ category_id: id })),

        // если у тебя это обязательно на UI — оставляем
        module_category_id: toOptionalInt(form.module_category_id)
      };

      // При create schema требуются только "name". Остальное опционально.
      const resp = await post("/modules", payload);
      const id = resp?.data?.id;
      if (!id) throw new Error("API не вернул id при создании модуля");

      setModuleId(id);
      logger.info("Модуль создан (до цены), id:", id);
      return id;
    } catch (e) {
      logger.error("Ошибка создания модуля:", e?.response?.data || e?.message || e);
      return null;
    } finally {
      setLoading(false);
      createLockRef.current = false;
    }
  }, [form, isStepValid, logger, moduleId, post]);

  const goToPhotos = async () => {
    const id = await createModuleIfNeeded();
    if (!id) return;
    setStep(4);
  };

  const goToPrice = async () => {
    // На всякий: если пользователь как-то попал сюда без id
    const id = await createModuleIfNeeded();
    if (!id) return;
    setStep(5);
  };

  const finalizeModule = async () => {
    if (!moduleId) {
      logger.error("Нет moduleId. Сначала создайте модуль.");
      return;
    }
    if (!isStepValid(5)) {
      logger.error("Цена должна быть > 0.");
      return;
    }
    if (!form.preview_url) {
      logger.error("Выберите превью (клик по фото → сделать превью).");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: String(form.name || "").trim(),
        sku: toOptionalString(form.sku),
        short_desc: form.short_desc ? String(form.short_desc) : null,
        preview_url: form.preview_url,

        characteristics: memoizedCharacteristics,

        base_sku: toOptionalString(form.baseSku),
        description_id: toOptionalInt(form.description_id),

        collection_id: toOptionalInt(form.collection_id),

        length_mm: toOptionalInt(form.length_mm),
        depth_mm: toOptionalInt(form.depth_mm),
        height_mm: toOptionalInt(form.height_mm),

        facade_color: form.facade_color || null,
        corpus_color: form.corpus_color || null,
        primary_color_id: toOptionalInt(form.primary_color_id),
        secondary_color_id: toOptionalInt(form.secondary_color_id),

        module_category_id: toOptionalInt(form.module_category_id),

        final_price: toOptionalNumber(form.final_price),
        price: toOptionalNumber(form.final_price),
        hardware_matrix: hardwareMatrix || {},
        is_active: true,

        parameters: selectedParameters.map((x) => ({ parameter_id: x.parameterId, quantity: x.quantity, value: x.value })),
        parameterCategories: selectedParameterCategories.map((id) => ({ category_id: id })),
      };

      const resp = await put(`/modules/${moduleId}`, payload);
      logger.info("Модуль сохранен и опубликован:", resp?.data);

      onDone?.();

      // сброс
      setForm({
        baseSku: "",
        description_id: null,
        module_category_id: "",

        collection_id: "",
        sku: "",
        name: "",
        short_desc: "",
        length_mm: "",
        depth_mm: "",
        height_mm: "",
        facade_color: "",
        corpus_color: "",
        primary_color_id: "",
        secondary_color_id: "",
        preview_url: null,
        final_price: ""
      });
      setSelectedParameters([]);
      setSelectedParameterCategories([]);
      setModuleId(null);
      setHardwareMatrix({});
      setFieldBreakdown({});
      setStep(1);
    } catch (e) {
      logger.error("Ошибка сохранения модуля:", e?.response?.data || e?.message || e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    // Внимание: если moduleId уже создан и ты нажмешь reset — останется “висячий” неактивный модуль.
    // Если хочешь “чисто”, нужен DELETE /modules/:id (но ты это не просил).
    setForm({
      baseSku: "",
      description_id: null,
      module_category_id: "",

      collection_id: "",
      sku: "",
      name: "",
      short_desc: "",
      length_mm: "",
      depth_mm: "",
      height_mm: "",
      facade_color: "",
      corpus_color: "",
      primary_color_id: "",
      secondary_color_id: "",
      preview_url: null,
      final_price: "",

      characteristics: createEmptyCharacteristicsForm(),
    });
    setModuleId(null);
    setHardwareMatrix({});
    setFieldBreakdown({});
    setStep(1);
  };

  if (isLoadingReferences) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="glass-card p-16 text-center">
          <FaSpinner className="w-16 h-16 text-accent animate-spin mx-auto mb-8" />
          <div className="text-2xl font-bold text-night-900 mb-4">Загружаем справочники</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-night-900">Модуль</div>
            <div className="text-xs text-night-500">ID: {moduleId || "—"}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {initialModuleId ? (
              <SecureButton
                type="button"
                onClick={saveModuleNow}
                className="px-3 py-2 text-xs flex items-center gap-2"
                disabled={!moduleId || loading}
              >
                {loading ? <FaSpinner className="animate-spin" /> : <FaSave />} Сохранить
              </SecureButton>
            ) : null}
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <SecureButton
                  key={s.number}
                  type="button"
                  variant={step === s.number ? "primary" : "outline"}
                  className="px-3 py-2 text-xs flex items-center gap-2"
                  onClick={() => {
                    if (s.number === 4) return;
                    if (s.number === 5) return;
                    setStep(s.number);
                  }}
                >
                  <Icon /> {s.number}. {s.title}
                </SecureButton>
              );
            })}
          </div>
        </div>
      </div>

      <div className="glass-card p-8">

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-8">
            {!form.module_category_id ? (
              <>
                <div className="text-2xl font-bold text-night-900 text-center mb-8">
                  Сначала выберите категорию модуля ({(referenceData.moduleCategories || []).length})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(referenceData.moduleCategories || [])
                    .slice()
                    .sort((a, b) => Number(a.id) - Number(b.id))
                    .map((c) => (
                      <div
                        key={c.id}
                        className="group glass-card p-8 hover:shadow-2xl hover:scale-[1.02] cursor-pointer transition-all border-2 border-transparent hover:border-accent rounded-3xl"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            module_category_id: String(c.id),
                            baseSku: "",
                            description_id: null,
                            sku: "",
                            name: "",
                          }))
                        }
                      >
                        <div className="w-20 h-20 p-2 bg-gradient-to-br from-accent/10 to-accent-dark/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-accent/20">
                          <span className="text-lg font-semibold text-accent group-hover:scale-110 break-words text-center leading-tight">
                            {c.sku_prefix ? String(c.sku_prefix).toUpperCase() : "?"}
                          </span>
                        </div>
                        <h3 className="font-semibold text-lg text-night-900 mb-1 group-hover:text-accent break-words leading-snug">
                          {c.name}
                        </h3>
                        {c.sku_prefix ? (
                          <div className="text-night-600 text-sm">Сокращение: {String(c.sku_prefix).toUpperCase()}</div>
                        ) : (
                          <div className="text-night-600 text-sm">Сокращение не задано</div>
                        )}
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-4 mb-8">
                  {!fixedModuleCategoryId && (
                    <button
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          module_category_id: "",
                          baseSku: "",
                          description_id: null,
                          sku: "",
                          name: "",
                        }))
                      }
                      className="flex items-center gap-2 text-night-600 hover:text-night-900 p-3 -m-3 rounded-xl hover:bg-night-100"
                    >
                      <FaArrowLeft /> Сменить категорию
                    </button>
                  )}
                  <div className="flex-1 border-b-4 border-accent" />
                </div>

                <div className="text-2xl font-bold text-night-900 text-center mb-12">
                  Теперь выберите подтип ({referenceData.baseSkus.length})
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {referenceData.baseSkus
                    .filter((d) =>
                      d?.module_category_id != null
                        ? Number(d.module_category_id) === Number(form.module_category_id)
                        : false
                    )
                    .map((baseSku) => (
                      <div
                        key={baseSku.id}
                        className="group glass-card p-8 hover:shadow-2xl hover:scale-[1.02] cursor-pointer transition-all border-2 border-transparent hover:border-accent rounded-3xl"
                        onClick={() => handleTypeSelect(baseSku)}
                      >
                        <div className="w-20 h-20 p-2 bg-gradient-to-br from-accent/10 to-accent-dark/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-accent/20">
                          <span className="text-lg font-semibold text-accent group-hover:scale-110 break-words text-center leading-tight">
                            {baseSku.code}
                          </span>
                        </div>
                        <h3 className="font-medium text-sm text-night-900 mb-2 group-hover:text-accent break-words leading-snug">
                          {baseSku.name}
                        </h3>
                        {baseSku.description && <p className="text-night-600 text-sm break-words">{baseSku.description}</p>}
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2 — Основное */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
              <div>
                <label className="block text-sm font-semibold text-night-700 mb-2">Название</label>
                <SecureInput
                  value={form.name || ""}
                  onChange={(v) => setForm((prev) => ({ ...prev, name: v }))}
                  placeholder="B100 800мм"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-night-700 mb-2">baseSKU</label>
                <SecureInput value={form.baseSku || ""} onChange={() => {}} disabled placeholder="Выбран на шаге «Тип»" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-night-700 mb-2">SKU</label>
                <SecureInput value={form.sku || ""} onChange={() => {}} disabled />
              </div>
              <div>
                <label className="block text-sm font-semibold text-night-700 mb-2">Коллекция</label>
                <PopoverSelect
                  items={collectionItems}
                  value={form.collection_id ?? ""}
                  placeholder="Не выбрана"
                  allowClear
                  clearLabel="Не выбрана"
                  searchable={collectionItems.length > 8}
                  getKey={(c) => String(c.id)}
                  getLabel={(c) => String(c?.name || "")}
                  onChange={(next) => setForm((prev) => ({ ...prev, collection_id: String(next || "") }))}
                  buttonClassName="h-11 px-4"
                  popoverClassName="max-w-xl"
                  maxHeightClassName="max-h-80"
                />
              </div>
            </div>

            <div className="max-w-3xl">
              <label className="block text-sm font-semibold text-night-700 mb-2">Описание</label>
              <textarea
                ref={(el) => {
                  if (!el) return;
                  el.style.height = "auto";
                  el.style.height = Math.max(el.scrollHeight, 48) + "px";
                }}
                value={form.short_desc}
                onChange={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = Math.max(e.target.scrollHeight, 48) + "px";
                  setForm((prev) => ({ ...prev, short_desc: e.target.value }));
                }}
                placeholder="Описание модуля..."
                className="w-full px-4 py-2 border border-night-200 rounded-xl bg-white text-night-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent min-h-[48px] overflow-hidden resize-none"
                rows={1}
              />
            </div>

            <div className="flex justify-between pt-8 border-t">
              <SecureButton type="button" variant="outline" onClick={() => setStep(1)} className="px-4 py-2 flex items-center gap-2">
                <FaArrowLeft /> Назад
              </SecureButton>
              <SecureButton type="button" onClick={() => setStep(3)} className="px-4 py-2" disabled={!isStepValid(2)}>
                Далее
              </SecureButton>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <ProductCharacteristicsEditor
              value={form.characteristics}
              onChange={(next) => setForm((prev) => ({ ...prev, characteristics: next }))}
              templatesByField={templatesByField}
              fieldLabels={fieldLabels}
              materialsBySourceType={materialsBySourceType}
              fieldBreakdown={fieldBreakdown}
            />

            <ColorSelectPair
              colors={allColorsForPicker}
              primaryColorId={form.primary_color_id}
              secondaryColorId={form.secondary_color_id}
              onPrimaryChange={(id) => setForm((prev) => ({ ...prev, primary_color_id: String(id) }))}
              onSecondaryChange={(id) => setForm((prev) => ({ ...prev, secondary_color_id: String(id) }))}
              sectionLabel="Цвет изделия"
            />
            <ModuleCalculationTables
              form={form}
              characteristics={memoizedCharacteristics}
              post={post}
              onAreasCalculated={(areas) => {
                setForm((prev) => {
                  const chars = { ...prev.characteristics };
                  let changed = false;
                  for (const [key, val] of Object.entries(areas)) {
                    const current = parseCharacteristicField(chars[key]);
                    if (current.value !== val) {
                      chars[key] = { ...current, value: val };
                      changed = true;
                    }
                  }
                  if (!changed) return prev;
                  return { ...prev, characteristics: chars };
                });
              }}
              onFieldBreakdown={(fb) => setFieldBreakdown(fb)}
              onPriceCalculated={(price) => {
                setCalculatedPrice(price);
                setForm((prev) => {
                  if (prev.final_price) return prev;
                  return { ...prev, final_price: String(price) };
                });
              }}
              hardwareMatrix={hardwareMatrix}
              onHardwareMatrixChange={setHardwareMatrix}
              fasteningItems={fasteningItems}
            />
            <div className="flex justify-between pt-4 border-t">
              <SecureButton type="button" variant="outline" onClick={() => setStep(2)} className="px-4 py-2 flex items-center gap-2">
                <FaArrowLeft /> Назад
              </SecureButton>
              <SecureButton type="button" onClick={goToPhotos} className="px-4 py-2" disabled={loading}>
                Далее
              </SecureButton>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-8">
            <div className="text-center mb-10">
              <h3 className="text-2xl font-bold text-night-900 mb-2">Фото и превью</h3>
              <div className="text-night-600">
                {moduleId ? (
                  <>
                    ID модуля: <span className="text-accent font-mono">{moduleId}</span>
                  </>
                ) : (
                  "Создаем модуль..."
                )}
              </div>
              <div className="text-night-600 mt-2">
                Превью обязательно: выбери одно фото как превью перед сохранением.
              </div>
            </div>

            {moduleId ? (
              <ImageManager
                entityType="modules"
                entityId={moduleId}
                onUpdate={() => {}}
                onPreviewUpdate={(previewUrl) => {
                  setForm((prev) => ({ ...prev, preview_url: previewUrl || null, previewCacheBust: Date.now() }));
                }}
              />
            ) : (
              <div className="text-center py-16">
                <FaSpinner className="w-12 h-12 text-accent animate-spin mx-auto mb-4" />
                <div className="text-night-700">Ожидание создания модуля…</div>
              </div>
            )}

            <div className="flex justify-between pt-8 border-t">
              <SecureButton type="button" variant="outline" onClick={() => setStep(3)} className="px-4 py-2 flex items-center gap-2">
                <FaArrowLeft /> Назад
              </SecureButton>
              <SecureButton type="button" onClick={goToPrice} className="px-4 py-2" disabled={!moduleId || loading}>
                Далее
              </SecureButton>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-12">

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-6 p-8 bg-gradient-to-br from-night-50 rounded-3xl border-2 border-night-200">
                <h3 className="text-xl font-bold text-night-900">Итог</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-night-600">SKU</div>
                    <div className="font-bold text-2xl text-accent">{form.sku}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="font-bold text-xl">{form.length_mm}мм</div>
                      <div className="text-night-500 text-xs">Длина</div>
                    </div>
                    <div>
                      <div className="font-bold text-xl">{form.depth_mm}мм</div>
                      <div className="text-night-500 text-xs">Глубина</div>
                    </div>
                    <div>
                      <div className="font-bold text-xl">{form.height_mm}мм</div>
                      <div className="text-night-500 text-xs">Высота</div>
                    </div>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="text-night-600">Превью</div>
                    {form.preview_url ? (
                      <img
                        key={form.preview_url}
                        src={getThumbUrl(form.preview_url, { w: 420, h: 252, q: 70, fit: "cover", cacheBust: form.previewCacheBust || undefined })}
                        alt="Превью модуля"
                        className="mt-2 rounded-xl object-cover w-full max-w-[280px] h-[168px] shadow-md"
                        onError={(e) => { e.target.src = ""; e.target.alt = "не выбрано"; }}
                      />
                    ) : (
                      <div className="text-night-400 text-sm">не выбрано</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-8 p-8 bg-white rounded-3xl border-2 border-accent shadow-2xl">
                <h3 className="text-xl font-bold text-night-900">Цена</h3>
                <SecureInput
                  type="number"
                  value={form.final_price || ""}
                  onChange={(v) => setForm((prev) => ({ ...prev, final_price: v }))}
                  min={0}
                  step="100"
                  placeholder="15000"
                  className="text-4xl font-bold text-right !pr-12"
                />
                {calculatedPrice != null && Number(form.final_price || 0) !== calculatedPrice ? (
                  <div className="flex items-center gap-3 justify-end">
                    <span className="text-xs text-night-500">
                      Расчётная цена: {formatCurrency(calculatedPrice)}
                    </span>
                    <SecureButton
                      type="button"
                      variant="outline"
                      onClick={() => setForm((prev) => ({ ...prev, final_price: String(calculatedPrice) }))}
                      className="px-3 py-1.5 text-xs flex items-center gap-1"
                    >
                      <FaCalculator /> Применить расчётную цену
                    </SecureButton>
                  </div>
                ) : null}
                {!form.preview_url && (
                  <div className="p-4 rounded-2xl bg-yellow-50 border border-yellow-200 text-yellow-800">
                    Сначала выбери превью на шаге “Фото”, иначе сохранение будет заблокировано.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-8 border-t">
              <SecureButton type="button" variant="outline" onClick={() => setStep(4)} className="px-4 py-2 flex items-center gap-2">
                <FaArrowLeft /> Назад
              </SecureButton>
              <SecureButton type="button" onClick={finalizeModule} className="px-4 py-2" disabled={!moduleId || !isStepValid(5) || !form.preview_url || loading}>
                {loading ? <FaSpinner className="animate-spin mr-2" /> : <FaSave className="mr-2" />} {submitLabel}
              </SecureButton>
            </div>

            <div className="flex justify-center pt-10">
              <SecureButton
                type="button"
                variant="ghost"
                onClick={handleReset}
                className="px-16 py-4 h-16 text-xl text-red-600 hover:bg-red-50 font-semibold border-2 border-red-200"
                disabled={loading}
              >
                <FaTimes className="mr-3" />
                Сброс
              </SecureButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModuleCreator;
