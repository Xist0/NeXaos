import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaCamera, FaCheckCircle, FaClipboardList, FaCog, FaDollarSign, FaSave, FaSpinner } from "react-icons/fa";
import CatalogItemCharacteristicsForm from "../../CatalogItemCharacteristicsForm";
import useCatalogParameters, { invalidateCatalogParametersCache } from "../../../../hooks/useCatalogParameters";
import useMaterialsForSelect from "../../../../hooks/useMaterialsForSelect";
import {
  characteristicsFromApi,
  createEmptyCharacteristicsForm,
  getCharacteristicDimensions,
  mergeEntityDimensionsIntoCharacteristics,
  normalizeCharacteristicsForSave,
  parseCharacteristicField,
} from "../../../../utils/characteristics";
import SecureButton from "../../../ui/SecureButton";
import SecureInput from "../../../ui/SecureInput";
import useApi from "../../../../hooks/useApi";
import useLogger from "../../../../hooks/useLogger";
import ImageManager from "../../ImageManager";
import FormField from "../../../ui/FormField";
import FormSelect from "../../../ui/FormSelect";

let colorsCache = null;
let colorsCachePromise = null;
let collectionsCache = null;
let collectionsCachePromise = null;

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

const resolveFormDimensions = (form) => {
  const fromChar = getCharacteristicDimensions(form.characteristics);
  return {
    length_mm: toOptionalInt(fromChar.length_mm ?? form.length_mm),
    depth_mm: toOptionalInt(fromChar.depth_mm ?? form.depth_mm),
    height_mm: toOptionalInt(fromChar.height_mm ?? form.height_mm),
  };
};

