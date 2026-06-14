import { useEffect, useMemo, useState } from "react";
import { FaPlus, FaSave, FaTimes } from "react-icons/fa";
import { LuPencil, LuTrash2 } from "react-icons/lu";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import FormField from "../ui/FormField";
import AdminConfirmDialog from "./shared/AdminConfirmDialog";
import { fmtPrice, parsePrice } from "./shared/adminFormat";
import AdminPriceInput from "./shared/AdminPriceInput";
import { useAdminCrud } from "./shared/useAdminCrud";
import { buildMaterialSku } from "../../utils/translit";

const API = "/api/sheet-materials";

const isCountertop = (item) => {
  const cat = String(item?.category || "");
  return cat.startsWith("Столешница") || Boolean(item?.countertop_size);
};

const parseBrand = (category) => {
  const cat = String(category || "");
  if (cat.includes("EGGER")) return "EGGER";
  if (cat.includes("СКИФ")) return "СКИФ";
  return cat.replace(/^Столешница\s*/i, "").trim() || "—";
};

const CountertopsAdmin = () => {
  const { items, loading, fetchItems, createItem, updateItem, deleteItem } = useAdminCrud(API);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [form, setForm] = useState({
    material: "",
    brand: "",
    color: "",
    size: "",
    price: "",
  });

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filteredItems = useMemo(() => {
    let list = items.filter(isCountertop);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          String(i.name || "").toLowerCase().includes(q) ||
          String(i.category || "").toLowerCase().includes(q) ||
          String(i.hardware_color || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, search]);

  const resetForm = () => {
    setForm({ material: "", brand: "", color: "", size: "", price: "" });
    setEditingId(null);
    setFormOpen(false);
  };

  const handleEdit = (item) => {
    setForm({
      material: item.purpose || "Столешница",
      brand: parseBrand(item.category),
      color: item.hardware_color || "",
      size: item.countertop_size || "",
      price: item.price_per_sheet ?? "",
    });
    setEditingId(item.id);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.material.trim() && !form.brand.trim()) return;
    const category = form.brand ? `Столешница ${form.brand}` : "Столешница";
    const name = form.material.trim() || `${form.brand} ${form.color}`.trim() || "Столешница";
    const payload = {
      name,
      category,
      purpose: form.material.trim() || undefined,
      hardware_color: form.color.trim() || undefined,
      countertop_size: form.size.trim() || undefined,
      price_per_sheet: parsePrice(form.price),
      sku: buildMaterialSku({ category, name, size: form.size }),
      is_active: true,
    };
    try {
      if (editingId) await updateItem(editingId, payload);
      else await createItem(payload);
      resetForm();
      await fetchItems();
    } catch (e) {
      console.error(e);
      window.alert(e?.message || "Не удалось сохранить столешницу");
    }
  };

  const handleDelete = (item) => {
    setConfirm({
      message: "Вы действительно хотите удалить?",
      onConfirm: async () => {
        try {
          await deleteItem(item.id);
          await fetchItems();
        } catch (e) {
          console.error(e);
        }
        setConfirm(null);
      },
    });
  };

  return (
    <div className="flex-1 min-w-0 w-full">
      <section className="glass-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-night-900">Столешницы</h2>
            <p className="text-sm text-night-400">{filteredItems.length} записей</p>
          </div>
          <SecureInput value={search} onChange={setSearch} placeholder="Поиск…" className="max-w-xs" />
        </div>

        <SecureButton type="button" onClick={() => { resetForm(); setFormOpen(true); }} className="px-4 py-2 text-sm flex items-center gap-2">
          <FaPlus /> Добавить
        </SecureButton>

        {formOpen ? (
          <div className="rounded-xl border border-night-200 bg-night-50/80 p-4 space-y-4">
            <div className="text-sm font-semibold text-night-800">{editingId ? "Редактирование" : "Новая позиция"}</div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Материал">
                <SecureInput value={form.material} onChange={(v) => setForm((p) => ({ ...p, material: v }))} placeholder="ЛДСП, камень…" />
              </FormField>
              <FormField label="Фирма столешницы">
                <SecureInput value={form.brand} onChange={(v) => setForm((p) => ({ ...p, brand: v }))} placeholder="EGGER, СКИФ…" />
              </FormField>
              <FormField label="Цвет">
                <SecureInput value={form.color} onChange={(v) => setForm((p) => ({ ...p, color: v }))} />
              </FormField>
              <FormField label="Размер">
                <SecureInput value={form.size} onChange={(v) => setForm((p) => ({ ...p, size: v }))} placeholder="4100*600*38" />
              </FormField>
              <FormField label="Цена за ед.">
                <AdminPriceInput value={form.price} onChange={(v) => setForm((p) => ({ ...p, price: v }))} />
              </FormField>
            </div>
            <div className="flex gap-2">
              <SecureButton type="button" onClick={handleSave} className="px-4 py-2 text-sm flex items-center gap-2"><FaSave /> Сохранить</SecureButton>
              <SecureButton type="button" variant="ghost" onClick={resetForm} className="px-4 py-2 text-sm flex items-center gap-2"><FaTimes /> Отмена</SecureButton>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-left text-sm">
            <thead>
              <tr className="text-night-400">
                <th className="py-3 pr-4">Материал</th>
                <th className="py-3 pr-4">Фирма столешницы</th>
                <th className="py-3 pr-4">Цвет</th>
                <th className="py-3 pr-4">Размер</th>
                <th className="py-3 pr-4 text-right">Цена за ед.</th>
                <th className="py-3 pr-4 w-28 text-center">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-night-500">Загрузка…</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-night-500">Записей нет</td></tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="border-t border-night-100 text-night-900">
                    <td className="py-3 pr-4">{item.purpose || "Столешница"}</td>
                    <td className="py-3 pr-4">{parseBrand(item.category)}</td>
                    <td className="py-3 pr-4">{item.hardware_color || "—"}</td>
                    <td className="py-3 pr-4">{item.countertop_size || "—"}</td>
                    <td className="py-3 pr-4 text-right">{fmtPrice(item.price_per_sheet)}</td>
                    <td className="py-3 pr-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button type="button" onClick={() => handleEdit(item)} className="h-9 px-3 border border-accent/30 text-accent-dark hover:bg-accent/10 rounded-full"><LuPencil size={15} /></button>
                        <button type="button" onClick={() => handleDelete(item)} className="h-9 px-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-full"><LuTrash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AdminConfirmDialog open={Boolean(confirm)} message={confirm?.message} onConfirm={confirm?.onConfirm} onCancel={() => setConfirm(null)} />
    </div>
  );
};

export default CountertopsAdmin;
