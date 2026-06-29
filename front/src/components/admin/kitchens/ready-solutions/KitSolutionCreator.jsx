import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaArrowLeft,
  FaCamera,
  FaCheckCircle,
  FaCog,
  FaDollarSign,
  FaImage,
  FaRulerCombined,
  FaSave,
  FaSpinner,
  FaClipboardList,
} from "react-icons/fa";
import SecureButton from "../../../ui/SecureButton";
import SecureInput from "../../../ui/SecureInput";
import SmallButton from "../../ui/SmallButton";
import useApi from "../../../../hooks/useApi";
import useLogger from "../../../../hooks/useLogger";
import ImageManager from "../../ImageManager";
import { formatCurrency } from "../../../../utils/format";
import FormField from "../../../ui/FormField";
import FormSelect from "../../../ui/FormSelect";
import ProductCharacteristicsEditor from "../../ProductCharacteristicsEditor";
import useCatalogParameters from "../../../../hooks/useCatalogParameters";
import useMaterialsForSelect from "../../../../hooks/useMaterialsForSelect";
import {
  createEmptyCharacteristicsForm,
  getCharacteristicDimensions,
  mergeEntityDimensionsIntoCharacteristics,
  normalizeCharacteristicsForSave,
  parseCharacteristicField,
} from "../../../../utils/characteristics";

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

const resolveKitDimensions = (form) => {
  const fromChar = getCharacteristicDimensions(form.characteristics);
  return {
    total_length_mm: Number(fromChar.length_mm ?? form.total_length_mm) || null,
    total_depth_mm: Number(fromChar.depth_mm ?? form.total_depth_mm) || null,
    total_height_mm: Number(fromChar.height_mm ?? form.total_height_mm) || null,
  };
};

let colorsCache = null;
let colorsCachePromise = null;
let collectionsCache = null;
let collectionsCachePromise = null;
let productParametersCache = null;
let productParametersCachePromise = null;
let productParameterCategoriesCache = null;
let productParameterCategoriesCachePromise = null;

