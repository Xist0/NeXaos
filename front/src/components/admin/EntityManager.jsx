import { useEffect, useMemo, useState } from "react";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import useApi from "../../hooks/useApi";
import useLogger from "../../hooks/useLogger";
import ImageManager from "./ImageManager";

const defaultField = (field) => ({
  type: "text",
  placeholder: "",
  ...field,
});

const EntityManager = ({ title, endpoint, fields }) => {
  const { request, get, post, put, del } = useApi();
  const logger = useLogger();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState("");
  const [uploadingField, setUploadingField] = useState(null);

  const normalizedFields = useMemo(() => fields.map(defaultField), [fields]);

  const fetchItems = async () => {
    if (!endpoint) return;
    setLoading(true);
    try {
      const response = await get(endpoint);
      const items = response?.data || [];
      // Принимаем все элементы, даже без ID (они могут появиться после создания)
      setItems(items.filter(item => item != null));
    } catch (error) {
      logger.error("Не удалось загрузить данные", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const response = await get(endpoint);
        if (active) {
          const items = response?.data || [];
          // Принимаем все элементы, даже без ID
          setItems(items.filter(item => item != null));
        }
      } catch (error) {
        if (active) {
          logger.error("Не удалось загрузить данные", error);
          setItems([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (endpoint) {
      load();
    }

    return () => {
      active = false;
    };
  }, [endpoint, get]);

  const handleEdit = (item) => {
    if (!item || !item.id) {
      logger.error("Не удалось редактировать: отсутствует ID записи");
      return;
    }
    setEditingId(item.id);
    setForm(item);
    // Обновляем изображения после начала редактирования
    setTimeout(() => {
      if (endpoint === "/modules") {
        // Небольшая задержка чтобы убедиться что editingId установлен
      }
    }, 100);
  };

  const handleDelete = async (id, item) => {
    // Проверяем ID из параметра или из объекта
    const itemId = id || item?.id;
    
    if (!itemId) {
      logger.error("Не удалось удалить: отсутствует ID записи", { item, id });
      return;
    }
    
    if (!confirm(`Вы уверены, что хотите удалить запись #${itemId}?`)) {
      return;
    }

    try {
      await del(`${endpoint}/${itemId}`);
      logger.info("Запись удалена");
      // Обновляем список после удаления
      await fetchItems();
    } catch (error) {
      logger.error("Не удалось удалить запись", error);
      // Все равно обновляем список на случай если удаление прошло на сервере
      await fetchItems();
    }
  };

  const handleUpload = async (fieldName, file) => {
    if (!file) return;
    setUploadingField(fieldName);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await request({
        method: "POST",
        url: "/upload",
        data: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const url = response?.url || response?.data?.url;
      if (url) {
        setForm((prev) => ({ ...prev, [fieldName]: url }));
        logger.info("Файл загружен", { url });
      } else {
        logger.error("Сервер не вернул ссылку на файл");
      }
    } catch (error) {
      logger.error("Не удалось загрузить файл", error);
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    // Собираем payload, исключая пустые значения
    const payload = normalizedFields.reduce((acc, field) => {
      const rawValue = form[field.name];
      // Пропускаем undefined и пустые строки, но сохраняем 0 для чисел
      if (rawValue === undefined || rawValue === "") return acc;
      acc[field.name] =
        field.type === "number" ? Number(rawValue) : rawValue;
      return acc;
    }, {});

    // Валидация: проверяем обязательные поля
    const requiredFields = normalizedFields.filter(f => f.required);
    const missingFields = requiredFields.filter(field => {
      const value = payload[field.name];
      return value === undefined || value === "" || (field.type === "number" && isNaN(value));
    });

    if (missingFields.length > 0) {
      const missingNames = missingFields.map(f => f.label).join(", ");
      logger.error(`Не заполнены обязательные поля: ${missingNames}`);
      return;
    }

    // Валидация: нельзя создать/обновить полностью пустой объект
    if (Object.keys(payload).length === 0) {
      logger.error("Нельзя сохранить пустой объект. Заполните хотя бы одно поле.");
      return;
    }

    // Дополнительная проверка для редактирования
    if (editingId && !editingId) {
      logger.error("Не удалось обновить: отсутствует ID записи");
      return;
    }

    try {
      let response;
      if (editingId) {
        response = await put(`${endpoint}/${editingId}`, payload);
        logger.info("Запись обновлена");
      } else {
        response = await post(endpoint, payload);
        // Проверяем наличие ID в ответе при создании
        const createdItem = response?.data || response;
        if (!createdItem || !createdItem.id) {
          logger.warn("Созданная запись не содержит ID в ответе", { response, createdItem });
        } else {
          logger.info("Запись создана", { id: createdItem.id });
        }
      }

      setForm({});
      setEditingId(null);
      // Небольшая задержка перед обновлением списка, чтобы сервер успел обработать
      setTimeout(() => {
        fetchItems();
      }, 100);
    } catch (error) {
      logger.error("Не удалось сохранить запись", error);
      // Все равно обновляем список на случай частичного успеха
      setTimeout(() => {
        fetchItems();
      }, 100);
    }
  };

  const filteredItems = useMemo(() => {
    if (!search) return items;
    return items.filter((item) =>
      Object.values(item)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [items, search]);

  return (
    <section className="glass-card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-night-900">{title}</h2>
          <p className="text-sm text-night-400">
            {loading ? "Загружаем..." : `${filteredItems.length} записей`}
          </p>
        </div>
        <SecureInput
          className="max-w-xs"
          value={search}
          onChange={setSearch}
          placeholder="Поиск..."
        />
      </div>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        {normalizedFields.map((field) => (
          <label key={field.name} className="text-sm text-night-700 space-y-1">
            <span>{field.label}</span>
            {field.inputType === "image" ? (
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    handleUpload(field.name, event.target.files?.[0] || null)
                  }
                  className="block w-full text-xs text-night-600 file:mr-3 file:rounded-full file:border-0 file:bg-night-900 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-night-800"
                />
                {form[field.name] && (
                  <img
                    src={form[field.name].startsWith('/uploads/') 
                      ? (import.meta.env.DEV ? `http://localhost:5000${form[field.name]}` : form[field.name])
                      : form[field.name]}
                    alt={field.label}
                    className="h-20 w-20 rounded-md object-cover border border-night-100"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      console.error("Ошибка загрузки изображения:", form[field.name]);
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                {uploadingField === field.name && (
                  <p className="text-xs text-night-400">Загружаем файл...</p>
                )}
              </div>
            ) : (
              <SecureInput
                type={field.type}
                value={form[field.name] ?? ""}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, [field.name]: value }))
                }
                placeholder={field.placeholder}
                required={field.required}
              />
            )}
          </label>
        ))}
        <div className="md:col-span-2 flex gap-3">
          <SecureButton type="submit" className="px-6 py-3">
            {editingId ? "Сохранить изменения" : "Добавить запись"}
          </SecureButton>
          {editingId && (
            <SecureButton
              type="button"
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setForm({});
              }}
            >
              Отмена
            </SecureButton>
          )}
        </div>
      </form>

      {/* Image Manager для модулей - показываем всегда при редактировании */}
      {endpoint === "/modules" && editingId && (
        <div className="border-t border-night-200 pt-6 mt-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-night-900 mb-2">Управление изображениями</h3>
            <p className="text-sm text-night-500">
              Загрузите несколько фотографий товара. Первое фото будет использоваться как превью.
              Перетаскивайте фото для изменения порядка.
            </p>
          </div>
          <ImageManager
            entityType="modules"
            entityId={editingId}
            onUpdate={fetchItems}
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-night-400">
              <th className="py-3 pr-4">ID</th>
              {normalizedFields.map((field) => (
                <th key={field.name} className="py-3 pr-4">
                  {field.label}
                </th>
              ))}
              <th className="py-3 pr-4">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, index) => (
              <tr
                key={item.id || `item-${index}`}
                className="border-t border-night-100 text-night-900"
              >
                <td className="py-3 pr-4 font-semibold">#{item.id || '—'}</td>
                {normalizedFields.map((field) => (
                  <td key={field.name} className="py-3 pr-4">
                    {field.inputType === "image" && item[field.name] ? (
                      <img
                        src={item[field.name].startsWith('/uploads/') 
                          ? (import.meta.env.DEV ? `http://localhost:5000${item[field.name]}` : item[field.name])
                          : item[field.name]}
                        alt={field.label}
                        className="h-10 w-10 rounded object-cover border border-night-100"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      item[field.name] ?? "—"
                    )}
                  </td>
                ))}
                <td className="py-3 pr-4 flex gap-2">
                  <SecureButton
                    variant="outline"
                    className="px-3 py-1 text-xs"
                    onClick={() => handleEdit(item)}
                  >
                    Редактировать
                  </SecureButton>
                  <SecureButton
                    variant="ghost"
                    className="px-3 py-1 text-xs"
                    onClick={() => handleDelete(item.id, item)}
                  >
                    Удалить
                  </SecureButton>
                </td>
              </tr>
            ))}
            {!filteredItems.length && !loading && (
              <tr>
                <td
                  colSpan={normalizedFields.length + 2}
                  className="py-6 text-center text-night-400"
                >
                  Нет записей
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default EntityManager;

