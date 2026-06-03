import { useCallback, useEffect, useMemo, useState } from "react";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import useApi from "../../hooks/useApi";
import useLogger from "../../hooks/useLogger";
import { FaPlus, FaSave, FaTimes } from "react-icons/fa";

const CharacteristicValueTemplatesAdmin = () => {
  const { request, get, post, put, del } = useApi();
  const logger = useLogger();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ field_key: "", value: "" });
  const [search, setSearch] = useState("");
  const [filterFieldKey, setFilterFieldKey] = useState("");

  const fetchItems = useCallback(
    async ({ active } = {}) => {
      const isActive = typeof active === "function" ? active : () => true;
      if (!isActive()) return;

      setLoading(true);
      try {
        const response = await get("/characteristic-value-templates", { limit: 500 });
        const items = response?.data || [];
        if (!isActive()) return;
        setItems(items.filter((item) => item != null));
      } catch (error) {
        if (!isActive()) return;
        logger.error("Не удалось загрузить данные", error);
        setItems([]);
      } finally {
        if (isActive()) {
          setLoading(false);
        }
      }
    },
    [get, logger]
  );

  useEffect(() => {
    let active = true;
    fetchItems({ active: () => active });
    return () => {
      active = false;
    };
  }, [fetchItems]);

  const handleEdit = (item) => {
    if (!item || !item.id) {
      logger.error("Не удалось редактировать: отсутствует ID записи");
      return;
    }
    setEditingId(item.id);
    setForm({
      field_key: item.field_key || "",
      value: item.value || "",
    });
  };

  const handleDelete = async (id) => {
    if (!id) return;
    if (!confirm(`Вы уверены, что хотите удалить запись #${id}?`)) {
      return;
    }

    try {
      await del(`/characteristic-value-templates/${id}`);
      logger.info("Запись удалена");
      await fetchItems();
    } catch (error) {
      logger.error("Не удалось удалить запись", error);
      await fetchItems();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      field_key: String(form.field_key || "").trim(),
      value: String(form.value || "").trim(),
    };

    if (!payload.field_key || !payload.value) {
      logger.error("Заполните все поля");
      return;
    }

    try {
      if (editingId) {
        await put(`/characteristic-value-templates/${editingId}`, payload);
        logger.info("Запись обновлена");
      } else {
        await post("/characteristic-value-templates", payload);
        logger.info("Запись создана");
      }

      setForm({ field_key: "", value: "" });
      setEditingId(null);
      setTimeout(() => {
        fetchItems();
      }, 100);
    } catch (error) {
      logger.error("Не удалось сохранить запись", error);
      setTimeout(() => {
        fetchItems();
      }, 100);
    }
  };

  const handleCancel = () => {
    setForm({ field_key: "", value: "" });
    setEditingId(null);
  };

  const groupedItems = useMemo(() => {
    const groups = {};
    items.forEach((item) => {
      const key = item.field_key || "Без ключа";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!items?.length) return [];
    let filtered = items;

    if (filterFieldKey) {
      filtered = filtered.filter((item) => item.field_key === filterFieldKey);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          String(item.field_key || "").toLowerCase().includes(searchLower) ||
          String(item.value || "").toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [items, filterFieldKey, search]);

  const fieldKeys = useMemo(() => {
    return [...new Set(items.map((item) => item.field_key).filter(Boolean))].sort();
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-night-900">Значения характеристик</h2>
      </div>

      {/* Фильтр и поиск */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <SecureInput
            type="text"
            value={search}
            onChange={setSearch}
            placeholder="Поиск по ключу или значению..."
            className="w-full h-10"
          />
        </div>
        <div className="min-w-0">
          <select
            value={filterFieldKey}
            onChange={(e) => setFilterFieldKey(e.target.value)}
            className="w-full h-10 px-3 py-2 border border-night-200 rounded-lg text-sm bg-white"
          >
            <option value="">Все ключи</option>
            {fieldKeys.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Форма */}
      <div className="border border-night-200 rounded-xl p-4 bg-white">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-night-700 mb-2">
                Ключ поля
              </label>
              <SecureInput
                type="text"
                value={form.field_key}
                onChange={(v) => setForm((prev) => ({ ...prev, field_key: v }))}
                placeholder="Например: opening_type"
                className="w-full h-10"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-night-700 mb-2">
                Значение
              </label>
              <SecureInput
                type="text"
                value={form.value}
                onChange={(v) => setForm((prev) => ({ ...prev, value: v }))}
                placeholder="Например: распашные"
                className="w-full h-10"
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SecureButton
              type="submit"
              disabled={loading}
              className="px-4 py-2 h-10 flex items-center gap-2"
            >
              {loading ? null : editingId ? <FaSave /> : <FaPlus />}
              {editingId ? "Сохранить" : "Добавить"}
            </SecureButton>
            {editingId && (
              <SecureButton
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 h-10 flex items-center gap-2"
              >
                <FaTimes />
                Отмена
              </SecureButton>
            )}
          </div>
        </form>
      </div>

      {/* Список значений */}
      <div className="space-y-4">
        {Object.entries(groupedItems).map(([fieldKey, fieldItems]) => (
          <div key={fieldKey} className="border border-night-200 rounded-xl overflow-hidden">
            <div className="bg-night-50 px-4 py-3 border-b border-night-200">
              <h3 className="font-semibold text-night-900">{fieldKey}</h3>
            </div>
            <div className="divide-y divide-night-100">
              {fieldItems
                .filter((item) => {
                  if (filterFieldKey && item.field_key !== filterFieldKey) return false;
                  if (search) {
                    const searchLower = search.toLowerCase();
                    return (
                      String(item.field_key || "").toLowerCase().includes(searchLower) ||
                      String(item.value || "").toLowerCase().includes(searchLower)
                    );
                  }
                  return true;
                })
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-night-50"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-night-900">{item.value}</div>
                      <div className="text-xs text-night-500">ID: {item.id}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <SecureButton
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="px-3 py-2 text-xs h-10"
                      >
                        Редактировать
                      </SecureButton>
                      <SecureButton
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="px-3 py-2 text-xs h-10"
                      >
                        Удалить
                      </SecureButton>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && !loading && (
        <div className="text-center py-8 text-night-500">
          {search || filterFieldKey ? "Ничего не найдено" : "Нет записей"}
        </div>
      )}
    </div>
  );
};

export default CharacteristicValueTemplatesAdmin;
