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
} from "react-icons/fa";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import useApi from "../../hooks/useApi";
import useLogger from "../../hooks/useLogger";
import ImageManager from "./ImageManager";
import ColorBadge from "../ui/ColorBadge";
import { formatCurrency } from "../../utils/format";
import { getThumbUrl } from "../../utils/image";

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

let colorsCache = null;
let colorsCachePromise = null;
let collectionsCache = null;
let collectionsCachePromise = null;
let productParametersCache = null;
let productParametersCachePromise = null;
let productParameterCategoriesCache = null;
let productParameterCategoriesCachePromise = null;

const normalizeCharacteristics = (value) => {
  const obj = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const next = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string") {
      const s = v.trim();
      if (!s) continue;
      next[k] = s;
      continue;
    }
    if (typeof v === "number") {
      if (!Number.isFinite(v)) continue;
      next[k] = v;
      continue;
    }
    if (typeof v === "boolean") {
      next[k] = v;
      continue;
    }
  }
  return Object.keys(next).length ? next : null;
};

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
    primary_color_id: "",
    secondary_color_id: "",

    // размеры
    total_length_mm: "",
    total_depth_mm: "",
    total_height_mm: "",
    countertop_length_mm: "",
    countertop_depth_mm: "",

    preview_url: null,
    final_price: "",
    is_active: false,

    characteristics: {},
  });

  const [selectedModulesByType, setSelectedModulesByType] = useState({
    bottom: [],
    top: [],
  });

  const [selectedCatalogItems, setSelectedCatalogItems] = useState([]);
  const [selectedParameters, setSelectedParameters] = useState([]);
  const [selectedParameterCategories, setSelectedParameterCategories] = useState([]);
  const [openPrimary, setOpenPrimary] = useState(false);
  const [openSecondary, setOpenSecondary] = useState(false);
  const colorPickerRef = useRef(null);

  const [lengthWarning, setLengthWarning] = useState(null);

  const colorsByType = useMemo(() => {
    const list = Array.isArray(referenceData.colors) ? referenceData.colors : [];
    return {
      facade: list.filter((c) => c?.type === "facade"),
      corpus: list.filter((c) => c?.type === "corpus"),
      universal: list.filter((c) => !c?.type),
    };
  }, [referenceData.colors]);

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
      { number: 3, title: isKitchen ? "Состав/Размеры" : "Состав/Габариты", icon: FaRulerCombined },
      { number: 4, title: "Фото", icon: FaCamera },
      { number: 5, title: "Цена", icon: FaDollarSign },
    ],
    [isKitchen]
  );

  useEffect(() => {
    getRef.current = get;
    loggerRef.current = logger;
  }, [get, logger]);

  useEffect(() => {
    if (!openPrimary && !openSecondary) return;

    const onPointerDown = (e) => {
      const root = colorPickerRef.current;
      if (!root) return;
      if (root.contains(e.target)) return;
      setOpenPrimary(false);
      setOpenSecondary(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openPrimary, openSecondary]);

  useEffect(() => {
    const loadReferences = async () => {
      if (referenceData.isLoaded) return;
      setLoading(true);
      try {
        if (!colorsCachePromise) {
          colorsCachePromise = getRef.current("/colors", { limit: 500, is_active: true }).then((res) => {
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
          baseSku: "",
          sku: data.sku || "",
          name: data.name || "",
          description: data.description || "",
          kitchen_type_id: data.kitchen_type_id ?? "",
          material_id: data.material_id ?? "",
          collection_id: data.collection_id ?? "",
          primary_color_id: data.primary_color_id ?? "",
          secondary_color_id: data.secondary_color_id ?? "",
          total_length_mm: data.total_length_mm != null ? String(data.total_length_mm) : "",
          total_depth_mm: data.total_depth_mm != null ? String(data.total_depth_mm) : "",
          total_height_mm: data.total_height_mm != null ? String(data.total_height_mm) : "",
          countertop_length_mm: data.countertop_length_mm != null ? String(data.countertop_length_mm) : "",
          countertop_depth_mm: data.countertop_depth_mm != null ? String(data.countertop_depth_mm) : "",
          preview_url: data.preview_url || null,
          base_price: data.base_price != null ? String(data.base_price) : "",
          final_price: data.final_price != null ? String(data.final_price) : "",
          is_active: !!data.is_active,

          characteristics: normalizeCharacteristics(data.characteristics) || {},
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
          primary_color_id: data.primary_color_id ?? "",
          secondary_color_id: data.secondary_color_id ?? "",
          total_length_mm: data.total_length_mm != null ? String(data.total_length_mm) : "",
          total_depth_mm: data.total_depth_mm != null ? String(data.total_depth_mm) : "",
          total_height_mm: data.total_height_mm != null ? String(data.total_height_mm) : "",
          countertop_length_mm: data.countertop_length_mm != null ? String(data.countertop_length_mm) : "",
          countertop_depth_mm: data.countertop_depth_mm != null ? String(data.countertop_depth_mm) : "",
          preview_url: data.preview_url || null,
          final_price: data.final_price != null ? String(data.final_price) : "",
          is_active: false,

          characteristics: normalizeCharacteristics(data.characteristics) || {},
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
      const next = {
        ...prev,
        total_length_mm: String(bottomTotal || ""),
        total_depth_mm: String(maxDepth || ""),
        total_height_mm: String(totalHeight || ""),
        countertop_length_mm: String(bottomTotal || ""),
        countertop_depth_mm: String(bottomMaxDepth || maxDepth || ""),
      };
      return next;
    });
  }, [isKitchen, referenceData.catalogItems, referenceData.modules, selectedCatalogItems, selectedModulesByType, buildSku]);

  const moduleIdsPayload = useMemo(() => {
    const order = ["bottom", "top"];
    return order
      .flatMap((type) =>
        (selectedModulesByType[type] || []).flatMap((m) =>
          Array(Math.max(1, Number(m.quantity) || 1)).fill(Number(m.moduleId))
        )
      )
      .filter((v) => Number.isFinite(v));
  }, [selectedModulesByType]);

  const moduleItemsPayload = useMemo(() => {
    const order = ["bottom", "top"];
    const items = [];
    let pos = 0;
    for (const type of order) {
      for (const m of selectedModulesByType[type] || []) {
        const qty = Math.max(1, Number(m.quantity) || 1);
        const baseUid = m.positionUid || `tmp-${type}-${pos}`;
        for (let k = 0; k < qty; k++) {
          items.push({
            moduleId: Number(m.moduleId),
            positionUid: k === 0 ? baseUid : `${baseUid}-${k}`,
            positionType: type,
            positionOrder: pos,
          });
          pos++;
        }
      }
    }
    return items.filter((x) => Number.isFinite(x.moduleId) && x.moduleId > 0);
  }, [selectedModulesByType]);

  const componentItemsPayload = useMemo(() => {
    if (isKitchen) {
      return moduleItemsPayload.map((x) => ({
        componentType: "module",
        moduleId: x.moduleId,
        positionUid: x.positionUid,
        positionType: x.positionType,
        positionOrder: x.positionOrder,
      }));
    }

    const items = [];
    let pos = 0;
    for (const c of selectedCatalogItems) {
      const qty = Math.max(1, Number(c.quantity) || 1);
      const baseUid = c.positionUid || `tmp-ci-${pos}`;
      for (let k = 0; k < qty; k++) {
        items.push({
          componentType: "catalogItem",
          catalogItemId: Number(c.catalogItemId),
          positionUid: k === 0 ? baseUid : `${baseUid}-${k}`,
          positionType: "component",
          positionOrder: pos,
        });
        pos++;
      }
    }
    return items.filter((x) => Number.isFinite(x.catalogItemId) && x.catalogItemId > 0);
  }, [isKitchen, moduleItemsPayload, selectedCatalogItems]);

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

    if (!form.material_id || !form.primary_color_id) {
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
      const payload = {
        name: String(form.name).trim(),
        base_sku: String(form.baseSku || "").trim() || null,
        sku: String(effectiveSku).trim(),
        description: String(form.description).trim(),

        characteristics: normalizeCharacteristics(form.characteristics),
        category_group: fixedValues?.category_group || null,
        category: fixedValues?.category || null,
        kitchen_type_id: Number(form.kitchen_type_id) || null,
        material_id: Number(form.material_id) || null,
        collection_id: form.collection_id ? Number(form.collection_id) : null,
        primary_color_id: Number(form.primary_color_id) || null,
        secondary_color_id: form.secondary_color_id ? Number(form.secondary_color_id) : null,

        total_length_mm: Number(form.total_length_mm) || null,
        total_depth_mm: Number(form.total_depth_mm) || null,
        total_height_mm: Number(form.total_height_mm) || null,
        countertop_length_mm: Number(form.countertop_length_mm) || null,
        countertop_depth_mm: Number(form.countertop_depth_mm) || null,

        base_price: 0,
        final_price: 0,
        preview_url: form.preview_url,
        is_active: false,

        parameters: selectedParameters.map((x) => ({ parameter_id: x.parameterId, quantity: x.quantity, value: x.value })),
        parameterCategories: selectedParameterCategories.map((id) => ({ category_id: id })),

        moduleIds: moduleIdsPayload,
        moduleItems: moduleItemsPayload,
        componentItems: componentItemsPayload,
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
  }, [componentItemsPayload, fixedValues?.category, fixedValues?.category_group, form, kitId, moduleIdsPayload, moduleItemsPayload, post]);

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
      const payload = {
        name: String(form.name).trim(),
        base_sku: String(form.baseSku || "").trim() || null,
        sku: String(effectiveSku).trim(),
        description: String(form.description).trim(),

        characteristics: normalizeCharacteristics(form.characteristics),
        category_group: fixedValues?.category_group || null,
        category: fixedValues?.category || null,
        kitchen_type_id: Number(form.kitchen_type_id) || null,
        material_id: Number(form.material_id) || null,
        collection_id: form.collection_id ? Number(form.collection_id) : null,
        primary_color_id: Number(form.primary_color_id) || null,
        secondary_color_id: form.secondary_color_id ? Number(form.secondary_color_id) : null,

        total_length_mm: Number(form.total_length_mm) || null,
        total_depth_mm: Number(form.total_depth_mm) || null,
        total_height_mm: Number(form.total_height_mm) || null,
        countertop_length_mm: Number(form.countertop_length_mm) || null,
        countertop_depth_mm: Number(form.countertop_depth_mm) || null,

        base_price: Number(computedBasePrice) || 0,
        final_price: price,
        preview_url: form.preview_url,
        is_active: true,

        parameters: selectedParameters.map((x) => ({ parameter_id: x.parameterId, quantity: x.quantity, value: x.value })),
        parameterCategories: selectedParameterCategories.map((id) => ({ category_id: id })),

        moduleIds: moduleIdsPayload,
        moduleItems: moduleItemsPayload,
        componentItems: componentItemsPayload,
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
        primary_color_id: "",
        secondary_color_id: "",
        total_length_mm: "",
        total_depth_mm: "",
        total_height_mm: "",
        countertop_length_mm: "",
        countertop_depth_mm: "",
        preview_url: null,
        final_price: "",
        is_active: false,

        characteristics: {},
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
    setStep(4);
  };

  const goToPrice = async () => {
    const id = await createKitIfNeeded();
    if (!id) return;
    setStep(5);
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

  const selectedPrimaryColor = referenceData.colors.find((c) => c.id === Number(form.primary_color_id));
  const selectedSecondaryColor = referenceData.colors.find((c) => c.id === Number(form.secondary_color_id));

  const skuPreview = useMemo(() => {
    if (String(form.sku || "").trim()) return "";
    const articleName = String(form.baseSku || "").trim() || String(form.name || "").trim();

    const parts = [
      normalizeSkuPart(articleName),
      normalizeNum(form.total_length_mm),
      normalizeNum(form.total_depth_mm),
      normalizeNum(form.total_height_mm),
      normalizeSkuPart(selectedPrimaryColor?.sku || ""),
      normalizeSkuPart(selectedSecondaryColor?.sku || ""),
    ].filter(Boolean);

    return parts.length ? parts.join("-") : "";
  }, [fixedValues?.category, fixedValues?.category_group, form.baseSku, form.name, form.sku, form.total_depth_mm, form.total_height_mm, form.total_length_mm, selectedPrimaryColor?.sku, selectedSecondaryColor?.sku]);

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

      {step === 1 && (
        <div className="glass-card p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {isKitchen ? (
              <label className="space-y-2">
                <div className="text-xs font-semibold text-night-700">Тип кухни</div>
                <select
                  value={form.kitchen_type_id}
                  onChange={(e) => setForm((p) => ({ ...p, kitchen_type_id: e.target.value }))}
                  className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900"
                >
                  <option value="">Не выбран</option>
                  {referenceData.kitchenTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.id} {t.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Материал</div>
              <select
                value={form.material_id}
                onChange={(e) => setForm((p) => ({ ...p, material_id: e.target.value }))}
                className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900"
              >
                <option value="">Не выбран</option>
                {referenceData.materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.id} {m.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Коллекция</div>
              <select
                value={form.collection_id}
                onChange={(e) => setForm((p) => ({ ...p, collection_id: e.target.value }))}
                className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900"
              >
                <option value="">Не выбрана</option>
                {referenceData.collections
                  .slice()
                  .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "ru"))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>

            <div className="space-y-3 md:col-span-2" ref={colorPickerRef}>
              <div className="relative py-2">
                <div className="border-t border-night-200" />
                <span className="absolute -top-2 left-3 px-2 text-xs text-night-500 bg-white/70">Выбор цвета</span>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-night-700">Основной цвет</div>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenPrimary((v) => !v);
                      setOpenSecondary(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-night-200 bg-white hover:border-accent transition"
                  >
                    <span className="flex items-center gap-2">
                      {form.primary_color_id ? (
                        <ColorBadge colorData={referenceData.colors.find((c) => c.id === Number(form.primary_color_id))} />
                      ) : (
                        <span className="text-xs text-night-500">Выберите цвет</span>
                      )}
                    </span>
                    <span className="text-night-400">▾</span>
                  </button>
                  {openPrimary && (
                    <div className="relative">
                      <div className="absolute z-[1000] top-full mt-1 w-full rounded-xl border border-night-200 bg-white shadow-xl max-h-80 overflow-auto">
                        <div className="p-2 space-y-2">
                          <div className="text-xs font-semibold text-night-500 uppercase tracking-wide px-1">Основные цвета</div>
                          <div className="space-y-1">
                            {colorsByType.facade.map((c) => {
                              const isSelected = Number(form.primary_color_id) === Number(c.id);
                              return (
                                <button
                                  key={`kit-primary-opt-${c.id}`}
                                  type="button"
                                  onClick={() =>
                                    setForm((p) => {
                                      const next = { ...p, primary_color_id: String(c.id) };
                                      setOpenPrimary(false);
                                      return next;
                                    })
                                  }
                                  className={`w-full flex items-center gap-2 p-2 rounded-lg border transition ${
                                    isSelected ? "border-accent bg-accent/5" : "border-night-200 hover:border-accent"
                                  }`}
                                >
                                  <LazyImg
                                    src={getThumbUrl(c.image_url, { w: 64, h: 64, q: 65, fit: "cover" })}
                                    alt={c.name}
                                    className="h-8 w-8 rounded object-cover border border-night-200 flex-shrink-0"
                                  />
                                  <span className="text-xs text-night-700 truncate">{c.name}</span>
                                </button>
                              );
                            })}
                          </div>
                          <div className="my-2 border-t border-night-200" />
                          <div className="text-xs font-semibold text-night-500 uppercase tracking-wide px-1">Универсальные цвета</div>
                          <div className="space-y-1">
                            {colorsByType.universal.map((c) => {
                              const isSelected = Number(form.primary_color_id) === Number(c.id);
                              return (
                                <button
                                  key={`kit-primary-univ-${c.id}`}
                                  type="button"
                                  onClick={() =>
                                    setForm((p) => {
                                      const next = { ...p, primary_color_id: String(c.id) };
                                      setOpenPrimary(false);
                                      return next;
                                    })
                                  }
                                  className={`w-full flex items-center gap-2 p-2 rounded-lg border transition ${
                                    isSelected ? "border-accent bg-accent/5" : "border-night-200 hover:border-accent"
                                  }`}
                                >
                                  <LazyImg
                                    src={getThumbUrl(c.image_url, { w: 64, h: 64, q: 65, fit: "cover" })}
                                    alt={c.name}
                                    className="h-8 w-8 rounded object-cover border border-night-200 flex-shrink-0"
                                  />
                                  <span className="text-xs text-night-700 truncate">{c.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-night-700">Доп. цвет (опционально)</div>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenSecondary((v) => !v);
                      setOpenPrimary(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-night-200 bg-white hover:border-accent transition"
                  >
                    <span className="flex items-center gap-2">
                      {form.secondary_color_id ? (
                        <ColorBadge colorData={referenceData.colors.find((c) => c.id === Number(form.secondary_color_id))} />
                      ) : (
                        <span className="text-xs text-night-500">Выберите цвет</span>
                      )}
                    </span>
                    <span className="text-night-400">▾</span>
                  </button>
                  {openSecondary && (
                    <div className="relative">
                      <div className="absolute z-[1000] top-full mt-1 w-full rounded-xl border border-night-200 bg-white shadow-xl max-h-80 overflow-auto">
                        <div className="p-2 space-y-2">
                          <div className="text-xs font-semibold text-night-500 uppercase tracking-wide px-1">Доп. цвета</div>
                          <div className="space-y-1">
                            {colorsByType.corpus.map((c) => {
                              const isSelected = Number(form.secondary_color_id) === Number(c.id);
                              return (
                                <button
                                  key={`kit-secondary-opt-${c.id}`}
                                  type="button"
                                  onClick={() => {
                                    setForm((p) => ({ ...p, secondary_color_id: String(c.id) }));
                                    setOpenSecondary(false);
                                  }}
                                  className={`w-full flex items-center gap-2 p-2 rounded-lg border transition ${
                                    isSelected ? "border-green-500 bg-green-50" : "border-night-200 hover:border-green-500"
                                  }`}
                                >
                                  <LazyImg
                                    src={getThumbUrl(c.image_url, { w: 64, h: 64, q: 65, fit: "cover" })}
                                    alt={c.name}
                                    className="h-8 w-8 rounded object-cover border border-night-200 flex-shrink-0"
                                  />
                                  <span className="text-xs text-night-700 truncate">{c.name}</span>
                                </button>
                              );
                            })}
                          </div>
                          <div className="my-2 border-t border-night-200" />
                          <div className="text-xs font-semibold text-night-500 uppercase tracking-wide px-1">Универсальные цвета</div>
                          <div className="space-y-1">
                            {colorsByType.universal.map((c) => {
                              const isSelected = Number(form.secondary_color_id) === Number(c.id);
                              return (
                                <button
                                  key={`kit-secondary-univ-${c.id}`}
                                  type="button"
                                  onClick={() => {
                                    setForm((p) => ({ ...p, secondary_color_id: String(c.id) }));
                                    setOpenSecondary(false);
                                  }}
                                  className={`w-full flex items-center gap-2 p-2 rounded-lg border transition ${
                                    isSelected ? "border-green-500 bg-green-50" : "border-night-200 hover:border-green-500"
                                  }`}
                                >
                                  <LazyImg
                                    src={getThumbUrl(c.image_url, { w: 64, h: 64, q: 65, fit: "cover" })}
                                    alt={c.name}
                                    className="h-8 w-8 rounded object-cover border border-night-200 flex-shrink-0"
                                  />
                                  <span className="text-xs text-night-700 truncate">{c.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <label className="space-y-2 md:col-span-2">
              <div className="text-xs font-semibold text-night-700">baseSku (для артикула)</div>
              <SecureInput
                value={form.baseSku}
                onChange={(v) => setForm((p) => ({ ...p, baseSku: v }))}
                placeholder="Например: PRYAMAYA"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <div
                className="text-xs font-semibold text-night-700"
                title="SKU формируется автоматически из baseSku/названия + суммарных размеров (Д/Г/В) + выбранных цветов. Поле доступно только для просмотра."
              >
                Артикул (SKU)
              </div>
              <SecureInput value={effectiveSku} onChange={() => {}} disabled placeholder="Сформируется автоматически" />
            </label>
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
            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Название</div>
              <SecureInput value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
            </label>
            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Описание</div>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                rows={5}
              />
            </label>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Параметры</div>

              <select
                value={""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  addParameter(v);
                  e.currentTarget.value = "";
                }}
                className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900"
              >
                <option value="">+ Добавить...</option>
                {(referenceData.productParameters || [])
                  .slice()
                  .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "ru"))
                  .map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      #{p.id} {p.name}
                    </option>
                  ))}
              </select>

              {(selectedParameters || []).length === 0 ? (
                <div className="text-xs text-night-500">Параметры не выбраны</div>
              ) : (
                <div className="space-y-2">
                  {selectedParameters.map((p, idx) => {
                    const full = (referenceData.productParameters || []).find((x) => Number(x.id) === Number(p.parameterId));
                    return (
                      <div key={`${p.parameterId}-${idx}`} className="flex flex-wrap items-center justify-between gap-3 border border-night-200 rounded-lg p-3 bg-white">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-night-900 truncate">{full?.name || `#${p.parameterId}`}</div>
                          <div className="text-xs text-night-500">ID: {p.parameterId}</div>
                        </div>
                        <div className="flex items-center gap-2">
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
                            className="w-48"
                            placeholder="Значение"
                          />
                          <SecureInput
                            type="number"
                            value={String(p.quantity ?? 1)}
                            onChange={(v) => updateParameterQty(idx, v)}
                            className="w-24"
                          />
                          <SecureButton type="button" variant="outline" className="px-3 py-2 text-xs" onClick={() => removeParameter(idx)}>
                            Удалить
                          </SecureButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Категории параметров изделий</div>
              <select
                value={""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  addParameterCategory(v);
                  e.currentTarget.value = "";
                }}
                className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900"
              >
                <option value="">+ Добавить...</option>
                {(referenceData.productParameterCategories || [])
                  .slice()
                  .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "ru"))
                  .map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      #{c.id} {c.name}
                    </option>
                  ))}
              </select>

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
                        <SecureButton type="button" variant="outline" className="px-3 py-2 text-xs" onClick={() => removeParameterCategory(idx)}>
                          Удалить
                        </SecureButton>
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

                <select
                  value={""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    addModule(type, v);
                  }}
                  className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900"
                >
                  <option value="">+ Добавить...</option>
                  {list.map((m) => (
                    <option key={`${type}-${m.id}`} value={m.id}>
                      #{m.id} {m.name} ({m.length_mm}×{m.depth_mm}×{m.height_mm})
                    </option>
                  ))}
                </select>

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
                            <SecureButton type="button" variant="ghost" onClick={() => removeModule(type, idx)} className="text-red-600 hover:bg-red-50">
                              Удалить
                            </SecureButton>
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

              <select
                value={""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  addCatalogItem(v);
                }}
                className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900"
              >
                <option value="">+ Добавить...</option>
                {catalogItemsSelectable.map((m) => (
                  <option key={`ci-${m.id}`} value={m.id}>
                    #{m.id} {m.name} ({m.length_mm}×{m.depth_mm}×{m.height_mm})
                  </option>
                ))}
              </select>

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
                          <SecureButton type="button" variant="ghost" onClick={() => removeCatalogItem(idx)} className="text-red-600 hover:bg-red-50">
                            Удалить
                          </SecureButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Длина (мм)</div>
              <SecureInput value={form.total_length_mm} onChange={(v) => setForm((p) => ({ ...p, total_length_mm: v }))} />
            </label>
            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Глубина (мм)</div>
              <SecureInput value={form.total_depth_mm} onChange={(v) => setForm((p) => ({ ...p, total_depth_mm: v }))} />
            </label>
            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Высота (мм)</div>
              <SecureInput value={form.total_height_mm} onChange={(v) => setForm((p) => ({ ...p, total_height_mm: v }))} />
            </label>
            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Столешница (длина, мм)</div>
              <SecureInput value={form.countertop_length_mm} onChange={(v) => setForm((p) => ({ ...p, countertop_length_mm: v }))} />
            </label>
            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Столешница (глубина, мм)</div>
              <SecureInput value={form.countertop_depth_mm} onChange={(v) => setForm((p) => ({ ...p, countertop_depth_mm: v }))} />
            </label>
          </div>

          <div className="flex justify-between">
            <SecureButton type="button" variant="outline" onClick={() => setStep(2)} className="px-4 py-2 flex items-center gap-2">
              <FaArrowLeft /> Назад
            </SecureButton>
            <SecureButton type="button" onClick={goToPhotos} className="px-4 py-2 flex items-center gap-2">
              <FaCamera /> К фото
            </SecureButton>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <div className="glass-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-night-900">Фото</div>
                <div className="text-xs text-night-500">Загрузите фото и выберите превью.</div>
              </div>
              <SecureButton type="button" variant="outline" onClick={() => setStep(3)} className="px-4 py-2 text-xs flex items-center gap-2">
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

      {step === 5 && (
        <div className="glass-card p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Базовая цена (сумма модулей)</div>
              <SecureInput value={String(computedBasePrice || 0)} onChange={() => {}} readOnly disabled />
              <div className="text-xs text-night-500">{formatCurrency(computedBasePrice || 0)}</div>
            </label>
            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Итоговая цена</div>
              <SecureInput value={form.final_price} onChange={(v) => setForm((p) => ({ ...p, final_price: v }))} />
            </label>
          </div>

          <div className="flex justify-between">
            <SecureButton type="button" variant="outline" onClick={() => setStep(4)} className="px-4 py-2 flex items-center gap-2">
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
