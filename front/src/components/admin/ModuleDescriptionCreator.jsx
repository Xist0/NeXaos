import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaCheckCircle, FaCog, FaEdit, FaSave, FaSpinner, FaTag } from "react-icons/fa";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import useApi from "../../hooks/useApi";
import useLogger from "../../hooks/useLogger";

const ModuleDescriptionCreator = ({ descriptionId = null, initialCategoryId = "", onDone }) => {
  const { get, post, put } = useApi();
  const logger = useLogger();

  const getRef = useRef(get);
  const loggerRef = useRef(logger);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [categories, setCategories] = useState([]);
  const [allDescriptions, setAllDescriptions] = useState([]);
  const [isLoadingReferences, setIsLoadingReferences] = useState(true);

  const [form, setForm] = useState({
    module_category_id: initialCategoryId ? String(initialCategoryId) : "",
    base_sku: "",
    name: "",
  });

  useEffect(() => {
    getRef.current = get;
    loggerRef.current = logger;
  }, [get, logger]);

  const categoriesSorted = useMemo(
    () => (Array.isArray(categories) ? categories.slice().sort((a, b) => Number(a.id) - Number(b.id)) : []),
    [categories]
  );

  const selectedCategory = useMemo(() => {
    if (!form.module_category_id) return null;
    return categoriesSorted.find((c) => String(c.id) === String(form.module_category_id)) || null;
  }, [categoriesSorted, form.module_category_id]);

  const selectedPrefix = useMemo(() => {
    const p = selectedCategory?.sku_prefix ? String(selectedCategory.sku_prefix) : "";
    return p.trim().toUpperCase();
  }, [selectedCategory]);

  const baseSkuSuffix = useMemo(() => {
    const full = String(form.base_sku || "").toUpperCase();
    if (!selectedPrefix) return full;
    if (full.startsWith(selectedPrefix)) return full.slice(selectedPrefix.length);
    return full;
  }, [form.base_sku, selectedPrefix]);

  const ensurePrefix = useCallback(
    (raw) => {
      const s = String(raw || "").trim().toUpperCase();
      if (!selectedPrefix) return s;
      return s.startsWith(selectedPrefix) ? s : `${selectedPrefix}${s}`;
    },
    [selectedPrefix]
  );

  const isStepValid = useCallback(
    (s) => {
      switch (s) {
        case 1:
          return !!form.module_category_id;
        case 2:
          return !!form.base_sku && (!selectedPrefix || String(form.base_sku).toUpperCase().startsWith(selectedPrefix));
        case 3:
          return !!form.name && isStepValid(2);
        default:
          return false;
      }
    },
    [form, selectedPrefix]
  );

  useEffect(() => {
    const load = async () => {
      setIsLoadingReferences(true);
      try {
        const [categoriesRes, descriptionsRes] = await Promise.all([
          getRef.current("/module-categories", { limit: 500 }),
          getRef.current("/module-descriptions", { limit: 500 }),
        ]);

        setCategories(Array.isArray(categoriesRes?.data) ? categoriesRes.data : []);
        setAllDescriptions(Array.isArray(descriptionsRes?.data) ? descriptionsRes.data : []);
      } catch (e) {
        loggerRef.current?.error("Не удалось загрузить справочники", e);
        setCategories([]);
        setAllDescriptions([]);
      } finally {
        setIsLoadingReferences(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!descriptionId) return;

    let active = true;
    setLoading(true);
    getRef.current(`/module-descriptions/${descriptionId}`)
      .then((res) => {
        const data = res?.data;
        if (!active || !data) return;

        setForm({
          module_category_id: data.module_category_id != null ? String(data.module_category_id) : "",
          base_sku: String(data.base_sku || "").toUpperCase(),
          name: String(data.name || ""),
        });
        setStep(3);
      })
      .catch((e) => {
        loggerRef.current?.error("Не удалось загрузить подтип", e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [descriptionId]);

  useEffect(() => {
    // Когда выбрали категорию на шаге 1 — автоподставляем префикс в base_sku
    if (!form.module_category_id) return;

    setForm((prev) => {
      const nextBase = ensurePrefix(prev.base_sku || "");
      if (nextBase === prev.base_sku) return prev;
      return { ...prev, base_sku: nextBase };
    });
  }, [form.module_category_id, ensurePrefix]);

  const checkDuplicate = useCallback(
    (candidate) => {
      const sku = String(candidate || "").trim().toUpperCase();
      if (!sku) return null;

      const existing = (Array.isArray(allDescriptions) ? allDescriptions : []).find(
        (d) => String(d?.base_sku || "").trim().toUpperCase() === sku
      );

      if (!existing) return null;
      if (descriptionId && Number(existing.id) === Number(descriptionId)) return null;
      return existing;
    },
    [allDescriptions, descriptionId]
  );

  const save = async () => {
    if (!isStepValid(3)) {
      logger.error("Заполните обязательные поля");
      return;
    }

    if (!selectedPrefix) {
      logger.error("У выбранной категории не задано сокращение (sku_prefix)");
      return;
    }

    const baseSku = ensurePrefix(form.base_sku);
    const dup = checkDuplicate(baseSku);
    if (dup) {
      logger.error(`Подтип с основой артикула "${baseSku}" уже существует (ID: ${dup.id})`);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        module_category_id: Number(form.module_category_id),
        base_sku: baseSku,
        name: String(form.name || "").trim(),
      };

      if (descriptionId) {
        await put(`/module-descriptions/${descriptionId}`, payload);
      } else {
        await post("/module-descriptions", payload);
      }

      onDone?.();
    } catch (e) {
      const status = e?.response?.status;
      if (status === 409) {
        logger.error("Подтип с такой основой артикула уже существует");
        return;
      }
      logger.error("Не удалось сохранить подтип", e?.response?.data || e?.message || e);
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingReferences) {
    return (
      <div className="glass-card p-16 text-center">
        <FaSpinner className="w-16 h-16 text-accent animate-spin mx-auto mb-8" />
        <div className="text-2xl font-bold text-night-900 mb-4">Загружаем справочники</div>
      </div>
    );
  }

  const steps = [
    { number: 1, title: "Категория", icon: FaCog },
    { number: 2, title: "Основа артикула", icon: FaTag },
    { number: 3, title: "Название", icon: FaEdit },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="glass-card p-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-accent-dark bg-clip-text text-transparent mb-3">
            {descriptionId ? "Редактировать подтип" : "Создать подтип"}
          </h1>
          <p className="text-night-600 max-w-2xl mx-auto">Поток: Категория → Основа артикула → Название → Сохранить.</p>
        </div>

        <div className="flex justify-center mb-12">
          <div className="flex items-center gap-6">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              return (
                <div key={s.number} className="flex flex-col items-center gap-3 min-w-[140px]">
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

        {step === 1 && (
          <div className="space-y-8">
            <div className="text-2xl font-bold text-night-900 text-center">Выберите категорию ({categoriesSorted.length})</div>
            {categoriesSorted.length === 0 ? (
              <div className="text-night-600 text-center">Категории не найдены</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoriesSorted.map((c) => (
                  <div
                    key={c.id}
                    className={`group glass-card p-8 hover:shadow-2xl hover:scale-[1.02] cursor-pointer transition-all border-2 rounded-3xl ${
                      String(form.module_category_id) === String(c.id)
                        ? "border-accent"
                        : "border-transparent hover:border-accent"
                    }`}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, module_category_id: String(c.id) }));
                      setStep(2);
                    }}
                  >
                    <div className="w-20 h-20 bg-gradient-to-br from-accent/10 to-accent-dark/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-accent/20">
                      <span className="text-2xl font-bold text-accent group-hover:scale-110">
                        {c.sku_prefix ? String(c.sku_prefix).toUpperCase() : "?"}
                      </span>
                    </div>
                    <h3 className="font-bold text-xl text-night-900 mb-2 group-hover:text-accent">{c.name}</h3>
                    <p className="text-night-600 text-sm">Сокращение: {c.sku_prefix ? String(c.sku_prefix).toUpperCase() : "—"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8">
            <div className="flex items-start gap-4 mb-8">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 text-night-600 hover:text-night-900 p-3 -m-3 rounded-xl hover:bg-night-100"
              >
                <FaArrowLeft /> Назад
              </button>
              <div className="flex-1 border-b-4 border-accent" />
            </div>

            <div className="bg-gradient-to-r from-night-50 to-accent/5 p-8 rounded-3xl border space-y-6">
              <div>
                <div className="text-sm font-semibold text-night-700 mb-2">Категория</div>
                <div className="text-night-900 font-semibold">
                  {selectedCategory?.name || "—"}{selectedPrefix ? ` (${selectedPrefix})` : ""}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-night-700 mb-3">Основа артикула</div>
                <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-3 items-center">
                  <div className="h-14 px-4 rounded-2xl border-2 border-night-200 bg-night-50 text-night-900 flex items-center justify-center font-mono text-xl font-bold">
                    {selectedPrefix || "—"}
                  </div>
                  <SecureInput
                    value={baseSkuSuffix}
                    onChange={(v) => {
                      const raw = String(v || "").toUpperCase();
                      setForm((prev) => ({ ...prev, base_sku: ensurePrefix(raw) }));
                    }}
                    placeholder={selectedPrefix ? `${selectedPrefix}...` : "Основа артикула"}
                    className="text-xl font-mono"
                  />
                </div>
                <div className="text-xs text-night-500 mt-2">Итог: <span className="font-mono">{ensurePrefix(baseSkuSuffix)}</span></div>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <SecureButton type="button" variant="outline" onClick={() => setStep(1)} className="px-12 py-4 h-16 text-lg">
                  Назад
                </SecureButton>
                <SecureButton
                  type="button"
                  onClick={() => {
                    const normalized = ensurePrefix(form.base_sku || baseSkuSuffix);
                    if (!normalized) {
                      logger.error("Заполните основу артикула");
                      return;
                    }
                    if (selectedPrefix && !normalized.startsWith(selectedPrefix)) {
                      logger.error(`Основа артикула должна начинаться с "${selectedPrefix}"`);
                      return;
                    }
                    const dup = checkDuplicate(normalized);
                    if (dup) {
                      logger.error(`Подтип с основой артикула "${normalized}" уже существует (ID: ${dup.id})`);
                      return;
                    }
                    setForm((prev) => ({ ...prev, base_sku: normalized, name: prev.name || normalized }));
                    setStep(3);
                  }}
                  className="px-12 py-4 h-16 text-lg bg-accent hover:bg-accent-dark shadow-xl"
                  disabled={!isStepValid(2) || loading}
                >
                  Далее: название
                </SecureButton>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-10">
            <div className="flex items-start gap-4 mb-8">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 text-night-600 hover:text-night-900 p-3 -m-3 rounded-xl hover:bg-night-100"
              >
                <FaArrowLeft /> Назад
              </button>
              <div className="flex-1 border-b-4 border-accent" />
            </div>

            <div className="bg-gradient-to-r from-night-50 to-accent/5 p-8 rounded-3xl border space-y-6">
              <div>
                <div className="text-sm font-semibold text-night-700 mb-2">Основа артикула</div>
                <div className="text-3xl font-mono font-bold text-night-900 bg-white px-6 py-4 rounded-2xl border-2 border-accent shadow-lg">
                  {ensurePrefix(form.base_sku) || "—"}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-night-700 mb-3">Название</label>
                <SecureInput
                  value={form.name || ""}
                  onChange={(v) => setForm((prev) => ({ ...prev, name: v }))}
                  placeholder="Например: НМР1"
                  className="text-xl"
                />
              </div>

              <div className="flex gap-6 pt-8 border-t">
                <SecureButton type="button" variant="outline" onClick={() => setStep(2)} className="flex-1 px-12 py-4 h-16 text-lg">
                  Назад
                </SecureButton>
                <SecureButton
                  type="button"
                  onClick={save}
                  className="flex-1 px-12 py-4 h-16 text-lg bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-2xl"
                  disabled={!isStepValid(3) || loading}
                >
                  {loading ? <FaSpinner className="animate-spin mr-2" /> : <FaSave className="mr-2" />}
                  Сохранить
                </SecureButton>
              </div>

              {isStepValid(3) && !loading && (
                <div className="flex items-center justify-center gap-2 text-green-700 text-sm">
                  <FaCheckCircle /> Готово к сохранению
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModuleDescriptionCreator;
