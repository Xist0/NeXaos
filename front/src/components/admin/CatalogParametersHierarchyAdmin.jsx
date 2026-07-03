import { useCallback, useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaSave, FaTimes, FaSync } from "react-icons/fa";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import FormField from "../ui/FormField";
import AdminNavPlates from "./shared/AdminNavPlates";
import AdminConfirmDialog from "./shared/AdminConfirmDialog";
import useApi from "../../hooks/useApi";
import { transliterate } from "../../utils/translit";
import { invalidateCatalogParametersCache } from "../../hooks/useCatalogParameters";

const SECTION_ORDER = [
  "Общие параметры",
  "Основные характеристики",
  "Дополнительная информация",
];
const sectionSortKey = (name) => {
  const idx = SECTION_ORDER.indexOf(String(name || "").trim());
  return idx >= 0 ? idx : SECTION_ORDER.length;
};

const HIDDEN_PARAM_NAMES = [
  "Тип изделия",
  "Материал корпуса",
  "Материал фасада",
  "Задняя стенка",
  "Пленка",
  "Фрезеровка",
  "Вид и кол-во ящиков",
  "Вид и кол-во Петель",
  "Столешница",
  "Подъёмный механизм",
  "Тип навесов",
];

const LEVEL = { CATEGORIES: "categories", PARAMETERS: "parameters", VALUES: "values" };