const KitSolutionCreator = ({ kitSolutionId: initialKitSolutionId = null, duplicateFromId = null, submitLabel = "Сохранить", fixedValues = null, onDone }) => {
  const { get, post, put } = useApi();
  const logger = useLogger();

  const categoryGroupLabel = String(fixedValues?.category_group || "").trim();
  const isKitchen = /^\s*(кух|kitchen)/i.test(categoryGroupLabel);

  const getRef = useRef(get);
  const loggerRef = useRef(logger);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [kitId, setKitId] = useState(initialKitSolutionId);
  const createLockRef = useRef(false);
  const skuNonceRef = useRef(null);

  const [referenceData, setReferenceData] = useState({
    kitchenTypes: [],
    materials: [],
    colors: [],
    collections: [],
    modules: [],
    moduleCategories: [],
    catalogItems: [],
    productParameters: [],
    productParameterCategories: [],
    isLoaded: false,
  });

  const [form, setForm] = useState({
    baseSku: "",
    sku: "",
    name: "",
    description: "",

    kitchen_type_id: "",
    material_id: "",
    collection_id: "",

    // размеры
    total_length_mm: "",
    total_depth_mm: "",
    total_height_mm: "",
    countertop_length_mm: "",
    countertop_depth_mm: "",

    preview_url: null,
    final_price: "",
    is_active: false,

    characteristics: createEmptyCharacteristicsForm(),
  });

  const [selectedModulesByType, setSelectedModulesByType] = useState({
    bottom: [],
    top: [],
  });

  const [selectedCatalogItems, setSelectedCatalogItems] = useState([]);
  const [selectedParameters, setSelectedParameters] = useState([]);
  const [selectedParameterCategories, setSelectedParameterCategories] = useState([]);

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

  const getEffectiveSku = useCallback(() => {
    const explicit = String(form.sku || "").trim();
    if (explicit) return explicit;

    const normalizeSkuPart = (value) => {
      const s = String(value ?? "").trim();
      if (!s) return "";
      return s
        .replace(/\s+/g, "")
        .replace(/[-–—]+/g, "")
        .replace(/[\\/]+/g, "")
        .trim();
    };
    const normalizeNum = (value) => {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return "";
      return String(Math.round(n));
    };

    const articleName = String(form.baseSku || "").trim() || String(form.name || "").trim();
    const colors = Array.isArray(referenceData.colors) ? referenceData.colors : [];
    const facadeVal = parseCharacteristicField(form.characteristics.facade_color).value;
    const corpusVal = parseCharacteristicField(form.characteristics.corpus_color).value;
    const primary = colors.find((c) => c.name === facadeVal || c.code === facadeVal || c.sku === facadeVal);
    const secondary = colors.find((c) => c.name === corpusVal || c.code === corpusVal || c.sku === corpusVal);
    const dims = getCharacteristicDimensions(form.characteristics);

    const parts = [
      normalizeSkuPart(articleName),
      normalizeNum(dims.length_mm ?? form.total_length_mm),
      normalizeNum(dims.depth_mm ?? form.total_depth_mm),
      normalizeNum(dims.height_mm ?? form.total_height_mm),
      normalizeSkuPart(primary?.sku || ""),
      normalizeSkuPart(secondary?.sku || ""),
    ].filter(Boolean);

    return parts.length ? parts.join("-") : "";
  }, [form.baseSku, form.characteristics, form.name, form.sku, form.total_depth_mm, form.total_height_mm, form.total_length_mm, referenceData.colors]);

  const getKitPayloadParts = useCallback(() => {
    const moduleIds = ["bottom", "top"]
      .flatMap((type) =>
        (selectedModulesByType[type] || []).flatMap((m) => Array(Math.max(1, Number(m.quantity) || 1)).fill(Number(m.moduleId)))
      )
      .filter((v) => Number.isFinite(v));

    const moduleItems = [];
    let pos = 0;
    for (const type of ["bottom", "top"]) {
      for (const m of selectedModulesByType[type] || []) {
        const qty = Math.max(1, Number(m.quantity) || 1);
        const baseUid = m.positionUid || `tmp-${type}-${pos}`;
        for (let k = 0; k < qty; k++) {
          moduleItems.push({
            moduleId: Number(m.moduleId),
            positionUid: k === 0 ? baseUid : `${baseUid}-${k}`,
            positionType: type,
            positionOrder: pos,
          });
          pos++;
        }
      }
    }
    const safeModuleItems = moduleItems.filter((x) => Number.isFinite(x.moduleId) && x.moduleId > 0);

    const componentItems = isKitchen
      ? safeModuleItems.map((x) => ({
          componentType: "module",
          moduleId: x.moduleId,
          positionUid: x.positionUid,
          positionType: x.positionType,
          positionOrder: x.positionOrder,
        }))
      : (() => {
          const items = [];
          let p = 0;
          for (const c of selectedCatalogItems) {
            const qty = Math.max(1, Number(c.quantity) || 1);
            const baseUid = c.positionUid || `tmp-ci-${p}`;
            for (let k = 0; k < qty; k++) {
              items.push({
                componentType: "catalogItem",
                catalogItemId: Number(c.catalogItemId),
                positionUid: k === 0 ? baseUid : `${baseUid}-${k}`,
                positionType: "component",
                positionOrder: p,
              });
              p++;
            }
          }
          return items.filter((x) => Number.isFinite(x.catalogItemId) && x.catalogItemId > 0);
        })();

    const computedBasePrice = (() => {
      if (isKitchen) {
        const byId = new Map((referenceData.modules || []).map((m) => [Number(m.id), m]));
        const sumForType = (type) =>
          (selectedModulesByType[type] || []).reduce((acc, { moduleId, quantity }) => {
            const m = byId.get(Number(moduleId));
            const price = Number(m?.final_price || m?.price || 0);
            const qty = Math.max(1, Number(quantity) || 1);
            return acc + price * qty;
          }, 0);
        return sumForType("bottom") + sumForType("top");
      }
      const byId = new Map((referenceData.catalogItems || []).map((m) => [Number(m.id), m]));
      return selectedCatalogItems.reduce((acc, { catalogItemId, quantity }) => {
        const m = byId.get(Number(catalogItemId));
        const price = Number(m?.final_price || m?.price || 0);
        const qty = Math.max(1, Number(quantity) || 1);
        return acc + price * qty;
      }, 0);
    })();

    return {
      moduleIds,
      moduleItems: safeModuleItems,
      componentItems,
      computedBasePrice,
    };
  }, [isKitchen, referenceData.catalogItems, referenceData.modules, selectedCatalogItems, selectedModulesByType]);

  const getColorId = useCallback((charFieldKey) => {
    const val = parseCharacteristicField(form.characteristics[charFieldKey]).value;
    if (!val) return null;
    const color = (referenceData.colors || []).find((c) => c.name === val || c.code === val || c.sku === val);
    return color ? Number(color.id) : null;
  }, [form.characteristics, referenceData.colors]);

  const saveKitNow = useCallback(async () => {
    if (!kitId) {
      loggerRef.current?.error("Нет kitId. Сначала создайте решение.");
      return;
    }

    if (isKitchen && !form.kitchen_type_id) {
      loggerRef.current?.error("Заполните тип кухни");
      return;
    }

    const facadeColorId = getColorId("facade_color");
    if (!form.material_id || !facadeColorId) {
      loggerRef.current?.error("Заполните материал и основной цвет");
      return;
    }

    if (!String(form.name || "").trim() || !String(form.description || "").trim()) {
      loggerRef.current?.error("Заполните название и описание");
      return;
    }

    if (!String(form.baseSku || "").trim()) {
      loggerRef.current?.error("Укажите baseSku");
      return;
    }

    if (form.is_active) {
      if (!form.preview_url) {
        loggerRef.current?.error("Для активного товара нужно выбрать превью");
        return;
      }
      const price = Number(form.final_price || 0);
      if (!Number.isFinite(price) || price <= 0) {
        loggerRef.current?.error("Для активного товара цена должна быть > 0");
        return;
      }
    }

    setLoading(true);
    try {
      const { moduleIds, moduleItems, componentItems, computedBasePrice } = getKitPayloadParts();
      const price = Number(form.final_price || 0);
      const payload = {
        name: String(form.name).trim(),
        base_sku: String(form.baseSku || "").trim() || null,
        sku: String(getEffectiveSku()).trim(),
        description: String(form.description).trim(),

        characteristics: normalizeCharacteristicsForSave(form.characteristics),
        category_group: fixedValues?.category_group || null,
        category: fixedValues?.category || null,
        kitchen_type_id: Number(form.kitchen_type_id) || null,
        material_id: Number(form.material_id) || null,
        collection_id: form.collection_id ? Number(form.collection_id) : null,
        primary_color_id: facadeColorId,
        secondary_color_id: getColorId("corpus_color"),

        ...resolveKitDimensions(form),
        countertop_length_mm: Number(form.countertop_length_mm) || null,
        countertop_depth_mm: Number(form.countertop_depth_mm) || null,

        base_price: Number(computedBasePrice) || 0,
        final_price: Number.isFinite(price) ? price : 0,
        preview_url: form.preview_url || null,
        is_active: !!form.is_active,

        parameters: selectedParameters.map((x) => ({ parameter_id: x.parameterId, quantity: x.quantity, value: x.value })),
        parameterCategories: selectedParameterCategories.map((id) => ({ category_id: id })),

        moduleIds,
        moduleItems,
        componentItems,
      };

      await put(`/kit-solutions/${kitId}`, payload);
      loggerRef.current?.info("Сохранено");
      onDone?.();
    } catch (e) {
      loggerRef.current?.error("Не удалось сохранить готовое решение", e);
    } finally {
      setLoading(false);
    }
  }, [fixedValues?.category, fixedValues?.category_group, form, getEffectiveSku, getKitPayloadParts, isKitchen, kitId, onDone, put, selectedParameterCategories, selectedParameters]);

  const { sections: catalogSections, templatesByField, fieldLabels } = useCatalogParameters(get);
  const { materials: materialsData } = useMaterialsForSelect(get);

  const [lengthWarning, setLengthWarning] = useState(null);

  const kitchenTypeItems = useMemo(() => {
    return (referenceData.kitchenTypes || []).slice().sort((a, b) => Number(a.id) - Number(b.id));
  }, [referenceData.kitchenTypes]);

  const materialItems = useMemo(() => {
    return (referenceData.materials || []).slice().sort((a, b) => Number(a.id) - Number(b.id));
  }, [referenceData.materials]);

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

  const addCatalogItem = (catalogItemId) => {
    const id = Number(catalogItemId);
    if (!Number.isFinite(id) || id <= 0) return;
    setSelectedCatalogItems((prev) => [
      ...prev,
      { catalogItemId: id, quantity: 1, positionUid: `tmp-ci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    ]);
  };

  const updateCatalogItemQuantity = (index, nextQty) => {
    setSelectedCatalogItems((prev) => {
      const list = [...prev];
      list[index] = { ...list[index], quantity: Math.max(1, Number(nextQty) || 1) };
      return list;
    });
  };

  const removeCatalogItem = (index) => {
    setSelectedCatalogItems((prev) => {
      const list = [...prev];
      list.splice(index, 1);
      return list;
    });
  };

  const steps = useMemo(
    () => [
      { number: 1, title: isKitchen ? "Тип кухни" : "Тип", icon: FaCog },
      { number: 2, title: "Описание", icon: FaCheckCircle },
      { number: 3, title: "Характеристики", icon: FaClipboardList },
      { number: 4, title: isKitchen ? "Состав/Размеры" : "Состав/Габариты", icon: FaRulerCombined },
      { number: 5, title: "Фото", icon: FaCamera },
      { number: 6, title: "Цена", icon: FaDollarSign },
    ],
    [isKitchen]
  );

  useEffect(() => {
    getRef.current = get;
    loggerRef.current = logger;
  }, [get, logger]);

  useEffect(() => {
    const loadReferences = async () => {
      if (referenceData.isLoaded) return;
      setLoading(true);
      try {
        if (!colorsCachePromise) {
          colorsCachePromise = getRef.current("/colors", { limit: 500, isActive: true }).then((res) => {
            const data = Array.isArray(res?.data) ? res.data : [];
            colorsCache = data;
            return data;
          });
        }

        if (!collectionsCachePromise) {
          collectionsCachePromise = getRef.current("/collections", { limit: 500, isActive: true }).then((res) => {
            const data = Array.isArray(res?.data) ? res.data : [];
            collectionsCache = data;
            return data;
          });
        }

        if (!productParametersCachePromise) {
          productParametersCachePromise = getRef.current("/product-parameters", { limit: 500 }).then((res) => {
            const data = Array.isArray(res?.data) ? res.data : [];
            productParametersCache = data;
            return data;
          });
        }

        if (!productParameterCategoriesCachePromise) {
          productParameterCategoriesCachePromise = getRef.current("/product-parameter-categories", { limit: 500 }).then((res) => {
            const data = Array.isArray(res?.data) ? res.data : [];
            productParameterCategoriesCache = data;
            return data;
          });
        }

        const [kitchenTypesRes, materialsRes, colorsData, collectionsData, modulesRes, moduleCategoriesRes, productParametersData, productParameterCategoriesData] = await Promise.all([
          getRef.current("/kitchen-types", { limit: 500, isActive: true }),
          getRef.current("/materials", { limit: 500, isActive: true }),
          Array.isArray(colorsCache) ? Promise.resolve(colorsCache) : colorsCachePromise,
          Array.isArray(collectionsCache) ? Promise.resolve(collectionsCache) : collectionsCachePromise,
          getRef.current("/modules", { limit: 500, isActive: true }),
          getRef.current("/module-categories", { limit: 200 }),
          Array.isArray(productParametersCache) ? Promise.resolve(productParametersCache) : productParametersCachePromise,
          Array.isArray(productParameterCategoriesCache)
            ? Promise.resolve(productParameterCategoriesCache)
            : productParameterCategoriesCachePromise,
        ]);

        setReferenceData({
          kitchenTypes: Array.isArray(kitchenTypesRes?.data) ? kitchenTypesRes.data : [],
          materials: Array.isArray(materialsRes?.data) ? materialsRes.data : [],
          colors: Array.isArray(colorsData) ? colorsData : [],
          collections: Array.isArray(collectionsData) ? collectionsData : [],
          modules: Array.isArray(modulesRes?.data) ? modulesRes.data : [],
          moduleCategories: Array.isArray(moduleCategoriesRes?.data) ? moduleCategoriesRes.data : [],
          catalogItems: [],
          productParameters: Array.isArray(productParametersData) ? productParametersData : [],
          productParameterCategories: Array.isArray(productParameterCategoriesData) ? productParameterCategoriesData : [],
          isLoaded: true,
        });
      } catch (e) {
        loggerRef.current?.error("Не удалось загрузить справочники", e);
        setReferenceData({
          kitchenTypes: [],
          materials: [],
          colors: [],
          collections: [],
          modules: [],
          moduleCategories: [],
          catalogItems: [],
          productParameters: [],
          productParameterCategories: [],
          isLoaded: true,
        });
      } finally {
        setLoading(false);
      }
    };

    loadReferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!referenceData.isLoaded) return;
    if (isKitchen) return;
    const group = String(fixedValues?.category_group || "").trim();
    if (!group) {
      setReferenceData((p) => ({ ...p, catalogItems: [] }));
      return;
    }

    let active = true;
    setLoading(true);
    getRef.current("/catalog-items", { limit: 500, isActive: true, categoryGroup: group })
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setReferenceData((p) => ({ ...p, catalogItems: list }));
      })
      .catch((e) => {
        if (!active) return;
        loggerRef.current?.error("Не удалось загрузить catalog-items", e);
        setReferenceData((p) => ({ ...p, catalogItems: [] }));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fixedValues?.category_group, isKitchen, referenceData.isLoaded]);

  useEffect(() => {
    if (!initialKitSolutionId) return;

    let active = true;
    setLoading(true);

    getRef.current(`/kit-solutions/${initialKitSolutionId}`, { includeInactive: true })
      .then((res) => {
        const data = res?.data;
        if (!active || !data) return;

        const sku = String(data.sku || "");
        const skuParts = sku.split("-");
        const maybeNonce = skuParts[skuParts.length - 1];
        if (/^[a-z0-9]{4}$/i.test(maybeNonce)) {
          skuNonceRef.current = maybeNonce;
        }

        setKitId(data.id);
        setForm((prev) => ({
          ...prev,
          baseSku: data.base_sku || "",
          sku: data.sku || "",
          name: data.name || "",
          description: data.description || "",
          kitchen_type_id: data.kitchen_type_id ?? "",
          material_id: data.material_id ?? "",
          collection_id: data.collection_id ?? "",
          total_length_mm: data.total_length_mm != null ? String(data.total_length_mm) : "",
          total_depth_mm: data.total_depth_mm != null ? String(data.total_depth_mm) : "",
          total_height_mm: data.total_height_mm != null ? String(data.total_height_mm) : "",
          countertop_length_mm: data.countertop_length_mm != null ? String(data.countertop_length_mm) : "",
          countertop_depth_mm: data.countertop_depth_mm != null ? String(data.countertop_depth_mm) : "",
          preview_url: data.preview_url || null,
          base_price: data.base_price != null ? String(data.base_price) : "",
          final_price: data.final_price != null ? String(data.final_price) : "",
          is_active: !!data.is_active,

          characteristics: mergeEntityDimensionsIntoCharacteristics(data.characteristics, {
            total_length_mm: data.total_length_mm,
            total_depth_mm: data.total_depth_mm,
            total_height_mm: data.total_height_mm,
          }),
        }));

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

        const modulesObj = data.modules || {};
        const bottomList = Array.isArray(modulesObj.bottom) ? modulesObj.bottom : [];
        const topList = Array.isArray(modulesObj.top) ? modulesObj.top : [];
        setSelectedModulesByType({
          bottom: bottomList.map((m, idx) => ({ moduleId: m.id, quantity: 1, positionUid: m.positionUid || `legacy-bottom-${m.id}-${idx}` })),
          top: topList.map((m, idx) => ({ moduleId: m.id, quantity: 1, positionUid: m.positionUid || `legacy-top-${m.id}-${idx}` })),
        });

        const comps = Array.isArray(data.components) ? data.components : [];
        const catalogComps = comps.filter((x) => x?.__type === "catalogItem" && x?.id);
        setSelectedCatalogItems(
          catalogComps.map((c, idx) => ({
            catalogItemId: Number(c.id),
            quantity: 1,
            positionUid: c.positionUid || `legacy-ci-${c.id}-${idx}`,
          }))
        );

        setStep(2);
      })
      .catch((e) => {
        loggerRef.current?.error("Не удалось загрузить готовое решение для редактирования", e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initialKitSolutionId]);

  useEffect(() => {
    if (!duplicateFromId) return;

    let active = true;
    setLoading(true);

    getRef.current(`/kit-solutions/${duplicateFromId}`, { includeInactive: true })
      .then((res) => {
        const data = res?.data;
        if (!active || !data) return;

        setForm((prev) => ({
          ...prev,
          baseSku: "",
          sku: data.sku || "",
          name: data.name || "",
          description: data.description || "",
          kitchen_type_id: data.kitchen_type_id ?? "",
          material_id: data.material_id ?? "",
          collection_id: data.collection_id ?? "",
          total_length_mm: data.total_length_mm != null ? String(data.total_length_mm) : "",
          total_depth_mm: data.total_depth_mm != null ? String(data.total_depth_mm) : "",
          total_height_mm: data.total_height_mm != null ? String(data.total_height_mm) : "",
          countertop_length_mm: data.countertop_length_mm != null ? String(data.countertop_length_mm) : "",
          countertop_depth_mm: data.countertop_depth_mm != null ? String(data.countertop_depth_mm) : "",
          preview_url: data.preview_url || null,
          final_price: data.final_price != null ? String(data.final_price) : "",
          is_active: false,

          characteristics: mergeEntityDimensionsIntoCharacteristics(data.characteristics, {
            total_length_mm: data.total_length_mm,
            total_depth_mm: data.total_depth_mm,
            total_height_mm: data.total_height_mm,
          }),
        }));

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

        const modulesObj = data.modules || {};
        const bottomList = Array.isArray(modulesObj.bottom) ? modulesObj.bottom : [];
        const topList = Array.isArray(modulesObj.top) ? modulesObj.top : [];
        setSelectedModulesByType({
          bottom: bottomList.map((m, idx) => ({ moduleId: m.id, quantity: 1, positionUid: `dup-bottom-${Date.now()}-${m.id}-${idx}` })),
          top: topList.map((m, idx) => ({ moduleId: m.id, quantity: 1, positionUid: `dup-top-${Date.now()}-${m.id}-${idx}` })),
        });

        const comps = Array.isArray(data.components) ? data.components : [];
        const catalogComps = comps.filter((x) => x?.__type === "catalogItem" && x?.id);
        setSelectedCatalogItems(
          catalogComps.map((c, idx) => ({
            catalogItemId: Number(c.id),
            quantity: 1,
            positionUid: `dup-ci-${Date.now()}-${c.id}-${idx}`,
          }))
        );

        // important: duplication must create a new kit
        setKitId(null);
        createLockRef.current = false;
        skuNonceRef.current = null;
        setStep(2);
      })
      .catch((e) => {
        loggerRef.current?.error("Не удалось загрузить готовое решение для создания копии", e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [duplicateFromId]);

  const buildSku = useCallback(() => null, []);

  const computeAutoSizes = useCallback(() => {
    const byId = new Map(
      (isKitchen ? referenceData.modules : referenceData.catalogItems).map((m) => [Number(m.id), m])
    );

    const expand = (type) =>
      isKitchen
        ? (selectedModulesByType[type] || []).flatMap(({ moduleId, quantity }) =>
            Array(Math.max(1, Number(quantity) || 1))
              .fill(byId.get(Number(moduleId)))
              .filter(Boolean)
          )
        : selectedCatalogItems.flatMap(({ catalogItemId, quantity }) =>
            Array(Math.max(1, Number(quantity) || 1))
              .fill(byId.get(Number(catalogItemId)))
              .filter(Boolean)
          );

    const bottomMods = expand("bottom");
    const topMods = isKitchen ? expand("top") : [];

    const bottomTotal = bottomMods.reduce((s, m) => s + (Number(m.length_mm) || 0), 0);
    const topTotal = topMods.reduce((s, m) => s + (Number(m.length_mm) || 0), 0);
    const bottomMaxDepth = Math.max(0, ...bottomMods.map((m) => Number(m.depth_mm) || 0));
    const topMaxDepth = Math.max(0, ...topMods.map((m) => Number(m.depth_mm) || 0));
    const maxDepth = Math.max(bottomMaxDepth, topMaxDepth);
    const bottomMaxHeight = Math.max(0, ...bottomMods.map((m) => Number(m.height_mm) || 0));
    const topMaxHeight = Math.max(0, ...topMods.map((m) => Number(m.height_mm) || 0));

    const totalHeight = bottomMaxHeight + topMaxHeight;

    if (bottomTotal > 0 && topTotal > 0 && bottomTotal !== topTotal) {
      setLengthWarning({ bottomTotal, topTotal });
    } else {
      setLengthWarning(null);
    }

    setForm((prev) => {
      const characteristics = { ...(prev.characteristics || {}) };
      const patchDim = (key, val) => {
        if (!val) return;
        const current = parseCharacteristicField(characteristics[key]);
        characteristics[key] = { ...current, value: String(Math.round(val)) };
      };
      patchDim("width_mm", bottomTotal);
      patchDim("depth_mm_char", maxDepth);
      patchDim("height_mm_char", totalHeight);
      return { ...prev, characteristics };
    });
  }, [isKitchen, referenceData.catalogItems, referenceData.modules, selectedCatalogItems, selectedModulesByType, buildSku]);

  const computedBasePrice = useMemo(() => {
    if (isKitchen) {
      const byId = new Map(referenceData.modules.map((m) => [Number(m.id), m]));
      const sumForType = (type) =>
        (selectedModulesByType[type] || []).reduce((acc, { moduleId, quantity }) => {
          const m = byId.get(Number(moduleId));
          const price = Number(m?.final_price || m?.price || 0);
          const qty = Math.max(1, Number(quantity) || 1);
          return acc + price * qty;
        }, 0);
      return sumForType("bottom") + sumForType("top");
    }

    const byId = new Map(referenceData.catalogItems.map((m) => [Number(m.id), m]));
    return selectedCatalogItems.reduce((acc, { catalogItemId, quantity }) => {
      const m = byId.get(Number(catalogItemId));
      const price = Number(m?.final_price || m?.price || 0);
      const qty = Math.max(1, Number(quantity) || 1);
      return acc + price * qty;
    }, 0);
  }, [isKitchen, referenceData.catalogItems, referenceData.modules, selectedCatalogItems, selectedModulesByType]);

  const catalogItemsSelectable = useMemo(() => {
    const list = Array.isArray(referenceData.catalogItems) ? referenceData.catalogItems : [];
    const excluded = String(fixedValues?.category || "").trim();
    return list
      .filter((x) => x?.is_active)
      .filter((x) => {
        if (!excluded) return true;
        return String(x?.category || "").trim() !== excluded;
      });
  }, [fixedValues?.category, referenceData.catalogItems]);

  const moduleCategoryIdsByCode = useMemo(() => {
    const cats = Array.isArray(referenceData.moduleCategories) ? referenceData.moduleCategories : [];
    const map = new Map();
    for (const c of cats) {
      if (!c?.code || !c?.id) continue;
      map.set(String(c.code), Number(c.id));
    }
    return map;
  }, [referenceData.moduleCategories]);

  const moduleCategoryById = useMemo(() => {
    const cats = Array.isArray(referenceData.moduleCategories) ? referenceData.moduleCategories : [];
    const map = new Map();
    for (const c of cats) {
      if (!c?.id) continue;
      map.set(Number(c.id), c);
    }
    return map;
  }, [referenceData.moduleCategories]);

  const classifyModule = useCallback(
    (m) => {
      const baseSku = String(m?.base_sku || "").trim();
      if (/^\s*В/i.test(baseSku)) return "top";
      if (/^\s*Н/i.test(baseSku)) return "bottom";

      const catId = Number(m?.module_category_id);
      const topId = moduleCategoryIdsByCode.get("top");
      const bottomId = moduleCategoryIdsByCode.get("bottom");

      if (topId && catId === topId) return "top";
      if (bottomId && catId === bottomId) return "bottom";

      const cat = moduleCategoryById.get(catId);
      const hint = `${cat?.code || ""} ${cat?.name || ""} ${cat?.sku_prefix || ""}`.trim();
      if (/^\s*В/i.test(hint)) return "top";
      if (/^\s*Н/i.test(hint)) return "bottom";
      if (/верх/i.test(hint)) return "top";
      if (/низ/i.test(hint)) return "bottom";

      return null;
    },
    [moduleCategoryById, moduleCategoryIdsByCode]
  );

  const bottomModulesSelectable = useMemo(() => {
    return isKitchen ? referenceData.modules.filter((m) => classifyModule(m) === "bottom") : referenceData.modules;
  }, [isKitchen, referenceData.modules, classifyModule]);

  const topModulesSelectable = useMemo(() => {
    return isKitchen ? referenceData.modules.filter((m) => classifyModule(m) === "top") : [];
  }, [isKitchen, referenceData.modules, classifyModule]);

  const createKitIfNeeded = useCallback(async () => {
    if (kitId) return kitId;
    if (createLockRef.current) return null;

    if (isKitchen && !form.kitchen_type_id) {
      loggerRef.current?.error("Заполните тип кухни");
      return null;
    }

    const facadeColorId = getColorId("facade_color");
    if (!form.material_id || !facadeColorId) {
      loggerRef.current?.error("Заполните материал и основной цвет");
      return null;
    }

    if (!form.name || !form.description) {
      loggerRef.current?.error("Заполните название и описание");
      return null;
    }

    if (!form.baseSku) {
      loggerRef.current?.error("Укажите baseSku для формирования артикула");
      return null;
    }

    createLockRef.current = true;
    setLoading(true);

    try {
      const { moduleIds, moduleItems, componentItems } = getKitPayloadParts();
      const payload = {
        name: String(form.name).trim(),
        base_sku: String(form.baseSku || "").trim() || null,
        sku: String(getEffectiveSku()).trim(),
        description: String(form.description).trim(),

        characteristics: normalizeCharacteristicsForSave(form.characteristics),
        category_group: fixedValues?.category_group || null,
        category: fixedValues?.category || null,
        kitchen_type_id: Number(form.kitchen_type_id) || null,
        material_id: Number(form.material_id) || null,
        collection_id: form.collection_id ? Number(form.collection_id) : null,
        primary_color_id: facadeColorId,
        secondary_color_id: getColorId("corpus_color"),

        ...resolveKitDimensions(form),
        countertop_length_mm: Number(form.countertop_length_mm) || null,
        countertop_depth_mm: Number(form.countertop_depth_mm) || null,

        base_price: 0,
        final_price: 0,
        preview_url: form.preview_url,
        is_active: false,

        parameters: selectedParameters.map((x) => ({ parameter_id: x.parameterId, quantity: x.quantity, value: x.value })),
        parameterCategories: selectedParameterCategories.map((id) => ({ category_id: id })),

        moduleIds,
        moduleItems,
        componentItems,
      };

      const resp = await post("/kit-solutions", payload);
      const id = resp?.data?.id;
      if (!id) throw new Error("API не вернул id при создании готового решения");
      setKitId(id);
      if (resp?.data?.sku) {
        setForm((p) => ({ ...p, sku: resp.data.sku }));
      }
      return id;
    } catch (e) {
      loggerRef.current?.error("Не удалось создать готовое решение", e);
      return null;
    } finally {
      setLoading(false);
      createLockRef.current = false;
    }
  }, [fixedValues?.category, fixedValues?.category_group, form, getEffectiveSku, getKitPayloadParts, kitId, post]);

  const finalizeKit = async () => {
    if (!kitId) {
      loggerRef.current?.error("Нет kitId. Сначала создайте решение.");
      return;
    }

    if (!form.preview_url) {
      loggerRef.current?.error("Выберите превью (клик по фото → сделать превью)");
      return;
    }

    const price = Number(form.final_price || 0);
    if (!Number.isFinite(price) || price <= 0) {
      loggerRef.current?.error("Цена должна быть > 0");
      return;
    }

    setLoading(true);
    try {
      const { moduleIds, moduleItems, componentItems, computedBasePrice } = getKitPayloadParts();
      const payload = {
        name: String(form.name).trim(),
        base_sku: String(form.baseSku || "").trim() || null,
        sku: String(getEffectiveSku()).trim(),
        description: String(form.description).trim(),

        characteristics: normalizeCharacteristicsForSave(form.characteristics),
        category_group: fixedValues?.category_group || null,
        category: fixedValues?.category || null,
        kitchen_type_id: Number(form.kitchen_type_id) || null,
        material_id: Number(form.material_id) || null,
        collection_id: form.collection_id ? Number(form.collection_id) : null,
        primary_color_id: getColorId("facade_color"),
        secondary_color_id: getColorId("corpus_color"),

        ...resolveKitDimensions(form),
        countertop_length_mm: Number(form.countertop_length_mm) || null,
        countertop_depth_mm: Number(form.countertop_depth_mm) || null,

        base_price: Number(computedBasePrice) || 0,
        final_price: price,
        preview_url: form.preview_url,
        is_active: true,

        parameters: selectedParameters.map((x) => ({ parameter_id: x.parameterId, quantity: x.quantity, value: x.value })),
        parameterCategories: selectedParameterCategories.map((id) => ({ category_id: id })),

        moduleIds,
        moduleItems,
        componentItems,
      };

      await put(`/kit-solutions/${kitId}`, payload);
      onDone?.();

      setKitId(null);
      skuNonceRef.current = null;
      setStep(1);
      setForm({
        baseSku: "",
        sku: "",
        name: "",
        description: "",
        kitchen_type_id: "",
        material_id: "",
        collection_id: "",
        total_length_mm: "",
        total_depth_mm: "",
        total_height_mm: "",
        countertop_length_mm: "",
        countertop_depth_mm: "",
        preview_url: null,
        final_price: "",
        is_active: false,

        characteristics: createEmptyCharacteristicsForm(),
      });
      setSelectedModulesByType({ bottom: [], top: [] });
      setSelectedCatalogItems([]);
      setSelectedParameters([]);
      setSelectedParameterCategories([]);
    } catch (e) {
      loggerRef.current?.error("Не удалось сохранить готовое решение", e);
    } finally {
      setLoading(false);
    }
  };

  const addModule = (type, moduleId) => {
    const id = Number(moduleId);
    if (!Number.isFinite(id) || id <= 0) return;

    setSelectedModulesByType((prev) => ({
      ...prev,
      [type]: [...(prev[type] || []), { moduleId: id, quantity: 1, positionUid: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }],
    }));
  };

  const updateQuantity = (type, index, nextQty) => {
    setSelectedModulesByType((prev) => {
      const list = [...(prev[type] || [])];
      list[index] = { ...list[index], quantity: Math.max(1, Number(nextQty) || 1) };
      return { ...prev, [type]: list };
    });
  };

  const removeModule = (type, index) => {
    setSelectedModulesByType((prev) => {
      const list = [...(prev[type] || [])];
      list.splice(index, 1);
      return { ...prev, [type]: list };
    });
  };

  const goToPhotos = async () => {
    const id = await createKitIfNeeded();
    if (!id) return;
    setStep(5);
  };

  const goToPrice = async () => {
    const id = await createKitIfNeeded();
    if (!id) return;
    setStep(6);
  };

  const normalizeSkuPart = (value) => {
    const s = String(value ?? "").trim();
    if (!s) return "";
    return s
      .replace(/\s+/g, "")
      .replace(/[-–—]+/g, "")
      .replace(/[\\/]+/g, "")
      .trim();
  };

  const normalizeNum = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "";
    return String(Math.round(n));
  };

  const skuPreview = useMemo(() => {
    if (String(form.sku || "").trim()) return "";
    const articleName = String(form.baseSku || "").trim() || String(form.name || "").trim();
    const dims = getCharacteristicDimensions(form.characteristics);

    const facadeVal = parseCharacteristicField(form.characteristics.facade_color).value;
    const corpusVal = parseCharacteristicField(form.characteristics.corpus_color).value;
    const primaryColor = referenceData.colors.find((c) => c.name === facadeVal || c.code === facadeVal || c.sku === facadeVal);
    const secondaryColor = referenceData.colors.find((c) => c.name === corpusVal || c.code === corpusVal || c.sku === corpusVal);

    const parts = [
      normalizeSkuPart(articleName),
      normalizeNum(dims.length_mm ?? form.total_length_mm),
      normalizeNum(dims.depth_mm ?? form.total_depth_mm),
      normalizeNum(dims.height_mm ?? form.total_height_mm),
      normalizeSkuPart(primaryColor?.sku || ""),
      normalizeSkuPart(secondaryColor?.sku || ""),
    ].filter(Boolean);

    return parts.length ? parts.join("-") : "";
  }, [fixedValues?.category, fixedValues?.category_group, form.baseSku, form.characteristics, form.name, form.sku, form.total_depth_mm, form.total_height_mm, form.total_length_mm, referenceData.colors]);

  const effectiveSku = form.sku || skuPreview;

  if (loading && referenceData.isLoaded === false) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="glass-card p-6 text-night-600 flex items-center gap-3">
          <FaSpinner className="animate-spin" /> Загрузка...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-night-900">Готовое решение</div>
            <div className="text-xs text-night-500">ID: {kitId || "—"}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {initialKitSolutionId ? (
              <SecureButton
                type="button"
                onClick={saveKitNow}
                className="px-3 py-2 text-xs flex items-center gap-2"
                disabled={!kitId || loading}
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
                    if (s.number === 5) return;
                    if (s.number === 6) return;
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

      {step === 1 && (
        <div className="glass-card p-6 space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {isKitchen ? (
              <FormField label="Тип кухни">
                <FormSelect
                  items={kitchenTypeItems}
                  value={form.kitchen_type_id}
                  placeholder="Не выбран"
                  allowClear
                  clearLabel="Не выбран"
                  getKey={(t) => String(t.id)}
                  getLabel={(t) => `#${t.id} ${t.name}`}
                  onChange={(next) => setForm((p) => ({ ...p, kitchen_type_id: String(next || "") }))}
                />
              </FormField>
            ) : null}
            <FormField label="Название" className="sm:col-span-2">
              <SecureInput value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
            </FormField>

            <FormField label="Коллекция">
              <FormSelect
                items={collectionItems}
                value={form.collection_id}
                placeholder="Не выбрана"
                allowClear
                clearLabel="Не выбрана"
                getKey={(c) => String(c.id)}
                getLabel={(c) => String(c?.name || "")}
                onChange={(next) => setForm((p) => ({ ...p, collection_id: String(next || "") }))}
              />
            </FormField>


            <FormField label="baseSku (для артикула)" className="sm:col-span-2">
              <SecureInput
                value={form.baseSku}
                onChange={(v) => setForm((p) => ({ ...p, baseSku: v }))}
                placeholder="Например: PRYAMAYA"
              />
            </FormField>

            <FormField label="Артикул (SKU)" labelClassName="cursor-help" className="sm:col-span-2" title="SKU формируется автоматически из baseSku/названия + суммарных размеров (Д/Г/В) + выбранных цветов. Поле доступно только для просмотра.">
              <SecureInput value={effectiveSku} onChange={() => {}} disabled placeholder="Сформируется автоматически" />
            </FormField>
          </div>

          <div className="flex justify-end">
            <SecureButton type="button" onClick={() => setStep(2)} className="px-4 py-2">
              Далее
            </SecureButton>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="glass-card p-6 space-y-4">
          <div className="grid gap-4">
            <FormField label="Описание">
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full px-4 py-2 border border-night-200 rounded-xl bg-white text-night-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent min-h-[120px] resize-y"
                rows={5}
              />
            </FormField>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Параметры</div>

              <FormSelect
                items={productParameterItems}
                value={""}
                placeholder="+ Добавить..."
                getKey={(p) => String(p.id)}
                getLabel={(p) => `#${p.id} ${p.name}`}
                onChange={(next) => {
                  const v = String(next || "");
                  if (!v) return;
                  addParameter(v);
                }}
              />

              {(selectedParameters || []).length === 0 ? (
                <div className="text-xs text-night-500">Параметры не выбраны</div>
              ) : (
                <div className="space-y-2">
                  {selectedParameters.map((p, idx) => {
                    const full = (referenceData.productParameters || []).find((x) => Number(x.id) === Number(p.parameterId));
                    const templates = parameterTemplatesById[String(p.parameterId)] || null;
                    if (templates === null) {
                      void ensureParameterTemplatesLoaded(p.parameterId);
                    }
                    return (
                      <div key={`${p.parameterId}-${idx}`} className="flex flex-wrap items-center justify-between gap-3 border border-night-200 rounded-lg p-3 bg-white">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-night-900 truncate">{full?.name || `#${p.parameterId}`}</div>
                          <div className="text-xs text-night-500">ID: {p.parameterId}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <FormSelect
                            size="sm"
                            items={Array.isArray(templates) ? templates : []}
                            value={""}
                            placeholder="Шаблон…"
                            getKey={(t) => String(t.id)}
                            getLabel={(t) => {
                              const labelValue = String(t?.value || "").trim();
                              const labelQty = Number(t?.quantity);
                              const qtySuffix = Number.isFinite(labelQty) && labelQty > 1 ? ` (${labelQty})` : "";
                              return labelValue ? `${labelValue}${qtySuffix}` : `Количество${qtySuffix}`;
                            }}
                            onChange={(next) => {
                              const templateId = Number(next);
                              if (!Number.isFinite(templateId) || templateId <= 0) return;
                              const list = parameterTemplatesById[String(p.parameterId)] || [];
                              const t = list.find((x) => Number(x.id) === templateId);
                              if (!t) return;
                              setSelectedParameters((prev) => {
                                const nextArr = [...prev];
                                if (!nextArr[idx]) return prev;
                                nextArr[idx] = {
                                  ...nextArr[idx],
                                  value: t.value ?? "",
                                  quantity: Number(t.quantity) || 1,
                                };
                                return nextArr;
                              });
                            }}
                            buttonClassName="h-10 rounded-lg border border-night-200 bg-white text-night-900 text-xs"
                            popoverClassName="rounded-lg"
                            maxHeightClassName="max-h-64"
                          />
                          <div className="flex-1 flex gap-2 items-center">
                            <SecureInput
                              value={String(p.value ?? "")}
                              onChange={(v) =>
                                setSelectedParameters((prev) => {
                                  const next = [...prev];
                                  if (!next[idx]) return prev;
                                  next[idx] = { ...next[idx], value: v };
                                  return next;
                                })
                              }
                              className="flex-1"
                              placeholder="Значение"
                            />
                            <SecureInput
                              type="number"
                              value={String(p.quantity ?? 1)}
                              onChange={(v) => updateParameterQty(idx, v)}
                              className="w-20"
                            />
                          </div>
                          <div className="flex gap-1">
                            <SmallButton onClick={() => removeParameter(idx)} title="Удалить параметр">
                              ×
                            </SmallButton>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Категории параметров изделий</div>
              <FormSelect
                items={productParameterCategoryItems}
                value={""}
                placeholder="+ Добавить..."
                getKey={(c) => String(c.id)}
                getLabel={(c) => String(c?.name || "")}
                onChange={(next) => {
                  const v = String(next || "");
                  if (!v) return;
                  addParameterCategory(v);
                }}
              />

              {(selectedParameterCategories || []).length === 0 ? (
                <div className="text-xs text-night-500">Категории не выбраны</div>
              ) : (
                <div className="space-y-2">
                  {selectedParameterCategories.map((id, idx) => {
                    const full = (referenceData.productParameterCategories || []).find((x) => Number(x.id) === Number(id));
                    return (
                      <div key={`${id}-${idx}`} className="flex flex-wrap items-center justify-between gap-3 border border-night-200 rounded-lg p-3 bg-white">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-night-900 truncate">{full?.name || `#${id}`}</div>
                          <div className="text-xs text-night-500">ID: {id}</div>
                        </div>
                        <SmallButton onClick={() => removeParameterCategory(idx)}>
                          Удалить
                        </SmallButton>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between">
            <SecureButton type="button" variant="outline" onClick={() => setStep(1)} className="px-4 py-2 flex items-center gap-2">
              <FaArrowLeft /> Назад
            </SecureButton>
            <SecureButton type="button" onClick={() => setStep(3)} className="px-4 py-2">
              Далее
            </SecureButton>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="glass-card p-6 space-y-6">
          <ProductCharacteristicsEditor
            value={form.characteristics}
            onChange={(next) => setForm((p) => ({ ...p, characteristics: next }))}
            templatesByField={templatesByField}
            fieldLabels={fieldLabels}
            materialsBySourceType={materialsData.bySourceType || {}}
          />
          <div className="flex justify-between pt-4 border-t border-night-200">
            <SecureButton type="button" variant="outline" onClick={() => setStep(2)} className="px-4 py-2 flex items-center gap-2">
              <FaArrowLeft /> Назад
            </SecureButton>
            <SecureButton type="button" onClick={() => setStep(4)} className="px-4 py-2">
              Далее
            </SecureButton>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="glass-card p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-night-900">{isKitchen ? "Состав кухни" : "Состав"}</div>
              <div className="text-xs text-night-500">{isKitchen ? "Выберите модули и нажмите “Пересчитать размеры”." : "Выберите компоненты и нажмите “Пересчитать размеры”."}</div>
            </div>
            <SecureButton type="button" variant="outline" onClick={computeAutoSizes} className="px-4 py-2 text-xs">
              Пересчитать размеры
            </SecureButton>
          </div>

          {lengthWarning ? (
            <div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-800 text-sm">
              Длина верхних модулей ({lengthWarning.topTotal} мм) не совпадает с длиной нижних модулей ({lengthWarning.bottomTotal} мм).
            </div>
          ) : null}

          {isKitchen ? (
            [
              { type: "bottom", title: "Нижние модули", list: bottomModulesSelectable },
              { type: "top", title: "Верхние модули", list: topModulesSelectable },
            ].map(({ type, title, list }) => (
              <div key={type} className="space-y-3">
                <div className="text-xs font-semibold text-night-700 uppercase">{title}</div>

                <FormSelect
                  items={list}
                  value={""}
                  placeholder="+ Добавить..."
                  getKey={(m) => String(m.id)}
                  getLabel={(m) => `#${m.id} ${m.name} (${m.length_mm}×${m.depth_mm}×${m.height_mm})`}
                  onChange={(next) => {
                    const v = String(next || "");
                    if (!v) return;
                    addModule(type, v);
                  }}
                  popoverClassName="max-w-2xl"
                />

                {(selectedModulesByType[type] || []).length === 0 ? (
                  <div className="text-xs text-night-500">Пусто</div>
                ) : (
                  <div className="space-y-2">
                    {selectedModulesByType[type].map((m, idx) => {
                      const full = referenceData.modules.find((x) => x.id === Number(m.moduleId));
                      return (
                        <div key={m.positionUid || `${type}-${idx}`} className="flex flex-wrap items-center justify-between gap-3 border border-night-200 rounded-lg p-3 bg-white">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-night-900 truncate">{full?.name || `#${m.moduleId}`}</div>
                            <div className="text-xs text-night-500">{full?.sku || ""}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <SecureInput
                              type="number"
                              value={m.quantity}
                              onChange={(v) => updateQuantity(type, idx, v)}
                              className="w-20"
                            />
                            <SmallButton onClick={() => removeModule(type, idx)} title="Удалить модуль">
                              ×
                            </SmallButton>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-night-700 uppercase">Компоненты</div>

              <FormSelect
                items={catalogItemsSelectable}
                value={""}
                placeholder="+ Добавить..."
                getKey={(m) => String(m.id)}
                getLabel={(m) => `#${m.id} ${m.name} (${m.length_mm}×${m.depth_mm}×${m.height_mm})`}
                onChange={(next) => {
                  const v = String(next || "");
                  if (!v) return;
                  addCatalogItem(v);
                }}
                popoverClassName="max-w-2xl"
              />

              {selectedCatalogItems.length === 0 ? (
                <div className="text-xs text-night-500">Пусто</div>
              ) : (
                <div className="space-y-2">
                  {selectedCatalogItems.map((m, idx) => {
                    const full = referenceData.catalogItems.find((x) => x.id === Number(m.catalogItemId));
                    return (
                      <div key={m.positionUid || `ci-${idx}`} className="flex flex-wrap items-center justify-between gap-3 border border-night-200 rounded-lg p-3 bg-white">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-night-900 truncate">{full?.name || `#${m.catalogItemId}`}</div>
                          <div className="text-xs text-night-500">{full?.sku || ""}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <SecureInput
                            type="number"
                            value={m.quantity}
                            onChange={(v) => updateCatalogItemQuantity(idx, v)}
                            className="w-20"
                          />
                          <SmallButton onClick={() => removeCatalogItem(idx)} title="Удалить компонент">
                            ×
                          </SmallButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <SecureButton type="button" variant="outline" onClick={() => setStep(3)} className="px-4 py-2 flex items-center gap-2">
              <FaArrowLeft /> Назад
            </SecureButton>
            <SecureButton type="button" onClick={goToPhotos} className="px-4 py-2 flex items-center gap-2">
              <FaCamera /> К фото
            </SecureButton>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-6">
          <div className="glass-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-night-900">Фото</div>
                <div className="text-xs text-night-500">Загрузите фото и выберите превью.</div>
              </div>
              <SecureButton type="button" variant="outline" onClick={() => setStep(4)} className="px-4 py-2 text-xs flex items-center gap-2">
                <FaArrowLeft /> Назад
              </SecureButton>
            </div>

            <ImageManager
              entityType="kit-solutions"
              entityId={kitId}
              onPreviewUpdate={(url) => setForm((p) => ({ ...p, preview_url: url }))}
            />

            <div className="flex justify-end">
              <SecureButton type="button" onClick={goToPrice} className="px-4 py-2 flex items-center gap-2">
                <FaDollarSign /> К цене
              </SecureButton>
            </div>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="glass-card p-6 space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <FormField label="Базовая цена (сумма модулей)">
              <SecureInput value={String(computedBasePrice || 0)} onChange={() => {}} readOnly disabled />
              <div className="text-xs text-night-500">{formatCurrency(computedBasePrice || 0)}</div>
            </FormField>
            <FormField label="Итоговая цена">
              <SecureInput value={form.final_price} onChange={(v) => setForm((p) => ({ ...p, final_price: v }))} />
            </FormField>
          </div>

          <div className="flex justify-between">
            <SecureButton type="button" variant="outline" onClick={() => setStep(5)} className="px-4 py-2 flex items-center gap-2">
              <FaArrowLeft /> Назад
            </SecureButton>

            <SecureButton type="button" onClick={finalizeKit} className="px-4 py-2 flex items-center gap-2" disabled={loading}>
              {loading ? <FaSpinner className="animate-spin" /> : <FaSave />} {submitLabel}
            </SecureButton>
          </div>
        </div>
      )}

      {loading && referenceData.isLoaded && (
        <div className="glass-card p-4 text-night-600 flex items-center gap-3">
          <FaSpinner className="animate-spin" /> Обработка...
        </div>
      )}

      <div className="glass-card p-4 text-xs text-night-500 flex items-center gap-2">
        <FaImage /> Превью берется из таблицы изображений (`images`) через кнопку “Выбрать”.
      </div>
    </div>
  );
};

export default KitSolutionCreator;
