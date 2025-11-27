import { useEffect, useMemo, useState } from "react";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import useApi from "../../hooks/useApi";

const defaultField = (field) => ({
    type: "text",
    placeholder: "",
    ...field,
});

const EntityManager = ({ title, endpoint, fields }) => {
    const { get, post, put, del } = useApi();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({});
    const [search, setSearch] = useState("");

    const normalizedFields = useMemo(() => fields.map(defaultField), [fields]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const response = await get(endpoint);
            setItems(response?.data || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let active = true;

        const fetchItems = async () => {
            setLoading(true);
            try {
                const response = await get(endpoint);
                if (active) {
                    setItems(response?.data || []);
                }
            } catch (error) {
                if (active) {
                    setItems([]);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        if (endpoint) {
            fetchItems();
        }

        return () => {
            active = false;
        };
    }, [endpoint, get]);

    const handleEdit = (item) => {
        setEditingId(item.id);
        setForm(item);
    };

    const handleDelete = async (id) => {
        await del(`${endpoint}/${id}`);
        await fetchItems();
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const payload = normalizedFields.reduce((acc, field) => {
            const rawValue = form[field.name];
            if (rawValue === undefined || rawValue === "") return acc;
            acc[field.name] =
                field.type === "number" ? Number(rawValue) : rawValue;
            return acc;
        }, {});

        if (editingId) {
            await put(`${endpoint}/${editingId}`, payload);
        } else {
            await post(endpoint, payload);
        }

        setForm({});
        setEditingId(null);
        await fetchItems();
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
                    <label key={field.name} className="text-sm text-night-700">
                        {field.label}
                        <SecureInput
                            type={field.type}
                            value={form[field.name] ?? ""}
                            onChange={(value) =>
                                setForm((prev) => ({ ...prev, [field.name]: value }))
                            }
                            placeholder={field.placeholder}
                            required={field.required}
                        />
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
                        {filteredItems.map((item) => (
                            <tr key={item.id} className="border-t border-night-100 text-night-900">
                                <td className="py-3 pr-4 font-semibold">#{item.id}</td>
                                {normalizedFields.map((field) => (
                                    <td key={field.name} className="py-3 pr-4">
                                        {item[field.name] ?? "—"}
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
                                        onClick={() => handleDelete(item.id)}
                                    >
                                        Удалить
                                    </SecureButton>
                                </td>
                            </tr>
                        ))}
                        {!filteredItems.length && !loading && (
                            <tr>
                                <td colSpan={normalizedFields.length + 2} className="py-6 text-center text-night-400">
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

