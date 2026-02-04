import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaCamera, FaCog, FaDollarSign, FaImage, FaRulerCombined, FaSave, FaSpinner } from "react-icons/fa";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import useApi from "../../hooks/useApi";
import useLogger from "../../hooks/useLogger";
import ImageManager from "./ImageManager";
import ColorBadge from "../ui/ColorBadge";

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

const CatalogItemCreator = ({ catalogItemId: initialCatalogItemId = null, fixedValues = null, title = "", onDone }) => {
  const { get, post, put } = useApi();
  const logger = useLogger();

  const getRef = useRef(get);
  const loggerRef = useRef(logger);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [itemId, setItemId] = useState(initialCatalogItemId);
  const createLockRef = useRef(false);

  const [referenceData, setReferenceData] = useState({
    colors: [],
    collections: [],
    isLoaded: false,
  });
  const [isLoadingReferences, setIsLoadingReferences] = useState(true);

  const [form, setForm] = useState({
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

  useEffect(() => {
    getRef.current = get;
    loggerRef.current = logger;
  }, [get, logger]);

  useEffect(() => {
    const loadRefs = async () => {
      if (referenceData.isLoaded) return;
      setIsLoadingReferences(true);
      try {
        const [colorsRes, collectionsRes] = await Promise.all([
          getRef.current("/colors", { limit: 500, is_active: true }),
          getRef.current("/collections", { limit: 500, isActive: true }),
        ]);
        setReferenceData({
          colors: Array.isArray(colorsRes?.data) ? colorsRes.data : [],
          collections: Array.isArray(collectionsRes?.data) ? collectionsRes.data : [],
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

  useEffect(() => {
    if (!initialCatalogItemId) return;

    let active = true;
    setLoading(true);
    getRef.current(`/catalog-items/${initialCatalogItemId}`)
      .then((res) => {
        const data = res?.data;
        if (!active || !data) return;

        setItemId(data.id);
        setForm((prev) => ({
          ...prev,
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
        setStep(1);
      })
      .catch((e) => {
        loggerRef.current?.error("Не удалось загрузить позицию каталога", e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initialCatalogItemId]);

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

  const canProceedBase = useCallback(() => {
    if (!form.name || !String(form.name).trim()) return false;
    return true;
  }, [form.name]);

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
        sku: toOptionalString(form.sku),
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
        final_price: 0,
        preview_url: form.preview_url || null,
        is_active: false,
      };

      const resp = await post("/catalog-items", payload);
      const id = resp?.data?.id;
      if (!id) throw new Error("API не вернул id при создании позиции каталога");
      setItemId(id);
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
        sku: toOptionalString(form.sku),
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
      };

      await put(`/catalog-items/${itemId}`, payload);
      onDone?.();

      setItemId(null);
      setStep(1);
      setForm({
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
    } catch (e) {
      loggerRef.current?.error("Не удалось сохранить позицию каталога", e);
    } finally {
      setLoading(false);
    }
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

  const selectedPrimaryColor = referenceData.colors.find((c) => c.id === Number(form.primary_color_id));
  const selectedSecondaryColor = referenceData.colors.find((c) => c.id === Number(form.secondary_color_id));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-night-900">{title || "Позиция каталога"}</div>
            <div className="text-xs text-night-500">ID: {itemId || "—"}</div>
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
          <div className="grid gap-4">
            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Название</div>
              <SecureInput value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
            </label>

            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">SKU</div>
              <SecureInput value={form.sku} onChange={(v) => setForm((p) => ({ ...p, sku: v }))} />
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
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Основной цвет</div>
              <select
                value={form.primary_color_id}
                onChange={(e) => setForm((p) => ({ ...p, primary_color_id: e.target.value }))}
                className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900"
              >
                <option value="">Не выбран</option>
                {referenceData.colors.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.id} {c.name}
                  </option>
                ))}
              </select>
              {selectedPrimaryColor ? (
                <div className="pt-2">
                  <ColorBadge labelPrefix="Выбрано:" colorData={selectedPrimaryColor} />
                </div>
              ) : null}
            </label>

            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Доп. цвет</div>
              <select
                value={form.secondary_color_id}
                onChange={(e) => setForm((p) => ({ ...p, secondary_color_id: e.target.value }))}
                className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900"
              >
                <option value="">Не выбран</option>
                {referenceData.colors.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.id} {c.name}
                  </option>
                ))}
              </select>
              {selectedSecondaryColor ? (
                <div className="pt-2">
                  <ColorBadge labelPrefix="Выбрано:" colorData={selectedSecondaryColor} />
                </div>
              ) : null}
            </label>
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
              {loading ? <FaSpinner className="animate-spin" /> : <FaSave />} Сохранить
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
