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

const KitSolutionCreator = ({ kitSolutionId: initialKitSolutionId = null, onDone }) => {
  const { get, post, put } = useApi();
  const logger = useLogger();

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
  });

  const [selectedModulesByType, setSelectedModulesByType] = useState({
    bottom: [],
    top: [],
  });

  const [lengthWarning, setLengthWarning] = useState(null);

  const steps = useMemo(
    () => [
      { number: 1, title: "Тип кухни", icon: FaCog },
      { number: 2, title: "Описание", icon: FaCheckCircle },
      { number: 3, title: "Состав/Размеры", icon: FaRulerCombined },
      { number: 4, title: "Фото", icon: FaCamera },
      { number: 5, title: "Цена", icon: FaDollarSign },
    ],
    []
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
        const [kitchenTypesRes, materialsRes, colorsRes, collectionsRes, modulesRes, moduleCategoriesRes] = await Promise.all([
          getRef.current("/kitchen-types", { limit: 500, isActive: true }),
          getRef.current("/materials", { limit: 500, isActive: true }),
          getRef.current("/colors", { limit: 500, is_active: true }),
          getRef.current("/collections", { limit: 500, isActive: true }),
          getRef.current("/modules", { limit: 500, isActive: true }),
          getRef.current("/module-categories", { limit: 200 }),
        ]);

        setReferenceData({
          kitchenTypes: Array.isArray(kitchenTypesRes?.data) ? kitchenTypesRes.data : [],
          materials: Array.isArray(materialsRes?.data) ? materialsRes.data : [],
          colors: Array.isArray(colorsRes?.data) ? colorsRes.data : [],
          collections: Array.isArray(collectionsRes?.data) ? collectionsRes.data : [],
          modules: Array.isArray(modulesRes?.data) ? modulesRes.data : [],
          moduleCategories: Array.isArray(moduleCategoriesRes?.data) ? moduleCategoriesRes.data : [],
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
        }));

        const byType = { bottom: [], top: [], tall: [], filler: [], accessory: [] };
        const modulesObj = data.modules || {};
        const bottomList = Array.isArray(modulesObj.bottom) ? modulesObj.bottom : [];
        const topList = Array.isArray(modulesObj.top) ? modulesObj.top : [];
        setSelectedModulesByType({
          bottom: bottomList.map((m) => ({ moduleId: m.id, quantity: 1 })),
          top: topList.map((m) => ({ moduleId: m.id, quantity: 1 })),
        });

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

  const buildSku = useCallback(
    (draft) => {
      const parts = ["KT", draft.baseSku];
      const len = Number(draft.total_length_mm || draft.countertop_length_mm);
      if (Number.isFinite(len) && len > 0) parts.push(String(Math.round(len)));

      const color = draft.primary_color_id
        ? referenceData.colors.find((c) => c.id === Number(draft.primary_color_id))?.sku
        : "";
      if (color) parts.push(String(color));

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
    },
    [referenceData.colors]
  );

  const computeAutoSizes = useCallback(() => {
    const byId = new Map(referenceData.modules.map((m) => [Number(m.id), m]));

    const expand = (type) =>
      (selectedModulesByType[type] || []).flatMap(({ moduleId, quantity }) =>
        Array(Math.max(1, Number(quantity) || 1))
          .fill(byId.get(Number(moduleId)))
          .filter(Boolean)
      );

    const bottomMods = expand("bottom");
    const topMods = expand("top");

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
      if (next.baseSku) {
        next.sku = buildSku(next);
      }
      return next;
    });
  }, [referenceData.modules, selectedModulesByType, buildSku]);

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

  const computedBasePrice = useMemo(() => {
    const byId = new Map(referenceData.modules.map((m) => [Number(m.id), m]));
    const sumForType = (type) =>
      (selectedModulesByType[type] || []).reduce((acc, { moduleId, quantity }) => {
        const m = byId.get(Number(moduleId));
        const price = Number(m?.final_price || m?.price || 0);
        const qty = Math.max(1, Number(quantity) || 1);
        return acc + price * qty;
      }, 0);
    return sumForType("bottom") + sumForType("top");
  }, [referenceData.modules, selectedModulesByType]);

  const moduleCategoryIdsByCode = useMemo(() => {
    const cats = Array.isArray(referenceData.moduleCategories) ? referenceData.moduleCategories : [];
    const map = new Map();
    for (const c of cats) {
      if (!c?.code || !c?.id) continue;
      map.set(String(c.code), Number(c.id));
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

      return null;
    },
    [moduleCategoryIdsByCode]
  );

  const bottomModulesSelectable = useMemo(() => {
    return referenceData.modules.filter((m) => classifyModule(m) === "bottom");
  }, [referenceData.modules, classifyModule]);

  const topModulesSelectable = useMemo(() => {
    return referenceData.modules.filter((m) => classifyModule(m) === "top");
  }, [referenceData.modules, classifyModule]);

  const createKitIfNeeded = useCallback(async () => {
    if (kitId) return kitId;
    if (createLockRef.current) return null;

    if (!form.kitchen_type_id || !form.material_id || !form.primary_color_id) {
      loggerRef.current?.error("Заполните тип кухни, материал и основной цвет");
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
        sku: String(form.sku).trim(),
        description: String(form.description).trim(),
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

        moduleIds: moduleIdsPayload,
      };

      const resp = await post("/kit-solutions", payload);
      const id = resp?.data?.id;
      if (!id) throw new Error("API не вернул id при создании готового решения");
      setKitId(id);
      return id;
    } catch (e) {
      loggerRef.current?.error("Не удалось создать готовое решение", e);
      return null;
    } finally {
      setLoading(false);
      createLockRef.current = false;
    }
  }, [form, kitId, moduleIdsPayload, post]);

  const finalizeKit = async () => {
    if (!kitId) {
      loggerRef.current?.error("Нет kitId. Сначала создайте готовое решение.");
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
        sku: String(form.sku).trim(),
        description: String(form.description).trim(),
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

        moduleIds: moduleIdsPayload,
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
      });
      setSelectedModulesByType({ bottom: [], top: [] });
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
      [type]: [...(prev[type] || []), { moduleId: id, quantity: 1 }],
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

  if (loading && referenceData.isLoaded === false) {
    return (
      <div className="glass-card p-6 text-night-600 flex items-center gap-3">
        <FaSpinner className="animate-spin" /> Загрузка...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {steps.map((s) => (
              <SecureButton
                key={s.number}
                type="button"
                variant={step === s.number ? "primary" : "outline"}
                className="px-3 py-2 text-xs"
                onClick={() => {
                  if (s.number === 4) return;
                  if (s.number === 5) return;
                  setStep(s.number);
                }}
              >
                {s.number}. {s.title}
              </SecureButton>
            ))}
          </div>
          <div className="text-xs text-night-500">ID: {kitId || "—"}</div>
        </div>
      </div>

      {step === 1 && (
        <div className="glass-card p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
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

            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Основной цвет</div>
              <select
                value={form.primary_color_id}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((p) => {
                    const next = { ...p, primary_color_id: v };
                    if (next.baseSku) {
                      next.sku = buildSku(next);
                    }
                    return next;
                  });
                }}
                className="w-full px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900"
              >
                <option value="">Не выбран</option>
                {referenceData.colors.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.id} {c.name}
                  </option>
                ))}
              </select>
              {form.primary_color_id ? (
                <div className="pt-2">
                  <ColorBadge
                    labelPrefix="Выбрано:"
                    colorData={referenceData.colors.find((c) => c.id === Number(form.primary_color_id))}
                  />
                </div>
              ) : null}
            </label>

            <label className="space-y-2">
              <div className="text-xs font-semibold text-night-700">Доп. цвет (опционально)</div>
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
              {form.secondary_color_id ? (
                <div className="pt-2">
                  <ColorBadge
                    labelPrefix="Выбрано:"
                    colorData={referenceData.colors.find((c) => c.id === Number(form.secondary_color_id))}
                  />
                </div>
              ) : null}
            </label>

            <label className="space-y-2 md:col-span-2">
              <div className="text-xs font-semibold text-night-700">baseSku (для артикула)</div>
              <SecureInput
                value={form.baseSku}
                onChange={(v) => {
                  setForm((p) => {
                    const next = { ...p, baseSku: v };
                    if (next.baseSku) {
                      next.sku = buildSku(next);
                    }
                    return next;
                  });
                }}
                placeholder="Например: PRYAMAYA"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <div className="text-xs font-semibold text-night-700">Артикул (SKU)</div>
              <SecureInput
                value={form.sku}
                onChange={(v) => setForm((p) => ({ ...p, sku: v }))}
                placeholder="Сформируется автоматически"
              />
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
              <div className="text-sm font-semibold text-night-900">Состав кухни</div>
              <div className="text-xs text-night-500">Выберите модули и нажмите “Пересчитать размеры”.</div>
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

          {[
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
                <option value="">+ Добавить модуль...</option>
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
                      <div key={`${type}-${idx}`} className="flex flex-wrap items-center justify-between gap-3 border border-night-200 rounded-lg p-3 bg-white">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-night-900 truncate">{full?.name || `Модуль #${m.moduleId}`}</div>
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
          ))}

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
              {loading ? <FaSpinner className="animate-spin" /> : <FaSave />} Сохранить
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
