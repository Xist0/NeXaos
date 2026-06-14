import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SecureButton from "../../../ui/SecureButton";
import ModuleCreator from "./ModuleCreator";
import useApi from "../../../../hooks/useApi";
import useLogger from "../../../../hooks/useLogger";
import { FaArrowLeft, FaPlus } from "react-icons/fa";
import { LuCopy, LuPencil, LuTrash2 } from "react-icons/lu";
import { getImageUrl } from "../../../../utils/image";

const ModulesAdmin = ({
  title = "Модули",
  fixedModuleCategoryId = null,
  fixedDescriptionId = null,
  onBack = null,
  onModulesChanged = null,
}) => {
  const { get, del } = useApi();
  const logger = useLogger();
  const [mode, setMode] = useState("list");
  const [editingId, setEditingId] = useState(null);
  const [duplicateFromId, setDuplicateFromId] = useState(null);
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
      await onModulesChanged?.();
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

  const openDuplicate = (id) => {
    setDuplicateFromId(id);
    setMode("duplicate");
  };

  const filteredItems = useMemo(() => {
    let list = items;
    if (fixedModuleCategoryId) {
      list = list.filter((m) => Number(m?.module_category_id) === Number(fixedModuleCategoryId));
    }
    if (fixedDescriptionId) {
      list = list.filter((m) => Number(m?.description_id) === Number(fixedDescriptionId));
    }
    return list;
  }, [items, fixedModuleCategoryId, fixedDescriptionId]);

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
          fixedModuleCategoryId={fixedModuleCategoryId}
          fixedDescriptionId={fixedDescriptionId}
          onDone={async () => {
            setMode("list");
            hasLoadedRef.current = false;
            await loadModules({ force: true });
            await onModulesChanged?.();
          }}
        />
      </div>
    );
  }

  if (mode === "duplicate") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-night-900">Создание копии модуля</h2>
            <p className="text-sm text-night-500">Форма заполнена как при редактировании, но будет создан новый модуль.</p>
          </div>
          <SecureButton
            type="button"
            variant="outline"
            onClick={() => {
              setDuplicateFromId(null);
              setMode("list");
            }}
            className="px-4 py-2 flex items-center gap-2"
          >
            <FaArrowLeft /> К списку
          </SecureButton>
        </div>
        <ModuleCreator
          duplicateFromId={duplicateFromId}
          fixedModuleCategoryId={fixedModuleCategoryId}
          fixedDescriptionId={fixedDescriptionId}
          submitLabel="Сохранить новый товар"
          onDone={async () => {
            setDuplicateFromId(null);
            setMode("list");
            hasLoadedRef.current = false;
            await loadModules({ force: true });
            await onModulesChanged?.();
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
          fixedModuleCategoryId={fixedModuleCategoryId}
          fixedDescriptionId={fixedDescriptionId}
          onDone={async () => {
            setEditingId(null);
            setMode("list");
            hasLoadedRef.current = false;
            await loadModules({ force: true });
            await onModulesChanged?.();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          {onBack ? (
            <SecureButton type="button" variant="ghost" onClick={onBack} className="px-0 py-1 text-sm text-night-500 hover:text-night-900 flex items-center gap-2 mb-1">
              <FaArrowLeft /> Назад к подтипам
            </SecureButton>
          ) : null}
          <h2 className="text-xl font-semibold text-night-900">{title}</h2>
          <p className="text-sm text-night-500">Список созданных модулей. Здесь можно редактировать и удалять.</p>
        </div>
        <SecureButton type="button" onClick={() => setMode("create")} className="px-4 py-2 flex items-center gap-2">
          <FaPlus /> Создать
        </SecureButton>
      </div>
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-night-50/70 text-night-600">
            <tr>
              <th className="text-center px-4 py-3">Превью</th>
              <th className="text-left px-4 py-3">SKU</th>
              <th className="text-left px-4 py-3">Название</th>
              <th className="text-left px-4 py-3">Цена</th>
              <th className="text-center px-4 py-3">Активен</th>
              <th className="text-center px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-night-500" colSpan={6}>
                  Загрузка...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-night-500" colSpan={6}>
                  Нет записей
                </td>
              </tr>
            ) : (
              filteredItems.map((m) => {
                const img = getImageUrl(m.preview_url);
                return (
                  <tr key={m.id} className="border-t border-night-100">
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <img
                          src={img}
                          alt="preview"
                          className="w-12 h-12 rounded-lg object-cover bg-night-100"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-night-700">{m.sku || "—"}</td>
                    <td className="px-4 py-3 text-night-900 font-medium">{m.name}</td>
                    <td className="px-4 py-3 text-night-700">{m.final_price != null ? `${m.final_price} ₽` : "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex justify-center px-2 py-1 rounded-full text-xs font-semibold ${m.is_active ? "bg-green-100 text-green-700" : "bg-night-100 text-night-600"}`}>
                        {m.is_active ? "Да" : "Нет"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <SecureButton
                          type="button"
                          variant="outline"
                          className="h-10 px-4 py-2 text-xs flex items-center justify-center border-accent/30 text-accent-dark hover:border-accent/50 hover:bg-accent/10"
                          onClick={() => openEdit(m.id)}
                          title="Редактировать"
                        >
                          <LuPencil size={16} />
                        </SecureButton>
                        <SecureButton
                          type="button"
                          variant="outline"
                          className="h-10 px-4 py-2 text-xs flex items-center justify-center"
                          onClick={() => openDuplicate(m.id)}
                          title="Копия"
                        >
                          <LuCopy size={16} />
                        </SecureButton>
                        <SecureButton
                          type="button"
                          variant="outline"
                          className="h-10 px-4 py-2 text-xs flex items-center justify-center border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(m.id)}
                          title="Удалить"
                        >
                          <LuTrash2 size={16} />
                        </SecureButton>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ModulesAdmin;
