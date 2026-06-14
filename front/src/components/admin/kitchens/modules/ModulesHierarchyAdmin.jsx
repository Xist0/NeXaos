import { useCallback, useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaSave, FaTimes } from "react-icons/fa";
import SecureButton from "../../../ui/SecureButton";
import SecureInput from "../../../ui/SecureInput";
import FormField from "../../../ui/FormField";
import AdminNavPlates from "../../shared/AdminNavPlates";
import AdminConfirmDialog from "../../shared/AdminConfirmDialog";
import ModulesAdmin from "./ModulesAdmin";
import ModuleDescriptionCreator from "./ModuleDescriptionCreator";
import useApi from "../../../../hooks/useApi";
import { transliterate } from "../../../../utils/translit";

const LEVEL = {
  CATEGORIES: "categories",
  DESCRIPTIONS: "descriptions",
  MODULES: "modules",
};

const ModulesHierarchyAdmin = () => {
  const { get, post, del } = useApi();

  const [level, setLevel] = useState(LEVEL.CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedDescription, setSelectedDescription] = useState(null);

  const [categories, setCategories] = useState([]);
  const [descriptions, setDescriptions] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  const [categoryPanel, setCategoryPanel] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", sku_prefix: "" });

  const [descEditMode, setDescEditMode] = useState(false);
  const [descView, setDescView] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, descRes, modRes] = await Promise.all([
        get("/module-categories", { limit: 500 }),
        get("/module-descriptions", { limit: 500 }),
        get("/modules", { limit: 500 }),
      ]);
      setCategories(Array.isArray(catRes?.data) ? catRes.data : []);
      setDescriptions(Array.isArray(descRes?.data) ? descRes.data : []);
      setModules(Array.isArray(modRes?.data) ? modRes.data : []);
    } catch {
      setCategories([]);
      setDescriptions([]);
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const descriptionsByCategory = useMemo(() => {
    const map = new Map();
    for (const d of descriptions) {
      const cid = Number(d.module_category_id);
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid).push(d);
    }
    return map;
  }, [descriptions]);

  const modulesByDescription = useMemo(() => {
    const map = new Map();
    for (const m of modules) {
      const did = Number(m.description_id);
      if (!map.has(did)) map.set(did, []);
      map.get(did).push(m);
    }
    return map;
  }, [modules]);

  const categoryPlates = useMemo(
    () =>
      [...categories]
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name).localeCompare(String(b.name), "ru"))
        .map((c) => ({
          id: c.id,
          label: c.name,
          subtitle: c.sku_prefix ? String(c.sku_prefix).toUpperCase() : undefined,
          deletable: (descriptionsByCategory.get(Number(c.id)) || []).length === 0,
          raw: c,
        })),
    [categories, descriptionsByCategory]
  );

  const descriptionPlates = useMemo(() => {
    if (!selectedCategory) return [];
    const cid = Number(selectedCategory.id);
    return (descriptionsByCategory.get(cid) || [])
      .slice()
      .sort((a, b) => String(a.base_sku || "").localeCompare(String(b.base_sku || ""), "ru"))
      .map((d) => {
        const label = [d.base_sku, d.name].filter(Boolean).join(" ").trim() || `Подтип #${d.id}`;
        return {
          id: d.id,
          label,
          subtitle: d.description || undefined,
          deletable: (modulesByDescription.get(Number(d.id)) || []).length === 0,
          raw: d,
        };
      });
  }, [selectedCategory, descriptionsByCategory, modulesByDescription]);

  const resetCategoryPanel = () => {
    setCategoryPanel(null);
    setCategoryForm({ name: "", sku_prefix: "" });
  };

  const handleSaveCategory = async () => {
    const name = categoryForm.name.trim();
    const skuPrefix = categoryForm.sku_prefix.trim().toUpperCase();
    if (!name || !skuPrefix) return;

    const codeBase = transliterate(skuPrefix || name).replace(/-/g, "_") || `cat_${Date.now()}`;
    const payload = {
      name,
      sku_prefix: skuPrefix,
      code: codeBase.slice(0, 50),
      sort_order: categories.length + 1,
    };

    try {
      await post("/module-categories", payload);
      resetCategoryPanel();
      await loadAll();
    } catch (e) {
      window.alert(e?.message || "Не удалось сохранить тип модуля");
    }
  };

  const handleDeleteCategory = (item) => {
    if (!item.deletable) {
      window.alert("Нельзя удалить тип: внутри есть подтипы модулей.");
      return;
    }
    setConfirm({
      message: "Вы действительно хотите удалить?",
      onConfirm: async () => {
        try {
          await del(`/module-categories/${item.id}`);
          if (selectedCategory?.id === item.id) {
            setSelectedCategory(null);
            setLevel(LEVEL.CATEGORIES);
          }
          await loadAll();
        } catch (e) {
          window.alert(e?.message || "Не удалось удалить");
        }
        setConfirm(null);
      },
    });
  };

  const handleDeleteDescription = (item) => {
    if (!item.deletable) {
      window.alert("Нельзя удалить подтип: внутри есть созданные модули.");
      return;
    }
    setConfirm({
      message: "Вы действительно хотите удалить?",
      onConfirm: async () => {
        try {
          await del(`/module-descriptions/${item.id}`);
          if (selectedDescription?.id === item.id) {
            setSelectedDescription(null);
            setLevel(LEVEL.DESCRIPTIONS);
          }
          await loadAll();
        } catch (e) {
          window.alert(e?.message || "Не удалось удалить");
        }
        setConfirm(null);
      },
    });
  };

  const handleCategoryClick = (item) => {
    setSelectedCategory(item.raw);
    setSelectedDescription(null);
    setDescEditMode(false);
    setDescView(null);
    setLevel(LEVEL.DESCRIPTIONS);
  };

  const handleDescriptionClick = (item) => {
    if (descEditMode) {
      setDescView({ mode: "edit", id: item.id });
      return;
    }
    setSelectedDescription(item.raw);
    setLevel(LEVEL.MODULES);
  };

  const goToCategories = () => {
    setLevel(LEVEL.CATEGORIES);
    setSelectedCategory(null);
    setSelectedDescription(null);
    setDescEditMode(false);
    setDescView(null);
    resetCategoryPanel();
  };

  const goToDescriptions = () => {
    setLevel(LEVEL.DESCRIPTIONS);
    setSelectedDescription(null);
    setDescView(null);
  };

  if (descView?.mode === "create") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-night-900">Создание подтипа</h2>
            <p className="text-sm text-night-500">{selectedCategory?.name}</p>
          </div>
          <SecureButton type="button" variant="outline" onClick={() => setDescView(null)} className="px-4 py-2 flex items-center gap-2">
            <FaArrowLeft /> Назад
          </SecureButton>
        </div>
        <ModuleDescriptionCreator
          initialCategoryId={selectedCategory?.id}
          onDone={async () => {
            setDescView(null);
            await loadAll();
          }}
        />
      </div>
    );
  }

  if (descView?.mode === "edit") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-night-900">Редактирование подтипа</h2>
          </div>
          <SecureButton type="button" variant="outline" onClick={() => setDescView(null)} className="px-4 py-2 flex items-center gap-2">
            <FaArrowLeft /> Назад
          </SecureButton>
        </div>
        <ModuleDescriptionCreator
          descriptionId={descView.id}
          onDone={async () => {
            setDescView(null);
            await loadAll();
          }}
        />
      </div>
    );
  }

  if (level === LEVEL.MODULES && selectedCategory && selectedDescription) {
    const title = [selectedDescription.base_sku, selectedDescription.name].filter(Boolean).join(" ").trim();
    return (
      <ModulesAdmin
        title={title || "Модули"}
        fixedModuleCategoryId={selectedCategory.id}
        fixedDescriptionId={selectedDescription.id}
        onBack={goToDescriptions}
        onModulesChanged={loadAll}
      />
    );
  }

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-night-500 mb-2">
      <button type="button" onClick={goToCategories} className="hover:text-night-900 transition-colors">
        Модули
      </button>
      {selectedCategory ? (
        <>
          <span>/</span>
          <button type="button" onClick={goToDescriptions} className="hover:text-night-900 transition-colors">
            {selectedCategory.name}
          </button>
        </>
      ) : null}
      {level === LEVEL.DESCRIPTIONS ? (
        <>
          <span>/</span>
          <span className="text-night-800 font-medium">Подтипы модулей</span>
        </>
      ) : null}
    </nav>
  );

  return (
    <div className="flex-1 min-w-0 w-full">
      <section className="glass-card p-6 space-y-6">
        {breadcrumb}

        <div>
          <h2 className="text-xl font-semibold text-night-900">
            {level === LEVEL.CATEGORIES ? "Типы модулей" : "Подтипы модулей"}
          </h2>
          <p className="text-sm text-night-400">
            {level === LEVEL.CATEGORIES
              ? "Выберите тип модуля или добавьте новый"
              : `Подтипы для «${selectedCategory?.name || ""}»`}
          </p>
        </div>

        {level === LEVEL.CATEGORIES ? (
          <AdminNavPlates
            items={categoryPlates}
            showAdd
            showEdit={false}
            deleteMode="conditional"
            onStartAdd={() => setCategoryPanel("add")}
            panel={
              categoryPanel ? (
                <div className="rounded-xl border border-night-200 bg-night-50/80 p-4 space-y-4 max-w-lg">
                  <div className="text-sm font-semibold text-night-800">Новый тип модуля</div>
                  <FormField label="Название" required>
                    <SecureInput value={categoryForm.name} onChange={(v) => setCategoryForm((p) => ({ ...p, name: v }))} placeholder="Верхние модули" />
                  </FormField>
                  <FormField label="Сокращение" required>
                    <SecureInput
                      value={categoryForm.sku_prefix}
                      onChange={(v) => setCategoryForm((p) => ({ ...p, sku_prefix: v.toUpperCase() }))}
                      placeholder="В"
                    />
                  </FormField>
                  <div className="flex gap-2">
                    <SecureButton type="button" onClick={handleSaveCategory} className="px-4 py-2 text-sm flex items-center gap-2">
                      <FaSave /> Сохранить
                    </SecureButton>
                    <SecureButton type="button" variant="ghost" onClick={resetCategoryPanel} className="px-4 py-2 text-sm flex items-center gap-2">
                      <FaTimes /> Отмена
                    </SecureButton>
                  </div>
                </div>
              ) : null
            }
            onSelectItem={handleCategoryClick}
            onDeleteItem={handleDeleteCategory}
            emptyLabel={loading ? "Загрузка…" : "Типы модулей не добавлены."}
          />
        ) : (
          <AdminNavPlates
            items={descriptionPlates}
            showAdd
            showEdit
            editMode={descEditMode}
            onToggleEdit={() => setDescEditMode((v) => !v)}
            onStartAdd={() => setDescView({ mode: "create" })}
            onSelectItem={handleDescriptionClick}
            onDeleteItem={handleDeleteDescription}
            emptyLabel={loading ? "Загрузка…" : "Подтипы не добавлены."}
          />
        )}

        {level === LEVEL.DESCRIPTIONS ? (
          <SecureButton type="button" variant="outline" onClick={goToCategories} className="px-4 py-2 text-sm flex items-center gap-2">
            <FaArrowLeft /> К типам модулей
          </SecureButton>
        ) : null}
      </section>

      <AdminConfirmDialog
        open={Boolean(confirm)}
        message={confirm?.message}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};

export default ModulesHierarchyAdmin;