const CatalogParametersHierarchyAdmin = () => {
  const { get, post, put, del } = useApi();

  const [level, setLevel] = useState(LEVEL.CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedParameter, setSelectedParameter] = useState(null);

  const [categories, setCategories] = useState([]);
  const [parameters, setParameters] = useState([]);
  const [values, setValues] = useState([]);
  const [loading, setLoading] = useState(true);

  const [categoryPanel, setCategoryPanel] = useState(null);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState(null);

  const [paramPanel, setParamPanel] = useState(null);
  const [paramName, setParamName] = useState("");
  const [editingParamId, setEditingParamId] = useState(null);

  const [valuePanel, setValuePanel] = useState(null);
  const [valueText, setValueText] = useState("");
  const [editingValueId, setEditingValueId] = useState(null);

  const [categoryEditMode, setCategoryEditMode] = useState(false);
  const [paramEditMode, setParamEditMode] = useState(false);
  const [valueEditMode, setValueEditMode] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, paramRes, valRes] = await Promise.all([
        get("/product-parameter-categories", { limit: 500 }),
        get("/product-parameters", { limit: 500 }),
        get("/product-parameter-value-templates", { limit: 2000 }),
      ]);
      setCategories(Array.isArray(catRes?.data) ? catRes.data : []);
      setParameters(Array.isArray(paramRes?.data) ? paramRes.data : []);
      setValues(Array.isArray(valRes?.data) ? valRes.data : []);
      invalidateCatalogParametersCache();
    } catch {
      setCategories([]);
      setParameters([]);
      setValues([]);
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const paramsByCategory = useMemo(() => {
    const map = new Map();
    for (const p of parameters) {
      const cid = Number(p.category_id);
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid).push(p);
    }
    return map;
  }, [parameters]);

  const valuesByParam = useMemo(() => {
    const map = new Map();
    for (const v of values) {
      const pid = Number(v.parameter_id);
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid).push(v);
    }
    return map;
  }, [values]);

  const categoryPlates = useMemo(
    () =>
      [...categories]
        .sort((a, b) => sectionSortKey(a.name) - sectionSortKey(b.name) || String(a.name).localeCompare(String(b.name), "ru"))
        .map((c) => ({
          id: c.id,
          label: c.name,
          deletable: (paramsByCategory.get(Number(c.id)) || []).length === 0,
          raw: c,
        })),
    [categories, paramsByCategory]
  );

  const parameterPlates = useMemo(() => {
    if (!selectedCategory) return [];
    return (paramsByCategory.get(Number(selectedCategory.id)) || [])
      .filter((p) => !HIDDEN_PARAM_NAMES.includes(String(p.name || "").trim()))
      .slice()
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name).localeCompare(String(b.name), "ru"))
      .map((p) => ({
        id: p.id,
        label: p.name,
        subtitle: p.field_key || undefined,
        deletable: (valuesByParam.get(Number(p.id)) || []).length === 0,
        raw: p,
      }));
  }, [selectedCategory, paramsByCategory, valuesByParam]);

  const valuePlates = useMemo(() => {
    if (!selectedParameter) return [];
    return (valuesByParam.get(Number(selectedParameter.id)) || [])
      .slice()
      .sort((a, b) => String(a.value).localeCompare(String(b.value), "ru"))
      .map((v) => ({
        id: v.id,
        label: v.value || "—",
        deletable: true,
        raw: v,
      }));
  }, [selectedParameter, valuesByParam]);

  const makeFieldKey = (name) => {
    const base = transliterate(name).replace(/-/g, "_") || `param_${Date.now()}`;
    return base.slice(0, 120);
  };

  const closeCategoryPanel = () => {
    setCategoryPanel(null);
    setCategoryName("");
    setEditingCategoryId(null);
  };

  const closeParamPanel = () => {
    setParamPanel(null);
    setParamName("");
    setEditingParamId(null);
  };

  const closeValuePanel = () => {
    setValuePanel(null);
    setValueText("");
    setEditingValueId(null);
  };

  const handleSaveCategory = async () => {
    const name = categoryName.trim();
    if (!name) return;
    try {
      if (editingCategoryId) {
        await put(`/product-parameter-categories/${editingCategoryId}`, { name });
      } else {
        await post("/product-parameter-categories", { name });
      }
      closeCategoryPanel();
      await loadAll();
    } catch (e) {
      window.alert(e?.response?.data?.message || e?.message || "Не удалось сохранить категорию");
    }
  };

  const handleSaveParameter = async () => {
    const name = paramName.trim();
    if (!name || !selectedCategory) return;
    try {
      if (editingParamId) {
        await put(`/product-parameters/${editingParamId}`, { name, category_id: selectedCategory.id });
      } else {
        await post("/product-parameters", {
          name,
          category_id: selectedCategory.id,
          field_key: makeFieldKey(name),
          sort_order: (paramsByCategory.get(Number(selectedCategory.id)) || []).length + 1,
        });
      }
      closeParamPanel();
      await loadAll();
    } catch (e) {
      window.alert(e?.response?.data?.message || e?.message || "Не удалось сохранить характеристику");
    }
  };

  const handleSaveValue = async () => {
    const value = valueText.trim();
    if (!value || !selectedParameter) return;
    try {
      if (editingValueId) {
        await put(`/product-parameter-value-templates/${editingValueId}`, {
          parameter_id: selectedParameter.id,
          value,
          quantity: 1,
        });
      } else {
        await post("/product-parameter-value-templates", {
          parameter_id: selectedParameter.id,
          value,
          quantity: 1,
        });
      }
      closeValuePanel();
      await loadAll();
    } catch (e) {
      window.alert(e?.response?.data?.message || e?.message || "Не удалось сохранить позицию");
    }
  };

  const handleDeleteCategory = (item) => {
    if (!item.deletable) {
      window.alert("Нельзя удалить: внутри есть характеристики.");
      return;
    }
    setConfirm({
      message: "Вы действительно хотите удалить?",
      onConfirm: async () => {
        try {
          await del(`/product-parameter-categories/${item.id}`);
          if (selectedCategory?.id === item.id) goToCategories();
          await loadAll();
        } catch (e) {
          window.alert(e?.message || "Не удалось удалить");
        }
        setConfirm(null);
      },
    });
  };

  const handleDeleteParameter = (item) => {
    if (!item.deletable) {
      window.alert("Нельзя удалить: есть добавленные позиции значений.");
      return;
    }
    setConfirm({
      message: "Вы действительно хотите удалить?",
      onConfirm: async () => {
        try {
          await del(`/product-parameters/${item.id}`);
          if (selectedParameter?.id === item.id) goToParameters();
          await loadAll();
        } catch (e) {
          window.alert(e?.message || "Не удалось удалить");
        }
        setConfirm(null);
      },
    });
  };

  const handleDeleteValue = (item) => {
    setConfirm({
      message: "Вы действительно хотите удалить?",
      onConfirm: async () => {
        try {
          await del(`/product-parameter-value-templates/${item.id}`);
          await loadAll();
        } catch (e) {
          window.alert(e?.message || "Не удалось удалить");
        }
        setConfirm(null);
      },
    });
  };

  const handleSeedStructure = async () => {
    setSeeding(true);
    try {
      await post("/admin/seed-catalog-parameters");
      await loadAll();
    } catch (e) {
      window.alert(e?.response?.data?.message || e?.message || "Не удалось инициализировать структуру");
    } finally {
      setSeeding(false);
    }
  };

  const goToCategories = () => {
    setLevel(LEVEL.CATEGORIES);
    setSelectedCategory(null);
    setSelectedParameter(null);
    setCategoryEditMode(false);
    setParamEditMode(false);
    setValueEditMode(false);
    closeCategoryPanel();
    closeParamPanel();
    closeValuePanel();
  };

  const goToParameters = () => {
    setLevel(LEVEL.PARAMETERS);
    setSelectedParameter(null);
    setValueEditMode(false);
    closeValuePanel();
  };

  const titles = {
    [LEVEL.CATEGORIES]: "Основной раздел",
    [LEVEL.PARAMETERS]: "Параметры раздела",
    [LEVEL.VALUES]: "Варианты списка",
  };

  return (
    <div className="flex-1 min-w-0 w-full">
      <section className="glass-card p-6 space-y-6">
        <nav className="flex flex-wrap items-center gap-1 text-sm text-night-500">
          <button type="button" onClick={goToCategories} className="hover:text-night-900">
            Параметры каталога
          </button>
          {selectedCategory ? (
            <>
              <span>/</span>
              <button type="button" onClick={goToParameters} className="hover:text-night-900">
                {selectedCategory.name}
              </button>
            </>
          ) : null}
          {selectedParameter ? (
            <>
              <span>/</span>
              <span className="text-night-800 font-medium">{selectedParameter.name}</span>
            </>
          ) : null}
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-night-900">{titles[level]}</h2>
            <p className="text-sm text-night-400 mt-1">
              {level === LEVEL.CATEGORIES && "Общие параметры, Основные характеристики, Дополнительная информация"}
              {level === LEVEL.PARAMETERS && "Например: Тип изделия, Назначение модуля, Тип открывания"}
              {level === LEVEL.VALUES && "Варианты для выпадающего списка при создании позиции каталога"}
            </p>
          </div>
          {level === LEVEL.CATEGORIES ? (
            <SecureButton
              type="button"
              variant="outline"
              onClick={handleSeedStructure}
              disabled={seeding}
              className="px-3 py-2 text-xs flex items-center gap-2"
            >
              <FaSync className={seeding ? "animate-spin" : ""} /> Инициализировать структуру
            </SecureButton>
          ) : null}
        </div>

        {level === LEVEL.CATEGORIES ? (
          <AdminNavPlates
            items={categoryPlates}
            showAdd
            showEdit
            editMode={categoryEditMode}
            onToggleEdit={() => setCategoryEditMode((v) => !v)}
            onStartAdd={() => {
              closeCategoryPanel();
              setCategoryPanel("add");
            }}
            panel={
              categoryPanel ? (
                <div className="rounded-xl border border-night-200 bg-night-50/80 p-4 space-y-4 max-w-lg">
                  <div className="text-sm font-semibold text-night-800">
                    {editingCategoryId ? "Редактировать раздел" : "Новый раздел"}
                  </div>
                  <FormField label="Название раздела" required>
                    <SecureInput value={categoryName} onChange={setCategoryName} placeholder="Общие параметры" />
                  </FormField>
                  <div className="flex gap-2">
                    <SecureButton type="button" onClick={handleSaveCategory} className="px-4 py-2 text-sm flex items-center gap-2">
                      <FaSave /> Сохранить
                    </SecureButton>
                    <SecureButton type="button" variant="ghost" onClick={closeCategoryPanel} className="px-4 py-2 text-sm flex items-center gap-2">
                      <FaTimes /> Отмена
                    </SecureButton>
                  </div>
                </div>
              ) : null
            }
            onSelectItem={(item) => {
              if (categoryEditMode) {
                setEditingCategoryId(item.id);
                setCategoryName(item.label);
                setCategoryPanel("edit");
                return;
              }
              setSelectedCategory(item.raw);
              setLevel(LEVEL.PARAMETERS);
            }}
            onDeleteItem={handleDeleteCategory}
            emptyLabel={loading ? "Загрузка…" : "Разделы не добавлены. Нажмите «Инициализировать структуру»."}
          />
        ) : null}

        {level === LEVEL.PARAMETERS ? (
          <>
            <AdminNavPlates
              items={parameterPlates}
              showAdd
              showEdit
              editMode={paramEditMode}
              onToggleEdit={() => setParamEditMode((v) => !v)}
              onStartAdd={() => {
                closeParamPanel();
                setParamPanel("add");
              }}
              panel={
                paramPanel ? (
                  <div className="rounded-xl border border-night-200 bg-night-50/80 p-4 space-y-4 max-w-lg">
                    <div className="text-sm font-semibold text-night-800">
                      {editingParamId ? "Редактировать параметр" : "Новый параметр"}
                    </div>
                    <FormField label="Название параметра" required>
                      <SecureInput value={paramName} onChange={setParamName} placeholder="Тип изделия" />
                    </FormField>
                    <div className="flex gap-2">
                      <SecureButton type="button" onClick={handleSaveParameter} className="px-4 py-2 text-sm flex items-center gap-2">
                        <FaSave /> Сохранить
                      </SecureButton>
                      <SecureButton type="button" variant="ghost" onClick={closeParamPanel} className="px-4 py-2 text-sm flex items-center gap-2">
                        <FaTimes /> Отмена
                      </SecureButton>
                    </div>
                  </div>
                ) : null
              }
              onSelectItem={(item) => {
                if (paramEditMode) {
                  setEditingParamId(item.id);
                  setParamName(item.label);
                  setParamPanel("edit");
                  return;
                }
                setSelectedParameter(item.raw);
                setLevel(LEVEL.VALUES);
              }}
              onDeleteItem={handleDeleteParameter}
              emptyLabel={loading ? "Загрузка…" : "Параметры не добавлены."}
            />
            <SecureButton type="button" variant="outline" onClick={goToCategories} className="px-4 py-2 text-sm flex items-center gap-2">
              <FaArrowLeft /> К разделам
            </SecureButton>
          </>
        ) : null}

        {level === LEVEL.VALUES ? (
          <>
            <AdminNavPlates
              items={valuePlates}
              showAdd
              showEdit
              editMode={valueEditMode}
              onToggleEdit={() => setValueEditMode((v) => !v)}
              onStartAdd={() => {
                closeValuePanel();
                setValuePanel("add");
              }}
              panel={
                valuePanel ? (
                  <div className="rounded-xl border border-night-200 bg-night-50/80 p-4 space-y-4 max-w-lg">
                    <div className="text-sm font-semibold text-night-800">
                      {editingValueId ? "Редактировать вариант" : "Новый вариант"}
                    </div>
                    <FormField label="Значение" required>
                      <SecureInput value={valueText} onChange={setValueText} placeholder="Напольный" />
                    </FormField>
                    <div className="flex gap-2">
                      <SecureButton type="button" onClick={handleSaveValue} className="px-4 py-2 text-sm flex items-center gap-2">
                        <FaSave /> Сохранить
                      </SecureButton>
                      <SecureButton type="button" variant="ghost" onClick={closeValuePanel} className="px-4 py-2 text-sm flex items-center gap-2">
                        <FaTimes /> Отмена
                      </SecureButton>
                    </div>
                  </div>
                ) : null
              }
              onSelectItem={(item) => {
                if (valueEditMode) {
                  setEditingValueId(item.id);
                  setValueText(item.label);
                  setValuePanel("edit");
                }
              }}
              onDeleteItem={handleDeleteValue}
              emptyLabel={loading ? "Загрузка…" : "Варианты не добавлены."}
            />
            <SecureButton type="button" variant="outline" onClick={goToParameters} className="px-4 py-2 text-sm flex items-center gap-2">
              <FaArrowLeft /> К параметрам
            </SecureButton>
          </>
        ) : null}
      </section>

      <AdminConfirmDialog open={Boolean(confirm)} message={confirm?.message} onConfirm={confirm?.onConfirm} onCancel={() => setConfirm(null)} />
    </div>
  );
};

export default CatalogParametersHierarchyAdmin;
