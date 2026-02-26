import { useCallback, useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaPlus } from "react-icons/fa";
import { LuCopy, LuPencil, LuTrash2 } from "react-icons/lu";
import useApi from "../../hooks/useApi";
import useLogger from "../../hooks/useLogger";
import SecureButton from "../ui/SecureButton";
import { getImageUrl } from "../../utils/image";
import CatalogItemCreator from "./CatalogItemCreator";

const CatalogItemsAdmin = ({ title = "Каталог", fixedValues = null }) => {
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

  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    getRef.current = get;
    delRef.current = del;
    loggerRef.current = logger;
  }, [get, del, logger]);

  useEffect(() => {
    hasLoadedRef.current = false;
  }, [fixedValues?.category, fixedValues?.category_group]);

  const loadItems = useCallback(async ({ force = false } = {}) => {
    if (!force && hasLoadedRef.current) return;
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    setLoading(true);
    try {
      const res = await getRef.current("/catalog-items", {
        limit: 500,
        ...(force ? { __nocache: Date.now() } : {}),
        ...(fixedValues?.category_group ? { categoryGroup: fixedValues.category_group } : {}),
        ...(fixedValues?.category ? { category: fixedValues.category } : {}),
      });
      setItems(Array.isArray(res?.data) ? res.data : []);
      hasLoadedRef.current = true;
    } catch (e) {
      loggerRef.current?.error("Не удалось загрузить каталог", e);
      setItems([]);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [fixedValues?.category, fixedValues?.category_group]);

  useEffect(() => {
    if (mode !== "list") return;
    loadItems({ force: true });
  }, [fixedValues?.category, fixedValues?.category_group, mode, loadItems]);

  const openEdit = (id) => {
    setEditingId(id);
    setMode("edit");
  };

  const openDuplicate = (id) => {
    setDuplicateFromId(id);
    setMode("duplicate");
  };

  const removeItem = async (id) => {
    if (!confirm("Удалить запись?")) return;
    try {
      await delRef.current(`/catalog-items/${id}`);
      hasLoadedRef.current = false;
      await loadItems({ force: true });
    } catch (e) {
      loggerRef.current?.error("Не удалось удалить запись", e);
    }
  };

  if (mode === "create") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-night-900">Создание: {title}</h2>
            <p className="text-sm text-night-500">Создайте позицию, загрузите фото и выберите превью.</p>
          </div>
          <SecureButton type="button" variant="outline" onClick={() => setMode("list")} className="px-4 py-2 flex items-center gap-2">
            <FaArrowLeft /> К списку
          </SecureButton>
        </div>

        <CatalogItemCreator
          title={title}
          fixedValues={fixedValues}
          onDone={async () => {
            setMode("list");
            hasLoadedRef.current = false;
            await loadItems({ force: true });
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

        <CatalogItemCreator
          title={title}
          catalogItemId={editingId}
          fixedValues={fixedValues}
          onDone={async () => {
            setEditingId(null);
            setMode("list");
            hasLoadedRef.current = false;
            await loadItems({ force: true });
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
            <h2 className="text-xl font-semibold text-night-900">Создание копии: {title}</h2>
            <p className="text-sm text-night-500">Форма заполнена как при редактировании, но будет создана новая позиция.</p>
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

        <CatalogItemCreator
          title={title}
          duplicateFromId={duplicateFromId}
          submitLabel="Сохранить новый товар"
          fixedValues={fixedValues}
          onDone={async () => {
            setDuplicateFromId(null);
            setMode("list");
            hasLoadedRef.current = false;
            await loadItems({ force: true });
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
          <p className="text-sm text-night-500">Список позиций. Можно редактировать и удалять.</p>
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
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-night-500" colSpan={6}>
                  Нет записей
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="border-t border-night-100">
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <img
                        src={getImageUrl(it.preview_url)}
                        alt="preview"
                        className="w-12 h-12 rounded-lg object-cover bg-night-100"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-night-700">{it.sku || "—"}</td>
                  <td className="px-4 py-3 text-night-900 font-medium">{it.name}</td>
                  <td className="px-4 py-3 text-night-700">{it.final_price != null ? `${it.final_price} ₽` : "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex justify-center px-2 py-1 rounded-full text-xs font-semibold ${it.is_active ? "bg-green-100 text-green-700" : "bg-night-100 text-night-600"}`}>
                      {it.is_active ? "Да" : "Нет"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <SecureButton
                        type="button"
                        variant="outline"
                        className="h-10 px-4 py-2 text-xs flex items-center justify-center border-accent/30 text-accent-dark hover:border-accent/50 hover:bg-accent/10"
                        onClick={() => openEdit(it.id)}
                        title="Редактировать"
                      >
                        <LuPencil size={16} />
                      </SecureButton>
                      <SecureButton
                        type="button"
                        variant="outline"
                        className="h-10 px-4 py-2 text-xs flex items-center justify-center"
                        onClick={() => openDuplicate(it.id)}
                        title="Копия"
                      >
                        <LuCopy size={16} />
                      </SecureButton>
                      <SecureButton
                        type="button"
                        variant="outline"
                        className="h-10 px-4 py-2 text-xs flex items-center justify-center border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeItem(it.id)}
                        title="Удалить"
                      >
                        <LuTrash2 size={16} />
                      </SecureButton>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CatalogItemsAdmin;
