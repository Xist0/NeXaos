import { useCallback, useEffect, useRef, useState } from "react";
import SecureButton from "../../../ui/SecureButton";
import useApi from "../../../../hooks/useApi";
import useLogger from "../../../../hooks/useLogger";
import { FaArrowLeft, FaPlus } from "react-icons/fa";
import { LuCopy, LuPencil, LuTrash2 } from "react-icons/lu";
import KitSolutionCreator from "./KitSolutionCreator";
import { getImageUrl } from "../../../../utils/image";

const KitSolutionsAdmin = ({ title = "Готовые решения", fixedValues = null }) => {
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

  useEffect(() => {
    hasLoadedRef.current = false;
  }, [fixedValues?.category, fixedValues?.category_group]);

  const loadKits = useCallback(async ({ force = false } = {}) => {
    if (!force && hasLoadedRef.current) return;
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    setLoading(true);
    try {
      const res = await getRef.current("/kit-solutions", {
        limit: 500,
        includeInactive: true,
        ...(force ? { __nocache: Date.now() } : {}),
        ...(fixedValues?.category_group ? { categoryGroup: fixedValues.category_group } : {}),
        ...(fixedValues?.category ? { category: fixedValues.category } : {}),
      });
      setItems(Array.isArray(res?.data) ? res.data : []);
      hasLoadedRef.current = true;
    } catch (e) {
      loggerRef.current?.error("Не удалось загрузить готовые решения", e);
      setItems([]);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [fixedValues?.category, fixedValues?.category_group]);

  useEffect(() => {
    if (mode === "list") {
      loadKits({ force: true });
    }
  }, [fixedValues?.category, fixedValues?.category_group, mode, loadKits]);

  const handleDelete = async (id) => {
    if (!id) return;
    if (!confirm(`Удалить готовое решение #${id}?`)) return;

    try {
      await delRef.current(`/kit-solutions/${id}`);
      hasLoadedRef.current = false;
      await loadKits({ force: true });
    } catch (e) {
      loggerRef.current?.error("Не удалось удалить готовое решение", e);
      hasLoadedRef.current = false;
      await loadKits({ force: true });
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

  if (mode === "duplicate") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-night-900">Создание копии: {title}</h2>
            <p className="text-sm text-night-500">Форма заполнена как при редактировании, но будет создано новое готовое решение.</p>
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

        <KitSolutionCreator
          duplicateFromId={duplicateFromId}
          submitLabel="Сохранить новый товар"
          fixedValues={fixedValues}
          onDone={async () => {
            setDuplicateFromId(null);
            setMode("list");
            hasLoadedRef.current = false;
            await loadKits({ force: true });
          }}
        />
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-night-900">Создание: {title}</h2>
            <p className="text-sm text-night-500">Создайте решение, загрузите фото и выберите превью.</p>
          </div>
          <SecureButton
            type="button"
            variant="outline"
            onClick={() => setMode("list")}
            className="px-4 py-2 flex items-center gap-2"
          >
            <FaArrowLeft /> К списку
          </SecureButton>
        </div>

        <KitSolutionCreator
          fixedValues={fixedValues}
          onDone={async () => {
            setMode("list");
            hasLoadedRef.current = false;
            await loadKits({ force: true });
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
            <h2 className="text-xl font-semibold text-night-900">Редактирование: {title}</h2>
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

        <KitSolutionCreator
          kitSolutionId={editingId}
          fixedValues={fixedValues}
          onDone={async () => {
            setEditingId(null);
            setMode("list");
            hasLoadedRef.current = false;
            await loadKits({ force: true });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-night-900">{title}</h2>
          <p className="text-sm text-night-500">Список готовых решений. Можно редактировать и удалять.</p>
        </div>
        <SecureButton
          type="button"
          onClick={() => setMode("create")}
          className="px-4 py-2 flex items-center gap-2"
        >
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
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-night-500" colSpan={6}>
                  Нет записей
                </td>
              </tr>
            ) : (
              items.map((k) => {
                const img = getImageUrl(k.preview_url);
                return (
                  <tr key={k.id} className="border-t border-night-100">
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
                    <td className="px-4 py-3 text-night-700">{k.sku || "—"}</td>
                    <td className="px-4 py-3 text-night-900 font-medium">{k.name}</td>
                    <td className="px-4 py-3 text-night-700">{k.final_price != null ? `${k.final_price} ₽` : "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex justify-center px-2 py-1 rounded-full text-xs font-semibold ${k.is_active ? "bg-green-100 text-green-700" : "bg-night-100 text-night-600"}`}>
                        {k.is_active ? "Да" : "Нет"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <SecureButton
                          type="button"
                          variant="outline"
                          className="h-10 px-4 py-2 text-xs flex items-center justify-center border-accent/30 text-accent-dark hover:border-accent/50 hover:bg-accent/10"
                          onClick={() => openEdit(k.id)}
                          title="Редактировать"
                        >
                          <LuPencil size={16} />
                        </SecureButton>
                        <SecureButton
                          type="button"
                          variant="outline"
                          className="h-10 px-4 py-2 text-xs flex items-center justify-center"
                          onClick={() => openDuplicate(k.id)}
                          title="Копия"
                        >
                          <LuCopy size={16} />
                        </SecureButton>
                        <SecureButton
                          type="button"
                          variant="outline"
                          className="h-10 px-4 py-2 text-xs flex items-center justify-center border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(k.id)}
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

export default KitSolutionsAdmin;
