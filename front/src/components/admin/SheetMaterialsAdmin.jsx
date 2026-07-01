import { useEffect, useMemo, useRef, useState } from "react";
import { FaPlus, FaSave, FaTimes, FaUpload } from "react-icons/fa";
import { LuPencil, LuTrash2 } from "react-icons/lu";
import clsx from "clsx";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import FormField from "../ui/FormField";
import AdminConfirmDialog from "./shared/AdminConfirmDialog";
import { calcPricePerM2, fmtPrice, parsePrice, sheetAreaM2 } from "./shared/adminFormat";
import AdminPriceInput from "./shared/AdminPriceInput";
import { useAdminCrud } from "./shared/useAdminCrud";
import apiClient from "../../services/apiClient";
import useAuthStore from "../../store/authStore";
import { buildMaterialSku } from "../../utils/translit";

const API = "/api/sheet-materials";

const isCountertopCategory = (cat) => cat && String(cat).startsWith("Столешница");

const NON_SHEET_CATEGORIES = new Set(["Кромка", "Пиломатериал", "Рамка", "Стекло в рамку", "Пленка под фрезу", "Вид фрезы"]);

const SheetMaterialsAdmin = () => {
  const { items, loading, fetchItems, createItem, updateItem, deleteItem } = useAdminCrud(API);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const csvInputRef = useRef(null);
  const [form, setForm] = useState({
    category: "",
    name: "",
    sheet_length_mm: "",
    sheet_width_mm: "",
    price_per_sheet: "",
    price_per_m2: "",
  });

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Только настоящие листовые материалы (без Кромки, Пиломатериала, Столешницы и прочих)
  const sheetOnlyItems = useMemo(
    () => items.filter((i) => !isCountertopCategory(i.category) && !NON_SHEET_CATEGORIES.has(i.category)),
    [items]
  );

  // Уникальные категории из листовых материалов
  const categories = useMemo(() => {
    const cats = [...new Set(sheetOnlyItems.map((i) => i.category || "Без категории"))];
    cats.sort();
    return cats;
  }, [sheetOnlyItems]);

  const M2_FACTOR = 5.796;

  const computedM2 = useMemo(() => {
    const fromDims = calcPricePerM2(form.price_per_sheet, form.sheet_length_mm, form.sheet_width_mm);
    if (fromDims != null) return fromDims;
    const pps = Number(form.price_per_sheet);
    if (Number.isFinite(pps) && pps > 0) {
      return Math.ceil((pps / M2_FACTOR) * 100) / 100;
    }
    return null;
  }, [form.price_per_sheet, form.sheet_length_mm, form.sheet_width_mm]);

  const area = useMemo(() => sheetAreaM2(form.sheet_length_mm, form.sheet_width_mm), [form.sheet_length_mm, form.sheet_width_mm]);

  useEffect(() => {
    if (computedM2 != null) {
      setForm((p) => ({ ...p, price_per_m2: String(Math.round(computedM2 * 100) / 100) }));
    }
  }, [computedM2]);

  const filteredItems = useMemo(() => {
    let list = sheetOnlyItems;
    if (activeCategory) {
      list = list.filter((i) => (i.category || "Без категории") === activeCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          String(i.name || "").toLowerCase().includes(q) ||
          String(i.category || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [sheetOnlyItems, search, activeCategory]);

  const resetForm = () => {
    const preset = activeCategory && activeCategory !== "Без категории" ? activeCategory : "";
    setForm({ category: preset, name: "", sheet_length_mm: "", sheet_width_mm: "", price_per_sheet: "", price_per_m2: "" });
    setEditingId(null);
    setFormOpen(false);
  };

  const handleEdit = (item) => {
    setForm({
      category: item.category || "",
      name: item.name || "",
      sheet_length_mm: item.sheet_length_mm != null ? String(item.sheet_length_mm) : "",
      sheet_width_mm: item.sheet_width_mm != null ? String(item.sheet_width_mm) : "",
      price_per_sheet: item.price_per_sheet != null ? String(item.price_per_sheet) : "",
      price_per_m2: item.price_per_m2 != null ? String(item.price_per_m2) : "",
    });
    setEditingId(item.id);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const pricePerSheet = parsePrice(form.price_per_sheet);
    const pricePerM2 = parsePrice(form.price_per_m2);
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
      price_per_sheet: pricePerSheet ?? undefined,
      price_per_m2: pricePerM2 ?? (computedM2 ?? undefined),
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

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImporting(true);
    setCsvResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = useAuthStore.getState().accessToken;
      const { data } = await apiClient.post("/sheet-materials/import-csv", formData, {
        headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` },
      });
      setCsvResult(data);
      await fetchItems();
    } catch (err) {
      setCsvResult({ error: err?.response?.data?.message || err?.message || "Ошибка импорта" });
    } finally {
      setCsvImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  return (
    <div className="flex-1 min-w-0 w-full">
      <section className="glass-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-night-900">Листовой материал</h2>
            <p className="text-sm text-night-400">{filteredItems.length} записей</p>
          </div>
          <div className="flex items-center gap-3">
            <SecureInput value={search} onChange={setSearch} placeholder="Поиск…" className="max-w-xs" />
            {/* CSV импорт временно скрыт
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleCsvUpload} disabled={csvImporting} className="hidden" />
            <button type="button" onClick={() => csvInputRef.current?.click()} disabled={csvImporting}
              className={clsx("flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-xl transition-colors border border-accent bg-accent/5 text-accent hover:bg-accent/10", csvImporting && "opacity-60 cursor-not-allowed")}>
              <FaUpload className="text-xs" /> {csvImporting ? "Импорт…" : "Загрузить CSV"}
            </button>
            */}
          </div>
        </div>

        {/* Фильтр по категории */}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveCategory(null)}
            className={clsx("px-3 py-1.5 rounded-xl text-sm font-medium transition-colors", !activeCategory ? "bg-accent text-white" : "bg-night-100 text-night-700 hover:bg-night-200")}>
            Все
          </button>
          {categories.map((cat) => (
            <button type="button" key={cat} onClick={() => setActiveCategory(cat)}
              className={clsx("px-3 py-1.5 rounded-xl text-sm font-medium transition-colors", activeCategory === cat ? "bg-accent text-white" : "bg-night-100 text-night-700 hover:bg-night-200")}>
              {cat}
            </button>
          ))}
        </div>

        {/* Результаты CSV импорта временно скрыты
        {csvResult && !csvResult.error ? (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
            <span className="font-semibold">Импорт завершён:</span>{" "}
            обработано {csvResult.parsed}, создано {csvResult.sheetCreated}, обновлено {csvResult.sheetUpdated}, прочих: создано {csvResult.hwCreated}, обновлено {csvResult.hwUpdated}, без изменений {csvResult.skipped}
          </div>
        ) : null}
        {csvResult?.error ? (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{csvResult.error}</div>
        ) : null}
        */}

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
              <FormField label="Материал (категория)">
                <SecureInput value={form.category} onChange={(v) => setForm((p) => ({ ...p, category: v }))} placeholder="AGT, EGGER…" />
              </FormField>
              <FormField label="Наименование позиции" required>
                <SecureInput value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
              </FormField>
              <FormField label="Длина листа (мм)">
                <SecureInput type="number" value={form.sheet_length_mm} onChange={(v) => setForm((p) => ({ ...p, sheet_length_mm: v }))} placeholder="Не обязательно" />
              </FormField>
              <FormField label="Ширина листа (мм)">
                <SecureInput type="number" value={form.sheet_width_mm} onChange={(v) => setForm((p) => ({ ...p, sheet_width_mm: v }))} placeholder="Не обязательно" />
              </FormField>
              <FormField label="Стоимость за ед. (лист)">
                <AdminPriceInput value={form.price_per_sheet} onChange={(v) => setForm((p) => ({ ...p, price_per_sheet: v }))} />
              </FormField>
              <FormField label="Стоимость за м²">
                <AdminPriceInput value={form.price_per_m2} onChange={(v) => setForm((p) => ({ ...p, price_per_m2: v }))} />
                {computedM2 != null ? (
                  <p className="text-xs text-night-500 mt-1">
                    Авто: {computedM2.toFixed(2)} ₽/м²
                    {area != null ? ` (площадь листа: ${area} м²)` : ""}
                  </p>
                ) : null}
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
