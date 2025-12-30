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

const placeholderImage =
  "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80";

const getImageUrl = (url) => {
  if (!url) return placeholderImage;
  if (url.startsWith("/uploads/")) {
    return import.meta.env.DEV ? `http://localhost:5000${url}` : url;
  }
  return url;
};

const ModuleCreator = ({ moduleId: initialModuleId = null, onDone }) => {
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

    sku: "",
    name: "",
    short_desc: "",

    length_mm: "800",
    depth_mm: "580",
    height_mm: "820",

    facade_color: "",
    corpus_color: "",

    preview_url: null, // ставим из ImageManager
    final_price: ""
  });

  const [referenceData, setReferenceData] = useState({
    baseSkus: [],
    colorsFacade: [],
    colorsCorpus: [],
    isLoaded: false
  });
  const [isLoadingReferences, setIsLoadingReferences] = useState(true);

  useEffect(() => {
    getRef.current = get;
    loggerRef.current = logger;
  }, [get]);

  useEffect(() => {
    if (!initialModuleId) return;

    let active = true;
    setLoading(true);
    getRef.current(`/modules/${initialModuleId}`)
      .then((res) => {
        const data = res?.data;
        if (!active || !data) return;

        const sku = String(data.sku || "");
        const skuParts = sku.split("-");
        const maybeNonce = skuParts[skuParts.length - 1];
        if (/^[a-z0-9]{4}$/i.test(maybeNonce)) {
          skuNonceRef.current = maybeNonce;
        }

        setForm((prev) => ({
          ...prev,
          baseSku: data.base_sku || "",
          description_id: data.description_id ?? null,
          sku: data.sku || "",
          name: data.name || "",
          short_desc: data.short_desc || "",
          length_mm: data.length_mm != null ? String(data.length_mm) : prev.length_mm,
          depth_mm: data.depth_mm != null ? String(data.depth_mm) : prev.depth_mm,
          height_mm: data.height_mm != null ? String(data.height_mm) : prev.height_mm,
          facade_color: data.facade_color || "",
          corpus_color: data.corpus_color || "",
          preview_url: data.preview_url || null,
          final_price: data.final_price != null ? String(data.final_price) : "",
        }));
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
  }, [initialModuleId]);

  useEffect(() => {
    const loadReferencesOnce = async () => {
      if (referenceData.isLoaded) return;
      setIsLoadingReferences(true);
      try {
        const [descriptionsRes, allColorsRes] = await Promise.all([
          getRef.current("/module-descriptions", { limit: 200 }),
          getRef.current("/colors", { limit: 500, is_active: true })
        ]);

        const baseSkus = Array.isArray(descriptionsRes?.data)
          ? descriptionsRes.data.map((d) => ({
              id: d.id,
              code: d.base_sku,
              name: d.name || d.base_sku,
              description: d.description
            }))
          : [];

        const allColors = Array.isArray(allColorsRes?.data) ? allColorsRes.data : [];
        // В colors нет type в entities.config.js, но в данных у тебя оно встречается — оставляем фильтр. [file:84]
        const colorsFacade = allColors.filter((c) => c.type === "facade" || !c.type);
        const colorsCorpus = allColors.filter((c) => c.type === "corpus");

        setReferenceData({ baseSkus, colorsFacade, colorsCorpus, isLoaded: true });
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
          return !!form.baseSku && !!form.description_id;
        case 2:
          return !!form.name && Number(form.length_mm) > 0;
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
    setForm((prev) => ({
      ...prev,
      baseSku: baseSku.code,
      description_id: baseSku.id,
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
    setForm((prev) => {
      const next = { ...prev, facade_color: colorCode };
      next.sku = buildSku(next);
      return next;
    });
  };

  const handleCorpusColorSelect = (colorCode) => {
    if (!form.facade_color) return;
    setForm((prev) => ({ ...prev, corpus_color: colorCode }));
  };

  // ВАЖНО: создаем модуль сразу перед шагом "Фото", чтобы получить числовой ID для images. [file:84][file:89]
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
      // Собираем payload строго по columns modules. [file:84]
      const payload = {
        name: String(form.name || "").trim(),
        sku: String(form.sku || "").trim(),
        short_desc: form.short_desc ? String(form.short_desc) : null,
        preview_url: form.preview_url || null,

        base_sku: form.baseSku || null,
        description_id: Number(form.description_id) || null,

        length_mm: Number(form.length_mm) || null,
        depth_mm: Number(form.depth_mm) || null,
        height_mm: Number(form.height_mm) || null,

        facade_color: form.facade_color || null,
        corpus_color: form.corpus_color || null,

        // цена будет установлена позже
        final_price: 0,
        price: 0,

        // чтобы модуль не светился до финального шага
        is_active: false,

        // если у тебя это обязательно на UI — оставляем
        module_category_id: 1
      };

      // При create schema требуются только "name". Остальное опционально. [file:84]
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
        sku: String(form.sku || "").trim(),
        short_desc: form.short_desc ? String(form.short_desc) : null,
        preview_url: form.preview_url,

        base_sku: form.baseSku || null,
        description_id: Number(form.description_id) || null,

        length_mm: Number(form.length_mm) || null,
        depth_mm: Number(form.depth_mm) || null,
        height_mm: Number(form.height_mm) || null,

        facade_color: form.facade_color || null,
        corpus_color: form.corpus_color || null,

        final_price: Number(form.final_price),
        price: Number(form.final_price),
        is_active: true,
      };

      const resp = await put(`/modules/${moduleId}`, payload);
      logger.info("Модуль сохранен и опубликован:", resp?.data);

      onDone?.();

      // сброс
      setForm({
        baseSku: "",
        description_id: null,
        sku: "",
        name: "",
        short_desc: "",
        length_mm: "800",
        depth_mm: "580",
        height_mm: "820",
        facade_color: "",
        corpus_color: "",
        preview_url: null,
        final_price: ""
      });
      setModuleId(null);
      skuNonceRef.current = null;
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
      sku: "",
      name: "",
      short_desc: "",
      length_mm: "800",
      depth_mm: "580",
      height_mm: "820",
      facade_color: "",
      corpus_color: "",
      preview_url: null,
      final_price: ""
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
    <div className="max-w-6xl mx-auto">
      <div className="glass-card p-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-accent to-accent-dark bg-clip-text text-transparent mb-4">
            Создать модуль
          </h1>
          <p className="text-night-600 max-w-2xl mx-auto">
            Поток: Тип → Размеры → Цвета → Фото/превью → Цена → Сохранить.
          </p>
        </div>

        {/* Progress */}
        <div className="flex justify-center mb-16">
          <div className="flex items-center gap-6">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              return (
                <div key={s.number} className="flex flex-col items-center gap-3 min-w-[120px]">
                  <div
                    className={`w-16 h-16 rounded-3xl flex items-center justify-center text-xl font-bold shadow-lg transition-all duration-300 ${
                      step > s.number
                        ? "bg-green-500 text-white scale-110 shadow-green-500/25"
                        : step === s.number
                        ? "bg-accent text-white shadow-accent/25 ring-4 ring-accent/50"
                        : "bg-night-100 text-night-500 border-2 border-night-200 hover:bg-night-200"
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-medium text-night-700 text-center">{s.title}</div>
                  {idx < steps.length - 1 && (
                    <div
                      className={`w-20 h-1 rounded-full mx-4 ${
                        step > s.number + 1 ? "bg-green-500" : step > s.number ? "bg-accent" : "bg-night-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="text-2xl font-bold text-night-900 text-center mb-12">
              Выберите тип модуля ({referenceData.baseSkus.length})
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {referenceData.baseSkus.map((baseSku) => (
                <div
                  key={baseSku.id}
                  className="group glass-card p-8 hover:shadow-2xl hover:scale-[1.02] cursor-pointer transition-all border-2 border-transparent hover:border-accent rounded-3xl"
                  onClick={() => handleTypeSelect(baseSku)}
                >
                  <div className="w-20 h-20 bg-gradient-to-br from-accent/10 to-accent-dark/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-accent/20">
                    <span className="text-2xl font-bold text-accent group-hover:scale-110">{baseSku.code}</span>
                  </div>
                  <h3 className="font-bold text-xl text-night-900 mb-2 group-hover:text-accent">{baseSku.name}</h3>
                  {baseSku.description && <p className="text-night-600 text-sm">{baseSku.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-8">
            <div className="flex items-start gap-4 mb-12">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 text-night-600 hover:text-night-900 p-3 -m-3 rounded-xl hover:bg-night-100"
              >
                <FaArrowLeft /> Назад
              </button>
              <div className="flex-1 border-b-4 border-accent" />
            </div>

            <div className="bg-gradient-to-r from-night-50 to-accent/5 p-8 rounded-3xl border mb-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-end">
                <div>
                  <label className="block text-sm font-semibold text-night-700 mb-3">SKU</label>
                  <div className="text-3xl font-mono font-bold text-night-900 bg-white px-6 py-4 rounded-2xl border-2 border-accent shadow-lg">
                    {form.sku || "B100-800"}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-night-700 mb-3">Название</label>
                  <SecureInput
                    value={form.name || ""}
                    onChange={(v) => setForm((prev) => ({ ...prev, name: v }))}
                    placeholder="B100 800мм"
                    className="text-xl"
                  />
                </div>
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

            <div className="flex justify-between pt-8 border-t">
              <SecureButton type="button" variant="outline" onClick={() => setStep(1)} className="px-12 py-4 h-16 text-lg">
                Назад
              </SecureButton>
              <SecureButton
                type="button"
                onClick={() => setStep(3)}
                className="px-12 py-4 h-16 text-lg bg-accent hover:bg-accent-dark shadow-xl"
                disabled={!isStepValid(2)}
              >
                Далее: цвета
              </SecureButton>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-12">
            <div className="flex items-start gap-4 mb-12">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 text-night-600 hover:text-night-900 p-3 -m-3 rounded-xl hover:bg-night-100"
              >
                <FaArrowLeft /> Назад
              </button>
              <div className="flex-1 border-b-4 border-accent" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-night-900">
                  <span className="text-accent">Фасад</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-4">
                  {referenceData.colorsFacade.map((color) => {
                    const code = color.code || color.sku;
                    const isSelected = form.facade_color === code;
                    return (
                      <div
                        key={color.id}
                        className={`glass-card p-6 cursor-pointer hover:shadow-2xl hover:scale-105 border-4 rounded-2xl group transition-all ${
                          isSelected ? "border-accent ring-8 ring-accent/40 shadow-2xl scale-105" : "hover:border-accent"
                        }`}
                        onClick={() => handleFacadeColorSelect(code)}
                      >
                        <img
                          src={getImageUrl(color.image_url)}
                          alt={color.name}
                          className="w-full h-32 rounded-xl object-cover mb-4 group-hover:scale-110 transition-transform"
                        />
                        <div className="font-mono font-bold text-lg text-center mb-1">{code}</div>
                        <div className="text-night-700 text-sm text-center">{color.name}</div>
                        {isSelected && (
                          <div className="absolute inset-0 bg-accent/20 rounded-2xl flex items-center justify-center">
                            <FaCheckCircle className="w-12 h-12 text-accent shadow-2xl" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-night-900">Корпус</h3>
                <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-4 ${!canSelectCorpus ? "opacity-50 pointer-events-none" : ""}`}>
                  {referenceData.colorsCorpus.map((color) => {
                    const code = color.code || color.sku;
                    const isSelected = form.corpus_color === code;
                    return (
                      <div
                        key={color.id}
                        className={`glass-card p-6 cursor-pointer hover:shadow-xl hover:scale-102 border-3 rounded-2xl group transition-all ${
                          isSelected ? "border-green-500 ring-4 ring-green-500/30 shadow-xl" : "hover:border-green-400"
                        }`}
                        onClick={() => handleCorpusColorSelect(code)}
                      >
                        <img
                          src={getImageUrl(color.image_url)}
                          alt={color.name}
                          className="w-full h-32 rounded-xl object-cover mb-4 group-hover:scale-105 transition-transform"
                        />
                        <div className="font-mono font-bold text-base text-center mb-1">{code}</div>
                        <div className="text-night-700 text-xs text-center">{color.name}</div>
                        {isSelected && (
                          <div className="absolute inset-0 bg-green-500/20 rounded-2xl flex items-center justify-center">
                            <FaCheckCircle className="w-10 h-10 text-green-600 shadow-xl" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!canSelectCorpus && (
                  <div className="p-6 bg-yellow-50 border-2 border-yellow-200 rounded-2xl text-center">
                    <div className="text-yellow-700">Сначала выберите фасад</div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-12 border-t">
              <SecureButton type="button" variant="outline" onClick={() => setStep(2)} className="px-16 py-4 h-20 text-xl">
                Назад
              </SecureButton>
              <SecureButton
                type="button"
                onClick={goToPhotos}
                className="px-16 py-4 h-20 text-xl bg-accent hover:bg-accent-dark shadow-xl"
                disabled={!isStepValid(3) || loading}
              >
                {loading ? <FaSpinner className="animate-spin mr-2" /> : null}
                Далее: фото
              </SecureButton>
            </div>
          </div>
        )}

        {/* Step 4 Photos */}
        {step === 4 && (
          <div className="space-y-8">
            <div className="flex items-start gap-4 mb-12">
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-2 text-night-600 hover:text-night-900 p-3 -m-3 rounded-xl hover:bg-night-100"
              >
                <FaArrowLeft /> Назад
              </button>
              <div className="flex-1 border-b-4 border-accent" />
            </div>

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

            <div className="flex justify-between pt-12 border-t">
              <SecureButton type="button" variant="outline" onClick={() => setStep(3)} className="px-16 py-4 h-20 text-xl">
                Назад
              </SecureButton>
              <SecureButton
                type="button"
                onClick={goToPrice}
                className="px-16 py-4 h-20 text-xl bg-accent hover:bg-accent-dark shadow-xl"
                disabled={!moduleId || loading}
              >
                Далее: цена
              </SecureButton>
            </div>
          </div>
        )}

        {/* Step 5 Price */}
        {step === 5 && (
          <div className="space-y-12">
            <div className="flex items-start gap-4 mb-16">
              <button
                onClick={() => setStep(4)}
                className="flex items-center gap-2 text-night-600 hover:text-night-900 p-3 -m-3 rounded-xl hover:bg-night-100"
              >
                <FaArrowLeft /> Назад к фото
              </button>
              <div className="flex-1 border-b-4 border-accent" />
            </div>

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

            <div className="flex gap-6 pt-16 border-t-4 border-accent">
              <SecureButton type="button" variant="outline" onClick={() => setStep(4)} className="flex-1 px-16 py-6 h-20 text-xl">
                Назад: фото
              </SecureButton>
              <SecureButton
                type="button"
                onClick={finalizeModule}
                className="flex-1 px-16 py-6 h-20 text-xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-2xl"
                disabled={!moduleId || !isStepValid(5) || !form.preview_url || loading}
              >
                {loading ? <FaSpinner className="animate-spin mr-2" /> : <FaSave className="mr-2" />}
                Сохранить
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
