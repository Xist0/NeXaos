import { useCallback, useEffect, useRef, useState } from "react";
import SecureButton from "../ui/SecureButton";
import ModuleCreator from "./ModuleCreator";
import useApi from "../../hooks/useApi";
import useLogger from "../../hooks/useLogger";
import { FaArrowLeft, FaEdit, FaPlus, FaTrash } from "react-icons/fa";

const ModulesAdmin = () => {
  const { get, del } = useApi();
  const logger = useLogger();
  const [mode, setMode] = useState("list");
  const [editingId, setEditingId] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("/uploads/")) {
      return import.meta.env.DEV ? `http://localhost:5000${url}` : url;
    }
    return url;
  };

  const loadModules = useCallback(async ({ force = false } = {}) => {
    if (!force && hasLoadedRef.current) return;
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);
    try {
      const res = await getRef.current("/modules", { limit: 500 });
      setItems(Array.isArray(res?.data) ? res.data : []);
      hasLoadedRef.current = true;
    } catch (e) {
      loggerRef.current?.error("Не удалось загрузить модули", e);
      setItems([]);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (mode === "list") {
      loadModules({ force: false });
    }
  }, [mode, loadModules]);

  const handleDelete = async (id) => {
    if (!id) return;
    if (!confirm(`Удалить модуль #${id}?`)) return;
    try {
      await delRef.current(`/modules/${id}`);
      hasLoadedRef.current = false;
      await loadModules({ force: true });
    } catch (e) {
      loggerRef.current?.error("Не удалось удалить модуль", e);
      hasLoadedRef.current = false;
      await loadModules({ force: true });
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
            <h2 className="text-xl font-semibold text-night-900">Создание модуля</h2>
            <p className="text-sm text-night-500">После сохранения вернитесь к списку для редактирования и удаления.</p>
          </div>
          <SecureButton type="button" variant="outline" onClick={() => setMode("list")} className="px-4 py-2 flex items-center gap-2">
            <FaArrowLeft /> К списку
          </SecureButton>
        </div>
        <ModuleCreator
          onDone={async () => {
            setMode("list");
            hasLoadedRef.current = false;
            await loadModules({ force: true });
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
            <h2 className="text-xl font-semibold text-night-900">Редактирование модуля</h2>
            <p className="text-sm text-night-500">Сохранение выполняется без создания дубля.</p>
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
        <ModuleCreator
          moduleId={editingId}
          onDone={async () => {
            setEditingId(null);
            setMode("list");
            hasLoadedRef.current = false;
            await loadModules({ force: true });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-night-900">Модули</h2>
          <p className="text-sm text-night-500">Список созданных модулей. Здесь можно редактировать и удалять.</p>
        </div>
        <SecureButton type="button" onClick={() => setMode("create")} className="px-4 py-2 flex items-center gap-2">
          <FaPlus /> Создать
        </SecureButton>
      </div>
      <div className="glass-card p-4">
        {loading ? (
          <div className="text-night-600">Загрузка...</div>
        ) : items.length === 0 ? (
          <div className="text-night-600">Модули не найдены</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-night-500">
                  <th className="text-left py-2 px-3">Превью</th>
                  <th className="text-left py-2 px-3">SKU</th>
                  <th className="text-left py-2 px-3">Название</th>
                  <th className="text-left py-2 px-3">Цена</th>
                  <th className="text-left py-2 px-3">Активен</th>
                  <th className="text-right py-2 px-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => {
                  const img = getImageUrl(m.preview_url);
                  return (
                    <tr key={m.id} className="border-t border-night-100">
                      <td className="py-2 px-3">
                        <div className="w-16 h-12 bg-night-50 rounded overflow-hidden">
                          {img ? (
                            <img src={img} alt={m.name} className="w-full h-full object-cover" />
                          ) : null}
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono text-xs text-night-700">{m.sku || "—"}</td>
                      <td className="py-2 px-3 text-night-900">{m.name || "—"}</td>
                      <td className="py-2 px-3 text-night-900">{m.final_price ?? "—"}</td>
                      <td className="py-2 px-3 text-night-900">{m.is_active ? "Да" : "Нет"}</td>
                      <td className="py-2 px-3">
                        <div className="flex justify-end gap-2">
                          <SecureButton type="button" size="sm" variant="outline" onClick={() => openEdit(m.id)} className="h-8 px-3 flex items-center gap-2">
                            <FaEdit /> Ред.
                          </SecureButton>
                          <SecureButton type="button" size="sm" variant="ghost" onClick={() => handleDelete(m.id)} className="h-8 px-3 flex items-center gap-2 text-red-600 hover:bg-red-50">
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

export default ModulesAdmin;
