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
  FaRulerCombined,
  FaDollarSign
} from "react-icons/fa";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import useApi from "../../hooks/useApi";
import useLogger from "../../hooks/useLogger";
import ImageManager from "./ImageManager";
import { formatCurrency } from "../../utils/format";
import ColorBadge from "../ui/ColorBadge";
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

const ModuleCreator = ({ moduleId: initialModuleId = null, duplicateFromId = null, submitLabel = "Сохранить", fixedModuleCategoryId = null, onDone }) => {
  const { get, post, put } = useApi();
  const logger = useLogger();
  const getRef = useRef(get);
  const loggerRef = useRef(logger);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

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

    length_mm: "800",
    depth_mm: "580",
    height_mm: "820",

    facade_color: "",
    corpus_color: "",

    primary_color_id: "",
    secondary_color_id: "",

    preview_url: null, // ставим из ImageManager
    final_price: "",

    characteristics: {},
  });

  const [selectedParameters, setSelectedParameters] = useState([]);
  const [selectedParameterCategories, setSelectedParameterCategories] = useState([]);

  const [openPrimary, setOpenPrimary] = useState(false);
  const [openSecondary, setOpenSecondary] = useState(false);
  const colorPickerRef = useRef(null);

  useEffect(() => {
    if (!fixedModuleCategoryId) return;
    setForm((prev) => {
      const next = String(fixedModuleCategoryId);
      if (String(prev.module_category_id || "") === next) return prev;
      return {
        ...prev,
        module_category_id: next,
        baseSku: "",
        description_id: null,
        sku: "",
      };
    });
  }, [fixedModuleCategoryId]);

  useEffect(() => {
    const onPointerDown = (e) => {
      if (!openPrimary && !openSecondary) return;
      const el = colorPickerRef.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      setOpenPrimary(false);
      setOpenSecondary(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openPrimary, openSecondary]);

  const colorsByType = useMemo(() => {
    const list = [...(referenceData.colorsFacade || []), ...(referenceData.colorsCorpus || [])];
    return {
      facade: list.filter((c) => c?.type === "facade"),
      corpus: list.filter((c) => c?.type === "corpus"),
      universal: list.filter((c) => !c?.type),
    };
  }, [referenceData.colorsFacade, referenceData.colorsCorpus]);

  const selectedPrimaryColor = useMemo(() => {
    const id = Number(form.primary_color_id);
    if (!Number.isFinite(id) || id <= 0) return null;
    const list = [...(referenceData.colorsFacade || []), ...(referenceData.colorsCorpus || [])];
    return list.find((c) => Number(c.id) === id) || null;
  }, [form.primary_color_id, referenceData.colorsFacade, referenceData.colorsCorpus]);

  const selectedSecondaryColor = useMemo(() => {
    const id = Number(form.secondary_color_id);
    if (!Number.isFinite(id) || id <= 0) return null;
    const list = [...(referenceData.colorsFacade || []), ...(referenceData.colorsCorpus || [])];
    return list.find((c) => Number(c.id) === id) || null;
  }, [form.secondary_color_id, referenceData.colorsFacade, referenceData.colorsCorpus]);

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
      characteristics: normalizeCharacteristics(data.characteristics) || {},
    }));

    const params = Array.isArray(data.parameters) ? data.parameters : [];
    setSelectedParameters(
      params
        .map((p) => ({
          parameterId: Number(p.id),
          quantity: Number.isFinite(Number(p.quantity)) ? Number(p.quantity) : 1,
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
          getRef.current("/colors", { limit: 500, is_active: true }),
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

  const steps = useMemo(
    () => [
      { number: 1, title: "Тип", icon: FaCog },
      { number: 2, title: "Размеры", icon: FaRulerCombined },
      { number: 3, title: "Цвета", icon: FaImage },
      { number: 4, title: "Фото", icon: FaCamera },
      { number: 5, title: "Цена", icon: FaDollarSign }
    ],
    []
  );

  const canSelectCorpus = !!form.facade_color;

  


  const buildSku = useCallback((draft) => {
    const parts = [draft.baseSku];
    const len = Number(draft.length_mm);
    if (Number.isFinite(len) && len > 0) parts.push(String(Math.round(len)));
    if (draft.facade_color) parts.push(draft.facade_color);

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

  const isStepValid = useCallback(
    (s) => {
      switch (s) {
        case 1:
          return !!form.baseSku && !!form.description_id && !!form.module_category_id;
        case 2:
          return !!form.name && Number(form.length_mm) > 0 && !!form.module_category_id;
        case 3:
          return !!form.facade_color;
        case 4:
          // Фото опционально, но модуль к этому моменту должен быть создан (создаем автоматом)
          return true;
        case 5:
          return Number(form.final_price || 0) > 0;
        default:
          return false;
      }
    },
    [form]
  );

  const handleTypeSelect = (baseSku) => {
    const initialSku = buildSku({ baseSku: baseSku.code, length_mm: 800 });

    const categories = Array.isArray(referenceData.moduleCategories) ? referenceData.moduleCategories : [];
    const skuPrefix = String(baseSku.code || "").trim().toUpperCase();
    const inferredCategoryId = form.module_category_id
      ? Number(form.module_category_id)
      : categories.find((c) => {
          const prefix = String(c?.sku_prefix || "").trim().toUpperCase();
          if (!prefix) return false;
          return skuPrefix.startsWith(prefix);
        })?.id;

    setForm((prev) => ({
      ...prev,
      baseSku: baseSku.code,
      description_id: baseSku.id,
      module_category_id:
        prev.module_category_id ||
        inferredCategoryId ||
        baseSku.module_category_id ||
        prev.module_category_id,
      sku: initialSku,
      name: `${baseSku.name} 800мм`,
      length_mm: "800",
      depth_mm: "580",
      height_mm: "820"
    }));
    setStep(2);
  };

  

  const handleDimensionChange = (value, field) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "length_mm") {
        next.sku = buildSku(next);
      }
      return next;
    });
  };

  const handleFacadeColorSelect = (colorCode) => {
    const found = (referenceData.colorsFacade || []).find((c) => (c.code || c.sku) === colorCode) || null;
    setForm((prev) => {
      const next = {
        ...prev,
        facade_color: colorCode,
        primary_color_id: found?.id != null ? String(found.id) : prev.primary_color_id,
      };
      next.sku = buildSku(next);
      return next;
    });
  };

  const handleCorpusColorSelect = (colorCode) => {
    if (!form.facade_color) return;
    const found = (referenceData.colorsCorpus || []).find((c) => (c.code || c.sku) === colorCode) || null;
    setForm((prev) => ({
      ...prev,
      corpus_color: colorCode,
      secondary_color_id: found?.id != null ? String(found.id) : prev.secondary_color_id,
    }));
  };

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

        characteristics: normalizeCharacteristics(form.characteristics),

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

        characteristics: normalizeCharacteristics(form.characteristics),

        base_sku: toOptionalString(form.baseSku),
        description_id: toOptionalInt(form.description_id),

        collection_id: toOptionalInt(form.collection_id),

        length_mm: toOptionalInt(form.length_mm),
        depth_mm: toOptionalInt(form.depth_mm),
        height_mm: toOptionalInt(form.height_mm),

        facade_color: form.facade_color || null,
        corpus_color: form.corpus_color || null,

        module_category_id: toOptionalInt(form.module_category_id),

        final_price: toOptionalNumber(form.final_price),
        price: toOptionalNumber(form.final_price),
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
        length_mm: "800",
        depth_mm: "580",
        height_mm: "820",
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
      length_mm: "800",
      depth_mm: "580",
      height_mm: "820",
      facade_color: "",
      corpus_color: "",
      primary_color_id: "",
      secondary_color_id: "",
      preview_url: null,
      final_price: "",

      characteristics: {},
    });
    setModuleId(null);
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

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-8">

            <div className="bg-gradient-to-r from-night-50 to-accent/5 p-8 rounded-3xl border mb-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-end">
                <div>
                  <label className="block text-sm font-semibold text-night-700 mb-3">Название</label>
                  <SecureInput
                    value={form.name || ""}
                    onChange={(v) => setForm((prev) => ({ ...prev, name: v }))}
                    placeholder="B100 800мм"
                    className="text-xl"
                  />
                  <label className="block text-sm font-semibold text-night-700 mb-3 mt-6">baseSku (для артикула)</label>
                  <SecureInput value={form.baseSku || ""} onChange={() => {}} disabled placeholder="Выбран на предыдущем шаге" />

                  <label
                    className="block text-sm font-semibold text-night-700 mb-3 mt-6"
                    title="SKU формируется автоматически из baseSku + длины + выбранного цвета фасада + случайного суффикса. Поле доступно только для просмотра."
                  >
                    SKU
                  </label>
                  <SecureInput value={form.sku || ""} onChange={() => {}} disabled />
                </div>
              </div>

              <div className="mt-8">
                <label className="block text-sm font-semibold text-night-700 mb-3">
                  Категория модуля <span className="text-accent">*</span>
                </label>
                <select
                  value={form.module_category_id ?? ""}
                  onChange={(e) => {
                    const next = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      module_category_id: next,
                      baseSku: "",
                      description_id: null,
                      sku: "",
                      name: "",
                    }));
                    setStep(1);
                  }}
                  disabled={Boolean(fixedModuleCategoryId)}
                  className="w-full h-14 px-4 rounded-2xl border-2 border-night-200 bg-white text-night-900 focus:outline-none focus:border-accent"
                >
                  <option value="">Выберите категорию…</option>
                  {(referenceData.moduleCategories || [])
                    .slice()
                    .sort((a, b) => Number(a.id) - Number(b.id))
                    .map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}{c.sku_prefix ? ` (${String(c.sku_prefix).toUpperCase()})` : ""}
                      </option>
                    ))}
                </select>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-semibold text-night-700 mb-3">Коллекция</label>
                <select
                  value={form.collection_id ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, collection_id: e.target.value }))}
                  className="w-full h-14 px-4 rounded-2xl border-2 border-night-200 bg-white text-night-900 focus:outline-none focus:border-accent"
                >
                  <option value="">Не выбрана</option>
                  {(referenceData.collections || [])
                    .slice()
                    .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "ru"))
                    .map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div>
                <label className="block text-sm font-semibold text-night-700">
                  Длина <span className="text-accent">*</span>
                </label>
                <SecureInput
                  type="number"
                  value={form.length_mm || ""}
                  onChange={(v) => handleDimensionChange(v, "length_mm")}
                  min={200}
                  max={4000}
                  placeholder="800"
                  className="text-2xl font-mono text-right"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-night-700">Глубина</label>
                <SecureInput
                  type="number"
                  value={form.depth_mm || ""}
                  onChange={(v) => handleDimensionChange(v, "depth_mm")}
                  min={200}
                  max={1000}
                  placeholder="580"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-night-700">Высота</label>
                <SecureInput
                  type="number"
                  value={form.height_mm || ""}
                  onChange={(v) => handleDimensionChange(v, "height_mm")}
                  min={200}
                  max={3000}
                  placeholder="820"
                />
              </div>
            </div>

            <label className="block text-sm font-semibold text-night-700 mb-3">Краткое описание</label>
            <SecureInput
              as="textarea"
              value={form.short_desc || ""}
              onChange={(v) => setForm((prev) => ({ ...prev, short_desc: v }))}
              rows={4}
            />

            <div className="mt-6 space-y-3">
              <div className="text-xs font-semibold text-night-700">Параметры</div>

              <select
                value={""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  addParameter(v);
                  e.currentTarget.value = "";
                }}
                className="w-full h-14 px-4 rounded-2xl border-2 border-night-200 bg-white text-night-900 focus:outline-none focus:border-accent"
              >
                <option value="">+ Добавить параметр…</option>
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
                <div className="text-sm text-night-500">Параметры не выбраны</div>
              ) : (
                <div className="space-y-2">
                  {selectedParameters.map((p, idx) => {
                    const full = (referenceData.productParameters || []).find((x) => Number(x.id) === Number(p.parameterId));
                    return (
                      <div key={`${p.parameterId}-${idx}`} className="flex flex-wrap items-center justify-between gap-3 border border-night-200 rounded-2xl p-3 bg-white">
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
                          <SecureButton
                            type="button"
                            variant="outline"
                            className="px-3 py-2 text-xs"
                            onClick={() => removeParameter(idx)}
                          >
                            Удалить
                          </SecureButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 space-y-3">
              <div className="text-sm font-semibold text-night-900">Категории параметров изделий</div>
              <select
                value={""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  addParameterCategory(v);
                  e.currentTarget.value = "";
                }}
                className="w-full h-14 px-4 rounded-2xl border-2 border-night-200 bg-white text-night-900 focus:outline-none focus:border-accent"
              >
                <option value="">+ Добавить категорию…</option>
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
                <div className="text-sm text-night-500">Категории не выбраны</div>
              ) : (
                <div className="space-y-2">
                  {selectedParameterCategories.map((id, idx) => {
                    const full = (referenceData.productParameterCategories || []).find((x) => Number(x.id) === Number(id));
                    return (
                      <div key={`${id}-${idx}`} className="flex flex-wrap items-center justify-between gap-3 border border-night-200 rounded-2xl p-3 bg-white">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-night-900 truncate">{full?.name || `#${id}`}</div>
                          <div className="text-xs text-night-500">ID: {id}</div>
                        </div>
                        <SecureButton
                          type="button"
                          variant="outline"
                          className="px-3 py-2 text-xs"
                          onClick={() => removeParameterCategory(idx)}
                        >
                          Удалить
                        </SecureButton>
                      </div>
                    );
                  })}

                </div>
              )}
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

        {/* Step 3 */}
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
                      {selectedPrimaryColor ? (
                        <ColorBadge colorData={selectedPrimaryColor} />
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
                                  key={`primary-opt-${c.id}`}
                                  type="button"
                                  onClick={() => {
                                    const code = c.code || c.sku;
                                    handleFacadeColorSelect(code);
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
                                    const code = c.code || c.sku;
                                    handleFacadeColorSelect(code);
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
                      if (!canSelectCorpus) return;
                      setOpenSecondary((v) => !v);
                      setOpenPrimary(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border bg-white transition ${
                      canSelectCorpus ? "border-night-200 hover:border-accent" : "border-night-200 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {selectedSecondaryColor ? (
                        <ColorBadge colorData={selectedSecondaryColor} />
                      ) : (
                        <span className="text-xs text-night-500">Выберите цвет</span>
                      )}
                    </span>
                    <span className="text-night-400">▾</span>
                  </button>

                  {openSecondary && canSelectCorpus && (
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
                                    const code = c.code || c.sku;
                                    handleCorpusColorSelect(code);
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
                                    const code = c.code || c.sku;
                                    handleCorpusColorSelect(code);
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

            <div className="flex justify-between pt-8 border-t">
              <SecureButton type="button" variant="outline" onClick={() => setStep(2)} className="px-4 py-2 flex items-center gap-2">
                <FaArrowLeft /> Назад
              </SecureButton>
              <SecureButton type="button" onClick={goToPhotos} className="px-4 py-2" disabled={!isStepValid(3) || loading}>
                {loading ? <FaSpinner className="animate-spin mr-2" /> : null}
                Далее
              </SecureButton>
            </div>
          </div>
        )}

        {/* Step 4 Photos */}
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
                  setForm((prev) => ({ ...prev, preview_url: previewUrl || null }));
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

        {/* Step 5 Price */}
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
                    <div className="font-mono text-sm break-all">{form.preview_url || "не выбрано"}</div>
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
                <div className="text-right text-2xl font-bold text-accent">
                  {formatCurrency(Number(form.final_price || 0))}
                </div>
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
