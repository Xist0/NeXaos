import { useEffect, useMemo, useState } from "react";
import { FaPlus, FaSave, FaTimes } from "react-icons/fa";
import { LuPencil, LuTrash2 } from "react-icons/lu";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import FormField from "../ui/FormField";
import AdminConfirmDialog from "./shared/AdminConfirmDialog";
import { calcPricePerM2, fmtPrice, parsePrice, sheetAreaM2 } from "./shared/adminFormat";
import AdminPriceInput from "./shared/AdminPriceInput";
import { useAdminCrud } from "./shared/useAdminCrud";
import { buildMaterialSku } from "../../utils/translit";

const API = "/api/sheet-materials";

const isCountertopCategory = (cat) => cat && String(cat).startsWith("Столешница");

const SheetMaterialsAdmin = () => {
  const { items, loading, fetchItems, createItem, updateItem, deleteItem } = useAdminCrud(API);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [form, setForm] = useState({
    category: "",
    name: "",
    sheet_length_mm: "2800",
    sheet_width_mm: "1220",
    price_per_sheet: "",
  });

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const computedM2 = useMemo(
    () => calcPricePerM2(form.price_per_sheet, form.sheet_length_mm, form.sheet_width_mm),
    [form.price_per_sheet, form.sheet_length_mm, form.sheet_width_mm]
  );

  const area = useMemo(() => sheetAreaM2(form.sheet_length_mm, form.sheet_width_mm), [form.sheet_length_mm, form.sheet_width_mm]);

  const filteredItems = useMemo(() => {
    let list = items.filter((i) => !isCountertopCategory(i.category));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          String(i.name || "").toLowerCase().includes(q) ||
          String(i.category || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, search]);

  const resetForm = () => {
    setForm({ category: "", name: "", sheet_length_mm: "2800", sheet_width_mm: "1220", price_per_sheet: "" });
    setEditingId(null);
    setFormOpen(false);
  };

  const handleEdit = (item) => {
    setForm({
      category: item.category || "",
      name: item.name || "",
      sheet_length_mm: item.sheet_length_mm != null ? String(item.sheet_length_mm) : "",
      sheet_width_mm: item.sheet_width_mm != null ? String(item.sheet_width_mm) : "",
      price_per_sheet: item.price_per_sheet ?? "",
    });
    setEditingId(item.id);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || undefined,
      sku: buildMaterialSku({
        category: form.category,
        name: form.name,
        size: form.sheet_length_mm && form.sheet_width_mm ? `${form.sheet_length_mm}x${form.sheet_width_mm}` : "",
      }),
      sheet_length_mm: form.sheet_length_mm ? Number(form.sheet_length_mm) : undefined,
      sheet_width_mm: form.sheet_width_mm ? Number(form.sheet_width_mm) : undefined,
      price_per_sheet: parsePrice(form.price_per_sheet),
      price_per_m2: computedM2 ?? undefined,
      is_active: true,
    };
    try {
      if (editingId) await updateItem(editingId, payload);
      else await createItem(payload);
      resetForm();
      await fetchItems();
    } catch (e) {
      console.error(e);
      window.alert(e?.message || "Не удалось сохранить материал");
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
            <h2 className="text-xl font-semibold text-night-900">Листовой материал</h2>
            <p className="text-sm text-night-400">{filteredItems.length} записей</p>
          </div>
          <SecureInput value={search} onChange={setSearch} placeholder="Поиск…" className="max-w-xs" />
        </div>

        <div className="flex flex-wrap gap-2">
          <SecureButton
            type="button"
            onClick={() => {
              resetForm();
              setFormOpen(true);
            }}
            className="px-4 py-2 text-sm flex items-center gap-2"
          >
            <FaPlus /> Добавить
          </SecureButton>
        </div>

        {formOpen ? (
          <div className="rounded-xl border border-night-200 bg-night-50/80 p-4 space-y-4">
            <div className="text-sm font-semibold text-night-800">
              {editingId ? "Редактирование" : "Новая позиция"}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Материал">
                <SecureInput value={form.category} onChange={(v) => setForm((p) => ({ ...p, category: v }))} placeholder="AGT, EGGER…" />
              </FormField>
              <FormField label="Наименование позиции" required>
                <SecureInput value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
              </FormField>
              <FormField label="Длина листа (мм)">
                <SecureInput type="number" value={form.sheet_length_mm} onChange={(v) => setForm((p) => ({ ...p, sheet_length_mm: v }))} />
              </FormField>
              <FormField label="Ширина листа (мм)">
                <SecureInput type="number" value={form.sheet_width_mm} onChange={(v) => setForm((p) => ({ ...p, sheet_width_mm: v }))} />
              </FormField>
              <FormField label="Стоимость за ед.">
                <AdminPriceInput value={form.price_per_sheet} onChange={(v) => setForm((p) => ({ ...p, price_per_sheet: v }))} />
              </FormField>
              <FormField label="Стоимость за м²">
                <SecureInput value={computedM2 != null ? String(computedM2) : ""} onChange={() => {}} disabled />
                {area != null ? <p className="text-xs text-night-500 mt-1">Площадь листа: {area} м²</p> : null}
              </FormField>
            </div>
            <div className="flex gap-2">
              <SecureButton type="button" onClick={handleSave} className="px-4 py-2 text-sm flex items-center gap-2">
                <FaSave /> Сохранить
              </SecureButton>
              <SecureButton type="button" variant="ghost" onClick={resetForm} className="px-4 py-2 text-sm flex items-center gap-2">
                <FaTimes /> Отмена
              </SecureButton>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-left text-sm">
            <thead>
              <tr className="text-night-400">
                <th className="py-3 pr-4">Материал</th>
                <th className="py-3 pr-4">Наименование позиции</th>
                <th className="py-3 pr-4 text-right">Стоимость за м²</th>
                <th className="py-3 pr-4 text-right">Стоимость за ед.</th>
                <th className="py-3 pr-4 w-28 text-center">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-night-500">Загрузка…</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-night-500">Записей нет</td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="border-t border-night-100 text-night-900">
                    <td className="py-3 pr-4">{item.category || "—"}</td>
                    <td className="py-3 pr-4">{item.name}</td>
                    <td className="py-3 pr-4 text-right">{fmtPrice(item.price_per_m2)}</td>
                    <td className="py-3 pr-4 text-right">{fmtPrice(item.price_per_sheet)}</td>
                    <td className="py-3 pr-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button type="button" onClick={() => handleEdit(item)} className="h-9 px-3 border border-accent/30 text-accent-dark hover:bg-accent/10 rounded-full">
                          <LuPencil size={15} />
                        </button>
                        <button type="button" onClick={() => handleDelete(item)} className="h-9 px-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-full">
                          <LuTrash2 size={15} />
                        </button>
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

export default SheetMaterialsAdmin;
