import { useCallback, useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaSave, FaTimes } from "react-icons/fa";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import FormField from "../ui/FormField";
import AdminNavPlates from "./shared/AdminNavPlates";
import AdminConfirmDialog from "./shared/AdminConfirmDialog";
import useApi from "../../hooks/useApi";
import { transliterate } from "../../utils/translit";
import { invalidateCatalogParametersCache } from "../../hooks/useCatalogParameters";

const LEVEL = { CATEGORIES: "categories", PARAMETERS: "parameters", VALUES: "values" };

const CatalogParametersHierarchyAdmin = () => {
  const { get, post, del } = useApi();

  const [level, setLevel] = useState(LEVEL.CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedParameter, setSelectedParameter] = useState(null);

  const [categories, setCategories] = useState([]);
  const [parameters, setParameters] = useState([]);
  const [values, setValues] = useState([]);
  const [loading, setLoading] = useState(true);

  const [categoryPanel, setCategoryPanel] = useState(false);
  const [categoryName, setCategoryName] = useState("");

  const [paramPanel, setParamPanel] = useState(false);
  const [paramName, setParamName] = useState("");

  const [valuePanel, setValuePanel] = useState(false);
  const [valueText, setValueText] = useState("");
  const [paramEditMode, setParamEditMode] = useState(false);
  const [valueEditMode, setValueEditMode] = useState(false);
  const [confirm, setConfirm] = useState(null);

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
        .sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"))
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

  const makeFieldKey = (name, id) => {
    const base = transliterate(name).replace(/-/g, "_") || `param_${id || Date.now()}`;
    return base.slice(0, 120);
  };

  const handleSaveCategory = async () => {
    const name = categoryName.trim();
    if (!name) return;
    try {
      await post("/product-parameter-categories", { name });
      setCategoryPanel(false);
      setCategoryName("");
      await loadAll();
    } catch (e) {
      window.alert(e?.message || "Не удалось сохранить категорию");
    }
  };

  const handleSaveParameter = async () => {
    const name = paramName.trim();
    if (!name || !selectedCategory) return;
    const fieldKey = makeFieldKey(name);
    try {
      await post("/product-parameters", {
        name,
        category_id: selectedCategory.id,
        field_key: fieldKey,
        sort_order: (paramsByCategory.get(Number(selectedCategory.id)) || []).length + 1,
      });
      setParamPanel(false);
      setParamName("");
      await loadAll();
    } catch (e) {
      window.alert(e?.message || "Не удалось сохранить характеристику");
    }
  };

  const handleSaveValue = async () => {
    const value = valueText.trim();
    if (!value || !selectedParameter) return;
    try {
      await post("/product-parameter-value-templates", {
        parameter_id: selectedParameter.id,
        value,
        quantity: 1,
      });
      setValuePanel(false);
      setValueText("");
      await loadAll();
    } catch (e) {
      window.alert(e?.message || "Не удалось сохранить позицию");
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

  const goToCategories = () => {
    setLevel(LEVEL.CATEGORIES);
    setSelectedCategory(null);
    setSelectedParameter(null);
    setParamEditMode(false);
    setValueEditMode(false);
    setCategoryPanel(false);
    setParamPanel(false);
    setValuePanel(false);
  };

  const goToParameters = () => {
    setLevel(LEVEL.PARAMETERS);
    setSelectedParameter(null);
    setValueEditMode(false);
    setValuePanel(false);
  };

  const titles = {
    [LEVEL.CATEGORIES]: "Категории параметров",
    [LEVEL.PARAMETERS]: "Характеристики",
    [LEVEL.VALUES]: "Позиции списка",
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

        <div>
          <h2 className="text-xl font-semibold text-night-900">{titles[level]}</h2>
          <p className="text-sm text-night-400">
            {level === LEVEL.CATEGORIES && "Например: Общие параметры, Основные характеристики"}
            {level === LEVEL.PARAMETERS && "Например: Назначение модуля, Тип открывания"}
            {level === LEVEL.VALUES && "Варианты для выпадающего списка при создании модуля"}
          </p>
        </div>

        {level === LEVEL.CATEGORIES ? (
          <AdminNavPlates
            items={categoryPlates}
            showAdd
            showEdit={false}
            deleteMode="conditional"
            onStartAdd={() => setCategoryPanel(true)}
            panel={
              categoryPanel ? (
                <div className="rounded-xl border border-night-200 bg-night-50/80 p-4 space-y-4 max-w-lg">
                  <div className="text-sm font-semibold text-night-800">Новая категория</div>
                  <FormField label="Название категории" required>
                    <SecureInput value={categoryName} onChange={setCategoryName} placeholder="Общие параметры" />
                  </FormField>
                  <div className="flex gap-2">
                    <SecureButton type="button" onClick={handleSaveCategory} className="px-4 py-2 text-sm flex items-center gap-2">
                      <FaSave /> Сохранить
                    </SecureButton>
                    <SecureButton type="button" variant="ghost" onClick={() => { setCategoryPanel(false); setCategoryName(""); }} className="px-4 py-2 text-sm flex items-center gap-2">
                      <FaTimes /> Отмена
                    </SecureButton>
                  </div>
                </div>
              ) : null
            }
            onSelectItem={(item) => {
              setSelectedCategory(item.raw);
              setLevel(LEVEL.PARAMETERS);
            }}
            onDeleteItem={handleDeleteCategory}
            emptyLabel={loading ? "Загрузка…" : "Категории не добавлены."}
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
              onStartAdd={() => setParamPanel(true)}
              panel={
                paramPanel ? (
                  <div className="rounded-xl border border-night-200 bg-night-50/80 p-4 space-y-4 max-w-lg">
                    <div className="text-sm font-semibold text-night-800">Новая характеристика</div>
                    <FormField label="Название характеристики" required>
                      <SecureInput value={paramName} onChange={setParamName} placeholder="Назначение модуля" />
                    </FormField>
                    <div className="flex gap-2">
                      <SecureButton type="button" onClick={handleSaveParameter} className="px-4 py-2 text-sm flex items-center gap-2">
                        <FaSave /> Сохранить
                      </SecureButton>
                      <SecureButton type="button" variant="ghost" onClick={() => { setParamPanel(false); setParamName(""); }} className="px-4 py-2 text-sm flex items-center gap-2">
                        <FaTimes /> Отмена
                      </SecureButton>
                    </div>
                  </div>
                ) : null
              }
              onSelectItem={(item) => {
                if (paramEditMode) return;
                setSelectedParameter(item.raw);
                setLevel(LEVEL.VALUES);
              }}
              onDeleteItem={handleDeleteParameter}
              emptyLabel={loading ? "Загрузка…" : "Характеристики не добавлены."}
            />
            <SecureButton type="button" variant="outline" onClick={goToCategories} className="px-4 py-2 text-sm flex items-center gap-2">
              <FaArrowLeft /> К категориям
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
              onStartAdd={() => setValuePanel(true)}
              panel={
                valuePanel ? (
                  <div className="rounded-xl border border-night-200 bg-night-50/80 p-4 space-y-4 max-w-lg">
                    <div className="text-sm font-semibold text-night-800">Новая позиция</div>
                    <FormField label="Значение" required>
                      <SecureInput value={valueText} onChange={setValueText} placeholder="Для техники и хранения" />
                    </FormField>
                    <div className="flex gap-2">
                      <SecureButton type="button" onClick={handleSaveValue} className="px-4 py-2 text-sm flex items-center gap-2">
                        <FaSave /> Сохранить
                      </SecureButton>
                      <SecureButton type="button" variant="ghost" onClick={() => { setValuePanel(false); setValueText(""); }} className="px-4 py-2 text-sm flex items-center gap-2">
                        <FaTimes /> Отмена
                      </SecureButton>
                    </div>
                  </div>
                ) : null
              }
              onSelectItem={() => {}}
              onDeleteItem={handleDeleteValue}
              emptyLabel={loading ? "Загрузка…" : "Позиции не добавлены."}
            />
            <SecureButton type="button" variant="outline" onClick={goToParameters} className="px-4 py-2 text-sm flex items-center gap-2">
              <FaArrowLeft /> К характеристикам
            </SecureButton>
          </>
        ) : null}
      </section>

      <AdminConfirmDialog open={Boolean(confirm)} message={confirm?.message} onConfirm={confirm?.onConfirm} onCancel={() => setConfirm(null)} />
    </div>
  );
};

export default CatalogParametersHierarchyAdmin;
