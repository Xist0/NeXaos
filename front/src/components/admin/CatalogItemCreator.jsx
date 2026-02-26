import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaCamera, FaCog, FaDollarSign, FaImage, FaRulerCombined, FaSave, FaSpinner } from "react-icons/fa";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import useApi from "../../hooks/useApi";
import useLogger from "../../hooks/useLogger";
import ImageManager from "./ImageManager";
import { formatCurrency } from "../../utils/format";
import ColorBadge from "../ui/ColorBadge";
import { getThumbUrl } from "../../utils/image";
import PopoverSelect from "../ui/PopoverSelect";

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

const normalizeCharacteristics = (value) => {
  const obj = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const next = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    const str = typeof v === "string" ? v.trim() : v;
    if (str === "") continue;
    next[k] = str;
  }
  return next;
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

const CatalogItemCreator = ({ catalogItemId: initialCatalogItemId = null, duplicateFromId = null, submitLabel = "Сохранить", fixedValues = null, title = "", onDone }) => {
  const { get, post, put } = useApi();
  const logger = useLogger();

  const getRef = useRef(get);
  const loggerRef = useRef(logger);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [isActive, setIsActive] = useState(false);

  const [openPrimary, setOpenPrimary] = useState(false);
  const [openSecondary, setOpenSecondary] = useState(false);
  const colorPickerRef = useRef(null);

  const [itemId, setItemId] = useState(initialCatalogItemId);
  const createLockRef = useRef(false);

  const [referenceData, setReferenceData] = useState({
    colors: [],
    collections: [],
    productParameters: [],
    productParameterCategories: [],
    isLoaded: false,
  });
  const [isLoadingReferences, setIsLoadingReferences] = useState(true);

  const [form, setForm] = useState({
    baseSku: "",
    sku: "",
    name: "",
    description: "",
    collection_id: "",
    primary_color_id: "",
    secondary_color_id: "",
    length_mm: "",
    depth_mm: "",
    height_mm: "",
    preview_url: null,
    final_price: "",
  });

  const [selectedParameters, setSelectedParameters] = useState([]);
  const [selectedParameterCategories, setSelectedParameterCategories] = useState([]);

  const [parameterTemplatesById, setParameterTemplatesById] = useState({});
  const templatesLoadingRef = useRef(new Set());

  const [templatesOverlayOpen, setTemplatesOverlayOpen] = useState(false);
  const [allTemplatesLoading, setAllTemplatesLoading] = useState(false);
  const [allTemplates, setAllTemplates] = useState([]);
  const templatesPopoverRef = useRef(null);

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

  const openTemplatesOverlay = useCallback(async () => {
    setTemplatesOverlayOpen(true);
    if (allTemplates.length > 0) return;

    setAllTemplatesLoading(true);
    try {
      const res = await getRef.current("/product-parameter-value-templates", { limit: 500 });
      const list = Array.isArray(res?.data) ? res.data : [];
      setAllTemplates(list);

      setParameterTemplatesById((prev) => {
        const next = { ...prev };
        for (const t of list) {
          const pid = Number(t?.parameter_id);
          if (!Number.isFinite(pid) || pid <= 0) continue;
          const key = String(pid);
          if (!Array.isArray(next[key])) next[key] = [];
          if (!next[key].some((x) => Number(x?.id) === Number(t?.id))) {
            next[key] = [...next[key], t];
          }
        }
        return next;
      });
    } catch (_e) {
      setAllTemplates([]);
    } finally {
      setAllTemplatesLoading(false);
    }
  }, [allTemplates.length]);

  useEffect(() => {
    if (!templatesOverlayOpen) return;
    const onPointerDown = (e) => {
      const root = templatesPopoverRef.current;
      if (!root) return;
      if (root.contains(e.target)) return;
      setTemplatesOverlayOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [templatesOverlayOpen]);

  const applyTemplateToParameter = useCallback(
    ({ parameterId, template }) => {
      const pid = Number(parameterId);
      if (!Number.isFinite(pid) || pid <= 0) return;
      if (!template) return;

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
    },
    []
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

  const updateParameterValue = (index, value) => {
    setSelectedParameters((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], value: value === null || value === undefined ? "" : String(value) };
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

  useEffect(() => {
    const loadRefs = async () => {
      if (referenceData.isLoaded) return;
      setIsLoadingReferences(true);
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

        const [colorsData, collectionsData, productParametersData, productParameterCategoriesData] = await Promise.all([
          Array.isArray(colorsCache) ? Promise.resolve(colorsCache) : colorsCachePromise,
          Array.isArray(collectionsCache) ? Promise.resolve(collectionsCache) : collectionsCachePromise,
          Array.isArray(productParametersCache) ? Promise.resolve(productParametersCache) : productParametersCachePromise,
          Array.isArray(productParameterCategoriesCache)
            ? Promise.resolve(productParameterCategoriesCache)
            : productParameterCategoriesCachePromise,
        ]);
        setReferenceData({
          colors: Array.isArray(colorsData) ? colorsData : [],
          collections: Array.isArray(collectionsData) ? collectionsData : [],
          productParameters: Array.isArray(productParametersData) ? productParametersData : [],
          productParameterCategories: Array.isArray(productParameterCategoriesData) ? productParameterCategoriesData : [],
          isLoaded: true,
        });
      } catch (e) {
        loggerRef.current?.error("Ошибка загрузки справочников", e);
      } finally {
        setIsLoadingReferences(false);
      }
    };

    loadRefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canProceedBase = useCallback(() => {
    if (!form.name || !String(form.name).trim()) return false;
    return true;
  }, [form.name]);

  const getEffectiveSku = useCallback(() => {
    const explicit = String(form.sku || "").trim();
    if (explicit) return explicit;

    const articleName = String(form.baseSku || "").trim() || String(form.name || "").trim();
    const colors = Array.isArray(referenceData.colors) ? referenceData.colors : [];
    const primary = colors.find((c) => Number(c?.id) === Number(form.primary_color_id));
    const secondary = colors.find((c) => Number(c?.id) === Number(form.secondary_color_id));

    const parts = [
      normalizeSkuPart(articleName),
      normalizeNum(form.length_mm),
      normalizeNum(form.depth_mm),
      normalizeNum(form.height_mm),
      normalizeSkuPart(primary?.sku || ""),
      normalizeSkuPart(secondary?.sku || ""),
    ].filter(Boolean);

    return parts.length ? parts.join("-") : "";
  }, [form.baseSku, form.depth_mm, form.height_mm, form.length_mm, form.name, form.primary_color_id, form.secondary_color_id, form.sku, referenceData.colors]);

  const saveItemNow = useCallback(async () => {
    if (!itemId) {
      loggerRef.current?.error("Нет itemId. Сначала создайте позицию.");
      return;
    }

    if (!canProceedBase()) {
      loggerRef.current?.error("Заполните название");
      return;
    }

    if (isActive) {
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
      const payload = {
        base_sku: toOptionalString(form.baseSku),
        sku: toOptionalString(getEffectiveSku()),
        name: String(form.name).trim(),
        description: toOptionalString(form.description),

        characteristics: normalizeCharacteristics(form.characteristics),

        category_group: fixedValues?.category_group || null,
        category: fixedValues?.category || null,

        collection_id: toOptionalInt(form.collection_id),
        primary_color_id: toOptionalInt(form.primary_color_id),
        secondary_color_id: toOptionalInt(form.secondary_color_id),

        length_mm: toOptionalInt(form.length_mm),
        depth_mm: toOptionalInt(form.depth_mm),
        height_mm: toOptionalInt(form.height_mm),

        base_price: 0,
        final_price: toOptionalNumber(form.final_price) ?? 0,
        preview_url: form.preview_url || null,
        is_active: !!isActive,

        parameters: selectedParameters.map((x) => ({ parameter_id: x.parameterId, quantity: x.quantity, value: x.value })),
        parameterCategories: selectedParameterCategories.map((id) => ({ category_id: id })),
      };

      await put(`/catalog-items/${itemId}`, payload);
      loggerRef.current?.info("Сохранено");
      onDone?.();
    } catch (e) {
      loggerRef.current?.error("Не удалось сохранить позицию каталога", e);
    } finally {
      setLoading(false);
    }
  }, [canProceedBase, fixedValues?.category, fixedValues?.category_group, form, getEffectiveSku, isActive, itemId, onDone, put, selectedParameterCategories, selectedParameters]);

  const applyLoadedItemToForm = useCallback((data) => {
    setForm((prev) => ({
      ...prev,
      baseSku: data.base_sku || "",
      sku: data.sku || "",
      name: data.name || "",
      description: data.description || "",
      collection_id: data.collection_id != null ? String(data.collection_id) : "",
      primary_color_id: data.primary_color_id != null ? String(data.primary_color_id) : "",
      secondary_color_id: data.secondary_color_id != null ? String(data.secondary_color_id) : "",
      length_mm: data.length_mm != null ? String(data.length_mm) : "",
      depth_mm: data.depth_mm != null ? String(data.depth_mm) : "",
      height_mm: data.height_mm != null ? String(data.height_mm) : "",
      preview_url: data.preview_url || null,
      final_price: data.final_price != null ? String(data.final_price) : "",
    }));

    setIsActive(!!data.is_active);

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
  }, []);

  useEffect(() => {
    if (!initialCatalogItemId) return;

    let active = true;
    setLoading(true);
    getRef.current(`/catalog-items/${initialCatalogItemId}`)
      .then((res) => {
        const data = res?.data;
        if (!active || !data) return;

        setItemId(data.id);
        applyLoadedItemToForm(data);
        setStep(1);
      })
      .catch((e) => {
        loggerRef.current?.error("Не удалось загрузить позицию каталога для редактирования", e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applyLoadedItemToForm, initialCatalogItemId]);

  useEffect(() => {
    if (!duplicateFromId) return;

    let active = true;
    setLoading(true);
    getRef.current(`/catalog-items/${duplicateFromId}`)
      .then((res) => {
        const data = res?.data;
        if (!active || !data) return;

        applyLoadedItemToForm(data);

        // important: duplication must create a new item
        setItemId(null);
        createLockRef.current = false;
        setStep(1);
      })
      .catch((e) => {
        loggerRef.current?.error("Не удалось загрузить позицию каталога для создания копии", e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applyLoadedItemToForm, duplicateFromId]);

  const steps = useMemo(
    () => [
      { number: 1, title: "Описание", icon: FaCog },
      { number: 2, title: "Размеры", icon: FaRulerCombined },
      { number: 3, title: "Цвета", icon: FaImage },
      { number: 4, title: "Фото", icon: FaCamera },
      { number: 5, title: "Цена", icon: FaDollarSign },
    ],
    []
  );

  const createItemIfNeeded = useCallback(async () => {
    if (itemId) return itemId;
    if (createLockRef.current) return null;

    if (!canProceedBase()) {
      loggerRef.current?.error("Заполните название");
      return null;
    }

    createLockRef.current = true;
    setLoading(true);
    try {
      const payload = {
        base_sku: toOptionalString(form.baseSku),
        sku: toOptionalString(getEffectiveSku()),
        name: String(form.name).trim(),
        description: toOptionalString(form.description),

        characteristics: normalizeCharacteristics(form.characteristics),

        category_group: fixedValues?.category_group || null,
        category: fixedValues?.category || null,

        collection_id: toOptionalInt(form.collection_id),
        primary_color_id: toOptionalInt(form.primary_color_id),
        secondary_color_id: toOptionalInt(form.secondary_color_id),

        length_mm: toOptionalInt(form.length_mm),
        depth_mm: toOptionalInt(form.depth_mm),
        height_mm: toOptionalInt(form.height_mm),

        base_price: 0,
        final_price: 0,
        preview_url: form.preview_url || null,
        is_active: false,

        parameters: selectedParameters.map((x) => ({ parameter_id: x.parameterId, quantity: x.quantity, value: x.value })),
        parameterCategories: selectedParameterCategories.map((id) => ({ category_id: id })),
      };

      const resp = await post("/catalog-items", payload);
      const id = resp?.data?.id;
      if (!id) throw new Error("API не вернул id при создании позиции каталога");
      setItemId(id);
      if (resp?.data?.sku) {
        setForm((p) => ({ ...p, sku: resp.data.sku }));
      }
      return id;
    } catch (e) {
      loggerRef.current?.error("Не удалось создать позицию каталога", e);
      return null;
    } finally {
      setLoading(false);
      createLockRef.current = false;
    }
  }, [canProceedBase, fixedValues?.category, fixedValues?.category_group, form, itemId, post]);

  const goToPhotos = async () => {
    const id = await createItemIfNeeded();
    if (!id) return;
    setStep(4);
  };

  const goToPrice = async () => {
    const id = await createItemIfNeeded();
    if (!id) return;
    setStep(5);
  };

  const finalizeItem = async () => {
    if (!itemId) {
      loggerRef.current?.error("Нет itemId. Сначала создайте позицию.");
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
        base_sku: toOptionalString(form.baseSku),
        sku: toOptionalString(getEffectiveSku()),
        name: String(form.name).trim(),
        description: toOptionalString(form.description),

        category_group: fixedValues?.category_group || null,
        category: fixedValues?.category || null,

        collection_id: toOptionalInt(form.collection_id),
        primary_color_id: toOptionalInt(form.primary_color_id),
        secondary_color_id: toOptionalInt(form.secondary_color_id),

        length_mm: toOptionalInt(form.length_mm),
        depth_mm: toOptionalInt(form.depth_mm),
        height_mm: toOptionalInt(form.height_mm),

        base_price: 0,
        final_price: toOptionalNumber(form.final_price),
        preview_url: form.preview_url,
        is_active: true,

        parameters: selectedParameters.map((x) => ({ parameter_id: x.parameterId, quantity: x.quantity, value: x.value })),
        parameterCategories: selectedParameterCategories.map((id) => ({ category_id: id })),
      };

      await put(`/catalog-items/${itemId}`, payload);
      onDone?.();

      setItemId(null);
      setStep(1);
      setForm({
        baseSku: "",
        sku: "",
        name: "",
        description: "",
        collection_id: "",
        primary_color_id: "",
        secondary_color_id: "",
        length_mm: "",
        depth_mm: "",
        height_mm: "",
        preview_url: null,
        final_price: "",

        characteristics: {},
      });
      setSelectedParameterCategories([]);
    } catch (e) {
      loggerRef.current?.error("Не удалось сохранить позицию каталога", e);
    } finally {
      setLoading(false);
    }
  };

  const colorsByType = useMemo(() => {
    const list = Array.isArray(referenceData.colors) ? referenceData.colors : [];
    return {
      facade: list.filter((c) => c?.type === "facade"),
      corpus: list.filter((c) => c?.type === "corpus"),
      universal: list.filter((c) => !c?.type),
    };
  }, [referenceData.colors]);

  const selectedPrimaryColor = referenceData.colors.find((c) => c.id === Number(form.primary_color_id));
  const selectedSecondaryColor = referenceData.colors.find((c) => c.id === Number(form.secondary_color_id));

  const skuPreview = useMemo(() => {
    if (String(form.sku || "").trim()) return "";
    const articleName = String(form.baseSku || "").trim() || String(form.name || "").trim();

    const parts = [
      normalizeSkuPart(articleName),
      normalizeNum(form.length_mm),
      normalizeNum(form.depth_mm),
      normalizeNum(form.height_mm),
      normalizeSkuPart(selectedPrimaryColor?.sku || ""),
      normalizeSkuPart(selectedSecondaryColor?.sku || ""),
    ].filter(Boolean);

    return parts.length ? parts.join("-") : "";
  }, [
    fixedValues?.category,
    fixedValues?.category_group,
    form.baseSku,
    form.depth_mm,
    form.height_mm,
    form.length_mm,
    form.name,
    form.sku,
    form.primary_color_id,
    form.secondary_color_id,
    referenceData.colors,
    selectedPrimaryColor?.sku,
    selectedSecondaryColor?.sku,
  ]);

  const effectiveSku = form.sku || skuPreview;

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
            <div className="text-sm font-semibold text-night-900">{title || "Позиция каталога"}</div>
            <div className="text-xs text-night-500">ID: {itemId || "—"}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {initialCatalogItemId ? (
              <SecureButton
                type="button"
                onClick={saveItemNow}
                className="px-3 py-2 text-xs flex items-center gap-2"
                disabled={!itemId || loading}
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

      {step === 1 && (
        <div className="glass-card p-6 space-y-4">
          <div className="grid gap-4">
            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Название</div>
              <SecureInput value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
            </label>

            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">baseSku (для артикула)</div>
              <SecureInput value={form.baseSku} onChange={(v) => setForm((p) => ({ ...p, baseSku: v }))} />
            </label>

            <label className="space-y-2">
              <div
                className="text-xs font-semibold text-night-700"
                title="SKU формируется автоматически из baseSku/названия + размеров (Д/Г/В) + выбранных цветов. Поле доступно только для просмотра."
              >
                SKU
              </div>
              <SecureInput value={effectiveSku} onChange={() => {}} disabled />
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

            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Коллекция</div>
              <PopoverSelect
                size="md"
                items={collectionItems}
                value={form.collection_id}
                placeholder="Не выбрана"
                allowClear
                clearLabel="Не выбрана"
                searchable={collectionItems.length > 8}
                getKey={(c) => String(c.id)}
                getLabel={(c) => String(c?.name || "")}
                onChange={(next) => setForm((p) => ({ ...p, collection_id: String(next || "") }))}
                buttonClassName="rounded-lg"
                popoverClassName="rounded-lg max-w-xl"
                maxHeightClassName="max-h-80"
              />
            </label>

            <div className="space-y-3">
              <div className="text-xs font-semibold text-night-700">Параметры</div>
              <div className="relative flex flex-wrap items-center gap-2">
                <div className="min-w-0 w-56">
                  <PopoverSelect
                    size="sm"
                    items={productParameterItems}
                    value={""}
                    placeholder="Параметр…"
                    searchable={productParameterItems.length > 10}
                    getKey={(p) => String(p.id)}
                    getLabel={(p) => `#${p.id} ${p.name}`}
                    onChange={(next) => {
                      const v = String(next || "");
                      if (!v) return;
                      addParameter(v);
                    }}
                    buttonClassName="rounded-lg"
                    popoverClassName="rounded-lg max-w-xl"
                    maxHeightClassName="max-h-80"
                  />
                </div>
                <SecureButton
                  type="button"
                  variant="outline"
                  className="px-4 py-2 text-xs whitespace-nowrap rounded-2xl"
                  onClick={() => {
                    if (templatesOverlayOpen) {
                      setTemplatesOverlayOpen(false);
                      return;
                    }
                    void openTemplatesOverlay();
                  }}
                >
                  Шаблоны параметров
                </SecureButton>

                {templatesOverlayOpen ? (
                  <div
                    ref={templatesPopoverRef}
                    className="absolute left-0 top-full mt-2 z-50 w-full max-w-xl"
                  >
                    <div className="border border-night-200 rounded-lg bg-white shadow-lg overflow-hidden">
                      <div className="px-3 py-2 border-b border-night-100 flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-night-700">Выберите шаблон</div>
                        <SecureButton type="button" variant="outline" className="px-3 py-1.5 text-xs" onClick={() => setTemplatesOverlayOpen(false)}>
                          Закрыть
                        </SecureButton>
                      </div>

                      {allTemplatesLoading ? (
                        <div className="px-3 py-3 text-sm text-night-600">Загрузка…</div>
                      ) : null}

                      {!allTemplatesLoading && allTemplates.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-night-600">Шаблоны не найдены</div>
                      ) : null}

                      {!allTemplatesLoading && allTemplates.length > 0 ? (
                        <div className="max-h-64 overflow-auto">
                          {allTemplates
                            .slice()
                            .sort((a, b) => {
                              const pa = referenceData.productParameters.find((x) => Number(x?.id) === Number(a?.parameter_id));
                              const pb = referenceData.productParameters.find((x) => Number(x?.id) === Number(b?.parameter_id));
                              const n = String(pa?.name || "").localeCompare(String(pb?.name || ""), "ru");
                              if (n !== 0) return n;
                              return String(a?.value || "").localeCompare(String(b?.value || ""), "ru");
                            })
                            .map((t) => {
                              const pid = Number(t?.parameter_id);
                              const full = referenceData.productParameters.find((x) => Number(x?.id) === pid);
                              const labelValue = String(t?.value || "").trim();
                              const labelQty = Number(t?.quantity);
                              const qty = Number.isFinite(labelQty) && labelQty > 0 ? labelQty : 1;
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2 hover:bg-night-50 transition-colors border-b border-night-100 last:border-b-0"
                                  onClick={() => {
                                    applyTemplateToParameter({ parameterId: pid, template: t });
                                    setTemplatesOverlayOpen(false);
                                  }}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-semibold text-night-900 truncate">{full?.name || `#${pid}`}</div>
                                    </div>
                                    <div className="text-xs text-night-700 truncate max-w-[12rem]">{labelValue || "—"}</div>
                                    <div className="text-xs text-night-500 shrink-0">×{qty}</div>
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              {selectedParameters.length > 0 ? (
                <div className="space-y-2">
                  {selectedParameters.map((p, idx) => {
                    const full = referenceData.productParameters.find((x) => Number(x.id) === Number(p.parameterId));
                    const templates = parameterTemplatesById[String(p.parameterId)] || null;
                    if (templates === null) {
                      void ensureParameterTemplatesLoaded(p.parameterId);
                    }
                    return (
                      <div key={`${p.parameterId}-${idx}`} className="flex flex-wrap items-center justify-between gap-3 border border-night-200 rounded-2xl p-3 bg-white">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-night-900 truncate">{full?.name || `#${p.parameterId}`}</div>
                          <div className="text-xs text-night-500">ID: {p.parameterId}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <PopoverSelect
                            size="sm"
                            items={Array.isArray(templates) ? templates : []}
                            value={""}
                            placeholder="Шаблон…"
                            searchable={(Array.isArray(templates) ? templates : []).length > 8}
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
                                const arr = [...prev];
                                if (!arr[idx]) return prev;
                                arr[idx] = {
                                  ...arr[idx],
                                  value: t.value ?? "",
                                  quantity: Number(t.quantity) || 1,
                                };
                                return arr;
                              });
                            }}
                            buttonClassName="h-10 rounded-lg border border-night-200 bg-white text-night-900 text-xs"
                            popoverClassName="rounded-lg"
                            maxHeightClassName="max-h-64"
                          />
                          <SecureInput
                            value={String(p.value)}
                            onChange={(v) => updateParameterValue(idx, v)}
                            placeholder="Значение"
                            className="w-48"
                          />
                          <SecureInput
                            type="number"
                            value={String(p.quantity)}
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
              ) : (
                <div className="text-sm text-night-500">Параметры не выбраны</div>
              )}
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold text-night-700">Категории параметров изделий</div>
              <PopoverSelect
                size="md"
                items={productParameterCategoryItems}
                value={""}
                placeholder="Категория…"
                searchable={productParameterCategoryItems.length > 10}
                getKey={(c) => String(c.id)}
                getLabel={(c) => String(c?.name || "")}
                onChange={(next) => {
                  const v = String(next || "");
                  if (!v) return;
                  addParameterCategory(v);
                }}
                buttonClassName="rounded-lg"
                popoverClassName="rounded-lg max-w-xl"
                maxHeightClassName="max-h-80"
              />

              {(selectedParameterCategories || []).length > 0 ? (
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
              ) : (
                <div className="text-sm text-night-500">Категории не выбраны</div>
              )}
            </div>
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
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Длина (мм)</div>
              <SecureInput type="number" value={form.length_mm} onChange={(v) => setForm((p) => ({ ...p, length_mm: v }))} />
            </label>
            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Глубина (мм)</div>
              <SecureInput type="number" value={form.depth_mm} onChange={(v) => setForm((p) => ({ ...p, depth_mm: v }))} />
            </label>
            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Высота (мм)</div>
              <SecureInput type="number" value={form.height_mm} onChange={(v) => setForm((p) => ({ ...p, height_mm: v }))} />
            </label>
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
        <div className="glass-card p-6 space-y-4">
          <div className="space-y-3" ref={colorPickerRef}>
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
                  {selectedPrimaryColor ? <ColorBadge colorData={selectedPrimaryColor} /> : <span className="text-xs text-night-500">Выберите цвет</span>}
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
                              key={`primary-opt-${c.id}`}
                              type="button"
                              onClick={() => {
                                setForm((p) => ({ ...p, primary_color_id: String(c.id) }));
                                setOpenPrimary(false);
                              }}
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
                              key={`primary-univ-${c.id}`}
                              type="button"
                              onClick={() => {
                                setForm((p) => ({ ...p, primary_color_id: String(c.id) }));
                                setOpenPrimary(false);
                              }}
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
              <div className="text-xs font-semibold text-night-700">Доп. цвет</div>
              <button
                type="button"
                onClick={() => {
                  setOpenSecondary((v) => !v);
                  setOpenPrimary(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-night-200 bg-white hover:border-accent transition"
              >
                <span className="flex items-center gap-2">
                  {selectedSecondaryColor ? <ColorBadge colorData={selectedSecondaryColor} /> : <span className="text-xs text-night-500">Выберите цвет</span>}
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
                              key={`secondary-opt-${c.id}`}
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
                              key={`secondary-univ-${c.id}`}
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

          <div className="flex justify-between">
            <SecureButton type="button" variant="outline" onClick={() => setStep(2)} className="px-4 py-2 flex items-center gap-2">
              <FaArrowLeft /> Назад
            </SecureButton>
            <SecureButton type="button" onClick={goToPhotos} className="px-4 py-2">
              Далее
            </SecureButton>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-night-900">Фото</div>
              <div className="text-xs text-night-500">Загрузите медиа и выберите превью.</div>
            </div>
            <SecureButton type="button" variant="outline" onClick={() => setStep(3)} className="px-4 py-2 flex items-center gap-2">
              <FaArrowLeft /> Назад
            </SecureButton>
          </div>

          <ImageManager
            entityType="catalog-items"
            entityId={itemId}
            onPreviewUpdate={(url) => setForm((p) => ({ ...p, preview_url: url }))}
            onCreateTemp={createItemIfNeeded}
          />

          <div className="flex justify-end">
            <SecureButton type="button" onClick={goToPrice} className="px-4 py-2">
              Далее
            </SecureButton>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="glass-card p-6 space-y-4">
          <label className="space-y-2">
            <div className="text-xs font-semibold text-night-700">Итоговая цена</div>
            <SecureInput type="number" value={form.final_price} onChange={(v) => setForm((p) => ({ ...p, final_price: v }))} />
          </label>

          <div className="flex justify-between">
            <SecureButton type="button" variant="outline" onClick={() => setStep(4)} className="px-4 py-2 flex items-center gap-2">
              <FaArrowLeft /> Назад
            </SecureButton>

            <SecureButton type="button" onClick={finalizeItem} className="px-4 py-2 flex items-center gap-2" disabled={loading}>
              {loading ? <FaSpinner className="animate-spin" /> : <FaSave />} {submitLabel}
            </SecureButton>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-sm text-night-500 flex items-center gap-2 px-2">
          <FaSpinner className="animate-spin" /> Сохраняем...
        </div>
      )}
    </div>
  );
};

export default CatalogItemCreator;
