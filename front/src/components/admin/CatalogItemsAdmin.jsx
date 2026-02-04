import { useCallback, useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaEdit, FaPlus, FaTrash } from "react-icons/fa";
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

  const loadItems = useCallback(async ({ force = false } = {}) => {
    if (!force && hasLoadedRef.current) return;
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    setLoading(true);
    try {
      const res = await getRef.current("/catalog-items", {
        limit: 500,
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
    loadItems();
  }, [mode, loadItems]);

  const openEdit = (id) => {
    setEditingId(id);
    setMode("edit");
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
              <th className="text-left px-4 py-3">Превью</th>
              <th className="text-left px-4 py-3">SKU</th>
              <th className="text-left px-4 py-3">Название</th>
              <th className="text-left px-4 py-3">Цена</th>
              <th className="text-left px-4 py-3">Активен</th>
              <th className="text-right px-4 py-3">Действия</th>
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
                    <img
                      src={getImageUrl(it.preview_url)}
                      alt="preview"
                      className="w-12 h-12 rounded-lg object-cover bg-night-100"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-night-700">{it.sku || "—"}</td>
                  <td className="px-4 py-3 text-night-900 font-medium">{it.name}</td>
                  <td className="px-4 py-3 text-night-700">{it.final_price != null ? `${it.final_price} ₽` : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${it.is_active ? "bg-green-100 text-green-700" : "bg-night-100 text-night-600"}`}>
                      {it.is_active ? "Да" : "Нет"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <SecureButton type="button" variant="outline" className="px-3 py-2 text-xs" onClick={() => openEdit(it.id)}>
                        <FaEdit />
                      </SecureButton>
                      <SecureButton type="button" variant="danger" className="px-3 py-2 text-xs" onClick={() => removeItem(it.id)}>
                        <FaTrash />
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
