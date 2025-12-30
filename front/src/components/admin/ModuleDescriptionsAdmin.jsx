import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SecureButton from "../ui/SecureButton";
import useApi from "../../hooks/useApi";
import useLogger from "../../hooks/useLogger";
import { FaArrowLeft, FaEdit, FaPlus, FaTrash } from "react-icons/fa";
import ModuleDescriptionCreator from "./ModuleDescriptionCreator";

const ModuleDescriptionsAdmin = () => {
  const { get, del } = useApi();
  const logger = useLogger();

  const [mode, setMode] = useState("list");
  const [editingId, setEditingId] = useState(null);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filterCategoryId, setFilterCategoryId] = useState("");

  const getRef = useRef(get);
  const delRef = useRef(del);
  const loggerRef = useRef(logger);
  const isLoadingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    getRef.current = get;
    delRef.current = del;
    loggerRef.current = logger;
  }, [get, del, logger]);

  const loadData = useCallback(async ({ force = false } = {}) => {
    if (!force && hasLoadedRef.current) return;
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);

    try {
      const [descriptionsRes, categoriesRes] = await Promise.all([
        getRef.current("/module-descriptions", { limit: 500 }),
        getRef.current("/module-categories", { limit: 500 }),
      ]);

      const nextItems = Array.isArray(descriptionsRes?.data) ? descriptionsRes.data : [];
      const nextCategories = Array.isArray(categoriesRes?.data) ? categoriesRes.data : [];

      setItems(nextItems);
      setCategories(nextCategories);
      hasLoadedRef.current = true;

      if (!filterCategoryId && nextCategories.length > 0) {
        // Не выбираем автоматически — UX как раньше: сначала выбери категорию
      }
    } catch (e) {
      loggerRef.current?.error("Не удалось загрузить подтипы/категории", e);
      setItems([]);
      setCategories([]);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [filterCategoryId]);

  useEffect(() => {
    if (mode === "list") {
      loadData({ force: false });
    }
  }, [mode, loadData]);

  const categoriesSorted = useMemo(
    () => (Array.isArray(categories) ? categories.slice().sort((a, b) => Number(a.id) - Number(b.id)) : []),
    [categories]
  );

  const categoryMap = useMemo(() => {
    const map = new Map();
    categoriesSorted.forEach((c) => map.set(Number(c.id), c));
    return map;
  }, [categoriesSorted]);

  const filteredItems = useMemo(() => {
    if (!filterCategoryId) return [];
    const cid = Number(filterCategoryId);
    return (Array.isArray(items) ? items : []).filter((it) => Number(it.module_category_id) === cid);
  }, [items, filterCategoryId]);

  const handleDelete = async (id) => {
    if (!id) return;
    if (!confirm(`Удалить подтип #${id}?`)) return;
    try {
      await delRef.current(`/module-descriptions/${id}`);
      hasLoadedRef.current = false;
      await loadData({ force: true });
    } catch (e) {
      loggerRef.current?.error("Не удалось удалить подтип", e);
      hasLoadedRef.current = false;
      await loadData({ force: true });
    }
  };

  const openEdit = (id) => {
    setEditingId(id);
    setMode("edit");
  };

  if (mode === "create") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-night-900">Создание подтипа</h2>
            <p className="text-sm text-night-500">Шаги: Категория → Основа артикула → Название.</p>
          </div>
          <SecureButton type="button" variant="outline" onClick={() => setMode("list")} className="px-4 py-2 flex items-center gap-2">
            <FaArrowLeft /> К списку
          </SecureButton>
        </div>
        <ModuleDescriptionCreator
          initialCategoryId={filterCategoryId}
          onDone={async () => {
            setMode("list");
            hasLoadedRef.current = false;
            await loadData({ force: true });
          }}
        />
      </div>
    );
  }

  if (mode === "edit") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-night-900">Редактирование подтипа</h2>
            <p className="text-sm text-night-500">Редактирование выполняется без создания дубля.</p>
          </div>
          <SecureButton
            type="button"
            variant="outline"
            onClick={() => {
              setEditingId(null);
              setMode("list");
            }}
            className="px-4 py-2 flex items-center gap-2"
          >
            <FaArrowLeft /> К списку
          </SecureButton>
        </div>
        <ModuleDescriptionCreator
          descriptionId={editingId}
          onDone={async () => {
            setEditingId(null);
            setMode("list");
            hasLoadedRef.current = false;
            await loadData({ force: true });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-night-900">Подтипы модулей</h2>
          <p className="text-sm text-night-500">Сначала выберите категорию — затем увидите список подтипов.</p>
        </div>
        <SecureButton type="button" onClick={() => setMode("create")} className="px-4 py-2 flex items-center gap-2" disabled={!filterCategoryId}>
          <FaPlus /> Создать
        </SecureButton>
      </div>

      <div className="glass-card p-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm font-semibold text-night-700">Категория:</label>
          <select
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
            className="px-4 py-2 border border-night-200 rounded-lg bg-white text-night-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          >
            <option value="">Выберите категорию...</option>
            {categoriesSorted.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}{c.sku_prefix ? ` (${String(c.sku_prefix).toUpperCase()})` : ""}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-night-600">Загрузка...</div>
        ) : !filterCategoryId ? (
          <div className="text-night-600">Выберите категорию, чтобы увидеть подтипы.</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-night-600">Подтипы не найдены для выбранной категории.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-night-500">
                  <th className="text-left py-2 px-3">ID</th>
                  <th className="text-left py-2 px-3">Основа артикула</th>
                  <th className="text-left py-2 px-3">Название</th>
                  <th className="text-left py-2 px-3">Категория</th>
                  <th className="text-right py-2 px-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((d) => {
                  const category = d.module_category_id ? categoryMap.get(Number(d.module_category_id)) : null;
                  return (
                    <tr key={d.id} className="border-t border-night-100">
                      <td className="py-2 px-3 text-night-900">{d.id}</td>
                      <td className="py-2 px-3 font-mono text-xs text-night-700">{d.base_sku || "—"}</td>
                      <td className="py-2 px-3 text-night-900">{d.name || "—"}</td>
                      <td className="py-2 px-3 text-night-900">{category?.name || "—"}</td>
                      <td className="py-2 px-3">
                        <div className="flex justify-end gap-2">
                          <SecureButton type="button" size="sm" variant="outline" onClick={() => openEdit(d.id)} className="h-8 px-3 flex items-center gap-2">
                            <FaEdit /> Ред.
                          </SecureButton>
                          <SecureButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(d.id)}
                            className="h-8 px-3 flex items-center gap-2 text-red-600 hover:bg-red-50"
                          >
                            <FaTrash /> Удал.
                          </SecureButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModuleDescriptionsAdmin;
