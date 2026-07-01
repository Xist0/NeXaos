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

const LINEAR_API = "/api/linear-materials";
const SHEET_API = "/api/sheet-materials";

const LinearMaterialsAdmin = () => {
  const { items: linearItems, loading: linearLoading, fetchItems: fetchLinearItems, createItem: createLinearItem, updateItem: updateLinearItem, deleteItem: deleteLinearItem } = useAdminCrud(LINEAR_API);
  const { items: sheetItems, loading: sheetLoading, fetchItems: fetchSheetItems, createItem: createSheetItem, updateItem: updateSheetItem, deleteItem: deleteSheetItem } = useAdminCrud(SHEET_API);

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirm, setConfirm] = useState(null);

  // Определяем тип редактируемой записи: "linear" или "edge"
  const [editingSource, setEditingSource] = useState(null);

  // Унифицированная форма
  const [form, setForm] = useState({ category: "", name: "", price_per_unit: "" });

  useEffect(() => {
    fetchLinearItems();
    fetchSheetItems();
  }, [fetchLinearItems, fetchSheetItems]);

  // Кромка items из sheet_materials — превращаем в "погонный" формат
  const edgeRows = useMemo(
    () => sheetItems
      .filter((i) => i.category === "Кромка")
      .map((i) => ({
        ...i,
        _source: "edge",
        materialLabel: "Кромка",
        priceLabel: i.edge_price_per_m ?? i.price_per_m2,
      })),
    [sheetItems]
  );

  // Linear items — превращаем в тот же формат
  const linearRows = useMemo(
    () => linearItems.map((i) => ({
      ...i,
      _source: "linear",
      materialLabel: i.purpose || i.category || "—",
      priceLabel: i.price_per_unit ?? i.price_per_piece,
    })),
    [linearItems]
  );

  // Объединённый список
  const allRows = useMemo(() => [...linearRows, ...edgeRows], [linearRows, edgeRows]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.trim().toLowerCase();
    return allRows.filter(
      (i) =>
        String(i.name || "").toLowerCase().includes(q) ||
        String(i.materialLabel || "").toLowerCase().includes(q)
    );
  }, [allRows, search]);

  const loading = linearLoading || sheetLoading;

  // ——— Form handlers ———
  const resetForm = () => {
    setForm({ category: "", name: "", price_per_unit: "" });
    setEditingId(null);
    setEditingSource(null);
    setFormOpen(false);
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setEditingSource(item._source);
    if (item._source === "edge") {
      setForm({
        category: "Кромка",
        name: item.name || "",
        price_per_unit: item.edge_price_per_m != null ? String(item.edge_price_per_m) : (item.price_per_m2 != null ? String(item.price_per_m2) : ""),
      });
    } else {
      setForm({
        category: item.purpose || item.category || "",
        name: item.name || "",
        price_per_unit: item.price_per_unit ?? item.price_per_piece ?? "",
      });
    }
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    if (editingSource === "edge" || form.category === "Кромка") {
      const payload = {
        name: form.name.trim(),
        category: "Кромка",
        sku: buildMaterialSku({ category: "Кромка", name: form.name }),
        edge_price_per_m: parsePrice(form.price_per_unit) ?? undefined,
        is_active: true,
      };
      try {
        if (editingId) await updateSheetItem(editingId, payload);
        else await createSheetItem(payload);
        resetForm();
        await fetchSheetItems();
      } catch (e) {
        console.error(e);
        window.alert(e?.message || "Не удалось сохранить");
      }
      return;
    }

    // Linear material
    const payload = {
      name: form.name.trim(),
      purpose: form.category.trim() || undefined,
      sku: buildMaterialSku({ category: form.category, name: form.name }),
      price_per_unit: parsePrice(form.price_per_unit),
      price_per_piece: parsePrice(form.price_per_unit),
      is_active: true,
    };
    try {
      if (editingId) await updateLinearItem(editingId, payload);
      else await createLinearItem(payload);
      resetForm();
      await fetchLinearItems();
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
          if (item._source === "edge") await deleteSheetItem(item.id);
          else await deleteLinearItem(item.id);
        } catch (e) { console.error(e); }
        setConfirm(null);
        if (item._source === "edge") await fetchSheetItems();
        else await fetchLinearItems();
      },
    });
  };

  return (
    <div className="flex-1 min-w-0 w-full">
      <section className="glass-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-night-900">Погонный материал</h2>
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
                <SecureInput value={form.category} onChange={(v) => setForm((p) => ({ ...p, category: v }))} placeholder="Кромка, профиль…" />
              </FormField>
              <FormField label="Наименование позиции" required>
                <SecureInput value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
              </FormField>
              <FormField label="Стоимость за ед., м">
                <AdminPriceInput value={form.price_per_unit} onChange={(v) => setForm((p) => ({ ...p, price_per_unit: v }))} />
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
                <th className="py-3 pr-4">Наименование позиции</th>
                <th className="py-3 pr-4 text-right">Стоимость за ед., м</th>
                <th className="py-3 pr-4 w-28 text-center">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-8 text-center text-night-500">Загрузка…</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-night-500">Записей нет</td></tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={`${item._source}-${item.id}`} className="border-t border-night-100 text-night-900">
                    <td className="py-3 pr-4">{item.materialLabel}</td>
                    <td className="py-3 pr-4">{item.name}</td>
                    <td className="py-3 pr-4 text-right">{fmtPrice(item.priceLabel)}</td>
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

export default LinearMaterialsAdmin;