const CatalogItemCreator = ({ catalogItemId: initialCatalogItemId = null, duplicateFromId = null, submitLabel = "Сохранить", fixedValues = null, title = "", onDone }) => {
  const { get, post, put } = useApi();
  const logger = useLogger();
  const { sections, templatesByField, fieldLabels, loading: catalogLoading, reload: reloadCatalog } = useCatalogParameters(get);
  const { materials: materialsData } = useMaterialsForSelect(get);
  const hardwareItems = useMemo(() => materialsData.hardwareItems || [], [materialsData.hardwareItems]);

  const [hardwareMatrix, setHardwareMatrix] = useState({});

  const fasteningItems = useMemo(() => {
    return (hardwareItems || [])
      .filter((item) => String(item.category || "").trim() === "Крепежная фурнитура")
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ru"));
  }, [hardwareItems]);

  const getRef = useRef(get);
  const loggerRef = useRef(logger);
  const postRef = useRef(post);
  const reloadCatalogRef = useRef(reloadCatalog);
  const sectionsRef = useRef(sections);
  const templatesByFieldRef = useRef(templatesByField);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [isActive, setIsActive] = useState(false);

  const [referenceData, setReferenceData] = useState({
    colors: [],
    collections: [],
    isLoaded: false,
  });
  const [isLoadingReferences, setIsLoadingReferences] = useState(true);

  const [itemId, setItemId] = useState(initialCatalogItemId);
  const createLockRef = useRef(false);

  const [fieldBreakdown, setFieldBreakdown] = useState({});

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
    characteristics: createEmptyCharacteristicsForm(),
  });

  const handlePriceCalculated = useCallback((price) => {
    if (!Number.isFinite(Number(price)) || Number(price) <= 0) return;
    setForm((prev) => {
      if (String(prev.final_price || "").trim()) return prev;
      return { ...prev, final_price: String(Math.ceil(price)) };
    });
  }, []);

  const collectionItems = useMemo(() => {
    return (referenceData.collections || [])
      .slice()
      .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "ru"));
  }, [referenceData.collections]);

  useEffect(() => {
    getRef.current = get;
    loggerRef.current = logger;
    postRef.current = post;
    reloadCatalogRef.current = reloadCatalog;
  }, [get, logger, post, reloadCatalog]);

  useEffect(() => {
    sectionsRef.current = sections;
    templatesByFieldRef.current = templatesByField;
  }, [sections, templatesByField]);

  useEffect(() => {
    const loadRefs = async () => {
      if (referenceData.isLoaded) return;
      setIsLoadingReferences(true);
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

        const [colorsData, collectionsData] = await Promise.all([
          Array.isArray(colorsCache) ? Promise.resolve(colorsCache) : colorsCachePromise,
          Array.isArray(collectionsCache) ? Promise.resolve(collectionsCache) : collectionsCachePromise,
        ]);
        setReferenceData({
          colors: Array.isArray(colorsData) ? colorsData : [],
          collections: Array.isArray(collectionsData) ? collectionsData : [],
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

  /**
   * After saving a catalog item, automatically POST any characteristic values
   * that are NOT already in product_parameter_value_templates, so they appear
   * in future suggestion lists.
   */
  const autoAddNewTemplateValues = useCallback(async (characteristics) => {
    const secs = sectionsRef.current || [];
    const tmpl = templatesByFieldRef.current || {};
    const fieldToParamId = {};
    for (const section of secs) {
      for (const field of section.fields || []) {
        if (field.parameterId && field.key) {
          fieldToParamId[field.key] = field.parameterId;
        }
      }
    }

    const newValues = [];
    for (const [fieldKey, raw] of Object.entries(characteristics || {})) {
      const parsed = parseCharacteristicField(raw);
      const value = String(parsed.value ?? "").trim();
      if (!value) continue;

      const existingValues = tmpl[fieldKey] || [];
      if (existingValues.some((v) => String(v ?? "").trim().toLowerCase() === value.toLowerCase())) continue;

      const parameterId = fieldToParamId[fieldKey];
      if (!parameterId) continue;

      newValues.push({ parameter_id: parameterId, value });
    }

    if (newValues.length === 0) return;

    for (const entry of newValues) {
      try {
        await postRef.current("/product-parameter-value-templates", entry);
      } catch (_) {
        // Value might already exist (race condition / duplicate), ignore
      }
    }

    invalidateCatalogParametersCache();
    try {
      await reloadCatalogRef.current?.();
    } catch (_) {
      // Reload is non-critical
    }
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

        characteristics: normalizeCharacteristicsForSave(form.characteristics),

        category_group: fixedValues?.category_group || null,
        category: fixedValues?.category || null,

        collection_id: toOptionalInt(form.collection_id),
        primary_color_id: toOptionalInt(form.primary_color_id),
        secondary_color_id: toOptionalInt(form.secondary_color_id),

        ...resolveFormDimensions(form),

        base_price: 0,
        final_price: toOptionalNumber(form.final_price) ?? 0,
        preview_url: form.preview_url || null,
        is_active: !!isActive,

      };

      await put(`/catalog-items/${itemId}`, payload);
      await autoAddNewTemplateValues(form.characteristics);
      loggerRef.current?.info("Сохранено");
      onDone?.();
    } catch (e) {
      loggerRef.current?.error("Не удалось сохранить позицию каталога", e);
    } finally {
      setLoading(false);
    }
  }, [canProceedBase, fixedValues?.category, fixedValues?.category_group, form, getEffectiveSku, isActive, itemId, onDone, put]);

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
      characteristics: mergeEntityDimensionsIntoCharacteristics(data.characteristics, {
        length_mm: data.length_mm,
        depth_mm: data.depth_mm,
        height_mm: data.height_mm,
      }),
    }));

    setIsActive(!!data.is_active);
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
      { number: 1, title: "Тип", icon: FaCog },
      { number: 2, title: "Описание", icon: FaCheckCircle },
      { number: 3, title: "Параметры и расчёт", icon: FaClipboardList },
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

        characteristics: normalizeCharacteristicsForSave(form.characteristics),

        category_group: fixedValues?.category_group || null,
        category: fixedValues?.category || null,

        collection_id: toOptionalInt(form.collection_id),
        primary_color_id: toOptionalInt(form.primary_color_id),
        secondary_color_id: toOptionalInt(form.secondary_color_id),

        ...resolveFormDimensions(form),

        base_price: 0,
        final_price: 0,
        preview_url: form.preview_url || null,
        is_active: false,

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

        characteristics: normalizeCharacteristicsForSave(form.characteristics),

        category_group: fixedValues?.category_group || null,
        category: fixedValues?.category || null,

        collection_id: toOptionalInt(form.collection_id),
        primary_color_id: toOptionalInt(form.primary_color_id),
        secondary_color_id: toOptionalInt(form.secondary_color_id),

        ...resolveFormDimensions(form),

        base_price: 0,
        final_price: toOptionalNumber(form.final_price),
        preview_url: form.preview_url,
        is_active: true,

      };

      await put(`/catalog-items/${itemId}`, payload);
      await autoAddNewTemplateValues(form.characteristics);
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

        characteristics: createEmptyCharacteristicsForm(),
      });
    } catch (e) {
      loggerRef.current?.error("Не удалось сохранить позицию каталога", e);
    } finally {
      setLoading(false);
    }
  };

  const selectedPrimaryColor = referenceData.colors.find((c) => c.id === Number(form.primary_color_id));
  const selectedSecondaryColor = referenceData.colors.find((c) => c.id === Number(form.secondary_color_id));

  const skuPreview = useMemo(() => {
    if (String(form.sku || "").trim()) return "";
    const articleName = String(form.baseSku || "").trim() || String(form.name || "").trim();
    const dims = getCharacteristicDimensions(form.characteristics);

    const parts = [
      normalizeSkuPart(articleName),
      normalizeNum(dims.length_mm ?? form.length_mm),
      normalizeNum(dims.depth_mm ?? form.depth_mm),
      normalizeNum(dims.height_mm ?? form.height_mm),
      normalizeSkuPart(selectedPrimaryColor?.sku || ""),
      normalizeSkuPart(selectedSecondaryColor?.sku || ""),
    ].filter(Boolean);

    return parts.length ? parts.join("-") : "";
  }, [
    fixedValues?.category,
    fixedValues?.category_group,
    form.baseSku,
    form.characteristics,
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
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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

            <FormField label="baseSku (для артикула)">
              <SecureInput value={form.baseSku} onChange={(v) => setForm((p) => ({ ...p, baseSku: v }))} />
            </FormField>

            <FormField label="Артикул (SKU)" labelClassName="cursor-help" title="SKU формируется автоматически из baseSku/названия + размеров (Д/Г/В) + выбранных цветов.">
              <SecureInput value={effectiveSku} onChange={() => {}} disabled />
            </FormField>

            <FormField label="Название">
              <SecureInput value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
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
          <FormField label="Описание">
            <textarea
              ref={(el) => {
                if (!el) return;
                el.style.height = "auto";
                el.style.height = Math.max(el.scrollHeight, 48) + "px";
              }}
              value={form.description}
              onChange={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = Math.max(e.target.scrollHeight, 48) + "px";
                setForm((p) => ({ ...p, description: e.target.value }));
              }}
              className="w-full px-4 py-2 border border-night-200 rounded-xl bg-white text-night-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent min-h-[48px] overflow-hidden resize-none"
              rows={1}
            />
          </FormField>
          <div className="flex justify-between pt-4">
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
          {(() => {
            const currentProductType = parseCharacteristicField(form.characteristics.product_type);
            const autoName = String(form.name || "").trim();
            if (!String(currentProductType.value).trim() && autoName) {
              const chars = { ...form.characteristics };
              chars.product_type = { ...currentProductType, value: autoName };
              setForm((p) => ({ ...p, characteristics: chars }));
            }
            return null;
          })()}
          {catalogLoading ? (
            <div className="text-sm text-night-500 flex items-center gap-2">
              <FaSpinner className="animate-spin" /> Загружаем параметры каталога…
            </div>
          ) : (
            <CatalogItemCharacteristicsForm
              value={form.characteristics}
              onChange={(next) => setForm((p) => ({ ...p, characteristics: next }))}
              templatesByField={templatesByField}
              fieldLabels={fieldLabels}
              colors={referenceData.colors}
              hardwareItems={hardwareItems}
              hardwareMatrix={hardwareMatrix}
              onHardwareMatrixChange={setHardwareMatrix}
              fasteningItems={fasteningItems}
              materialsBySourceType={materialsData.bySourceType || {}}
              post={post}
              onPriceCalculated={handlePriceCalculated}
              onFieldBreakdown={(fb) => setFieldBreakdown(fb)}
              fieldBreakdown={fieldBreakdown}
            />
          )}
          <div className="flex justify-between pt-4 border-t border-night-200">
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
          <FormField label="Итоговая цена">
            <SecureInput type="number" value={form.final_price} onChange={(v) => setForm((p) => ({ ...p, final_price: v }))} />
          </FormField>
          <p className="text-xs text-night-400">Цена подставляется автоматически из расчёта на шаге «Параметры и расчёт».</p>

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
