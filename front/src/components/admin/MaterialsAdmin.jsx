import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import FormField from "../ui/FormField";
import FormSelect from "../ui/FormSelect";
import { FaPlus, FaSave, FaTimes, FaUpload } from "react-icons/fa";
import { LuPencil, LuTrash2 } from "react-icons/lu";
import { buildMaterialSku } from "../../utils/translit";
import clsx from "clsx";
import useAuthStore from "../../store/authStore";

const API = "/api/sheet-materials";

const DEFAULT_CATEGORIES = [
  { id: "Пиломатериал", label: "Пиломатериал" },
  { id: "ЛХДФ", label: "ЛХДФ" },
  { id: "EGGER", label: "EGGER" },
  { id: "AGT", label: "AGT" },
  { id: "Кромка", label: "Кромочный материал" },
  { id: "Столешница EGGER", label: "Столешница EGGER" },
  { id: "Столешница СКИФ", label: "Столешница СКИФ" },
  { id: "Рамка", label: "Рамка" },
  { id: "Стекло в рамку", label: "Стекло в рамку" },
  { id: "Пленка под фрезу", label: "Пленка под фрезу" },
  { id: "Вид фрезы", label: "Вид фрезы" },
];

const calcPricePerM2 = (pps, l, w) => {
  if (!pps || !l || !w) return null;
  const area = (l * w) / 1_000_000;
  if (area <= 0) return null;
  return Math.ceil((pps / area) * 100) / 100;
};

const fmt = (v) => (v == null ? "—" : `${Number(v).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`);

const MaterialsAdmin = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [newCat, setNewCat] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);

  const emptyForm = () => ({
    name: "", category: activeCategory || "",
    sheet_length_mm: "", sheet_width_mm: "", price_per_sheet: "",
    countertop_size: "", purpose: "", comment: "",
    is_active: true,
  });

  const [form, setForm] = useState(emptyForm());
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const csvInputRef = useRef(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}?limit=500`);
      const d = await res.json();
      const rows = Array.isArray(d) ? d : d.rows || d.items || [];
      setItems(rows);
      const existing = new Set(categories.map((c) => c.id));
      for (const r of rows) {
        if (r.category && !existing.has(r.category)) {
          existing.add(r.category);
          setCategories((p) => [...p, { id: r.category, label: r.category }]);
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvImporting(true);
    setCsvResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = useAuthStore.getState().accessToken;
      const res = await fetch("/api/sheet-materials/import-csv", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        setCsvResult({ error: data?.message || "Ошибка импорта" });
      } else {
        setCsvResult(data);
        await fetchItems();
      }
    } catch (err) {
      setCsvResult({ error: err?.message || "Ошибка импорта" });
    } finally {
      setCsvImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  const autoSku = useMemo(() => buildMaterialSku({
    category: form.category, name: form.name,
    size: form.countertop_size || (form.sheet_length_mm && form.sheet_width_mm ? `${form.sheet_length_mm}x${form.sheet_width_mm}` : ""),
  }), [form.category, form.name, form.countertop_size, form.sheet_length_mm, form.sheet_width_mm]);

  const computedM2 = useMemo(() => calcPricePerM2(Number(form.price_per_sheet), Number(form.sheet_length_mm), Number(form.sheet_width_mm)), [form.price_per_sheet, form.sheet_length_mm, form.sheet_width_mm]);

  const sheetArea = useMemo(() => {
    const l = Number(form.sheet_length_mm), w = Number(form.sheet_width_mm);
    return l && w ? ((l * w) / 1_000_000).toFixed(3) : null;
  }, [form.sheet_length_mm, form.sheet_width_mm]);

  const filteredItems = useMemo(() => {
    let list = activeCategory ? items.filter((i) => i.category === activeCategory) : items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) => (i.name || "").toLowerCase().includes(q) || (i.category || "").toLowerCase().includes(q));
    }
    return list;
  }, [items, activeCategory, search]);

  const handleEdit = (item) => {
    setForm({
      name: item.name || "", category: item.category || "",
      sheet_length_mm: item.sheet_length_mm || "", sheet_width_mm: item.sheet_width_mm || "",
      price_per_sheet: item.price_per_sheet || "", countertop_size: item.countertop_size || "",
      purpose: item.purpose || "", comment: item.comment || "",
      is_active: item.is_active ?? true,
    });
    setEditingId(item.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name, sku: autoSku, category: form.category || null,
      sheet_length_mm: form.sheet_length_mm ? Number(form.sheet_length_mm) : null,
      sheet_width_mm: form.sheet_width_mm ? Number(form.sheet_width_mm) : null,
      price_per_sheet: form.price_per_sheet ? Number(form.price_per_sheet) : null,
      price_per_m2: computedM2 ?? null,
      countertop_size: form.countertop_size || null,
      purpose: form.purpose || null, comment: form.comment || null,
      is_active: form.is_active,
    };
    try {
      if (editingId) {
        await fetch(`${API}/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      setEditingId(null);
      setForm(emptyForm());
      fetchItems();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить материал?")) return;
    try { await fetch(`${API}/${id}`, { method: "DELETE" }); fetchItems(); }
    catch (e) { console.error(e); }
  };

  const addCategory = () => {
    const n = newCat.trim();
    if (!n || categories.some((c) => c.id === n)) return;
    setCategories((p) => [...p, { id: n, label: n }]);
    setNewCat("");
  };

  const removeCategory = (catId) => {
    if (items.some((i) => i.category === catId)) { window.alert(`В категории «${catId}» есть записи.`); return; }
    setCategories((p) => p.filter((c) => c.id !== catId));
    if (activeCategory === catId) setActiveCategory(null);
  };

  const isCountertop = (cat) => cat && cat.startsWith("Столешница");

  return (
    <div className="flex-1 min-w-0 w-full">
      <section className="glass-card p-6 space-y-4">
        {/* Заголовок + поиск */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-night-900">Материалы</h2>
            <p className="text-sm text-night-400">{filteredItems.length} записей</p>
          </div>
          <div className="flex items-center gap-3">
            <SecureInput value={search} onChange={setSearch} placeholder="Поиск…" className="max-w-xs" />

            {/* CSV импорт */}
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleCsvUpload} disabled={csvImporting} className="hidden" />
            <button type="button" onClick={() => csvInputRef.current?.click()} disabled={csvImporting}
              className={clsx("flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-xl transition-colors border border-accent bg-accent/5 text-accent hover:bg-accent/10", csvImporting && "opacity-60 cursor-not-allowed")}>
              <FaUpload className="text-xs" /> {csvImporting ? "Импорт…" : "Загрузить CSV"}
            </button>
          </div>
        </div>

        {csvResult && !csvResult.error ? (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
            <span className="font-semibold">Импорт завершён:</span>{" "}
            обработано {csvResult.parsed}, листовых: создано {csvResult.sheetCreated}, обновлено {csvResult.sheetUpdated}, прочих: создано {csvResult.hwCreated}, обновлено {csvResult.hwUpdated}, без изменений {csvResult.skipped}
          </div>
        ) : null}
        {csvResult?.error ? (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{csvResult.error}</div>
        ) : null}

        {/* Табы категорий */}
        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" onClick={() => setActiveCategory(null)}
            className={clsx("px-3 py-1.5 rounded-xl text-sm font-medium transition-colors", !activeCategory ? "bg-accent text-white" : "bg-night-100 text-night-700 hover:bg-night-200")}>
            Все
          </button>
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-0.5">
              <button type="button" onClick={() => setActiveCategory(cat.id)}
                className={clsx("px-3 py-1.5 rounded-xl text-sm font-medium transition-colors", activeCategory === cat.id ? "bg-accent text-white" : "bg-night-100 text-night-700 hover:bg-night-200")}>
                {cat.label}
              </button>
              {!DEFAULT_CATEGORIES.some((dc) => dc.id === cat.id) && (
                <button type="button" onClick={() => removeCategory(cat.id)} className="px-1.5 py-1 rounded-lg text-xs text-night-500 hover:text-red-500 transition-colors">×</button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-1 ml-2">
            <SecureInput value={newCat} onChange={setNewCat} placeholder="Новая категория…" className="w-40" />
            <SecureButton onClick={addCategory} className="px-2 py-1.5 text-sm">+</SecureButton>
          </div>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2 items-start">
          <div className="space-y-4">
            <FormField label="Категория">
              <FormSelect items={categories} value={form.category}
                onChange={(v) => setForm((p) => ({ ...p, category: String(v || "") }))}
                getKey={(c) => c.id} getLabel={(c) => c.label} placeholder="Выберите…" />
            </FormField>
            <FormField label="Наименование позиции" required>
              <SecureInput value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="Наименование" />
            </FormField>
            <FormField label="Длина листа (мм)">
              <SecureInput type="number" value={form.sheet_length_mm} onChange={(v) => setForm((p) => ({ ...p, sheet_length_mm: v }))} placeholder="2800" />
            </FormField>
            <FormField label="Ширина листа (мм)">
              <SecureInput type="number" value={form.sheet_width_mm} onChange={(v) => setForm((p) => ({ ...p, sheet_width_mm: v }))} placeholder="1220" />
            </FormField>
          </div>

          <div className="space-y-4">
            <FormField label="Цена за лист (₽)">
              <SecureInput type="number" value={form.price_per_sheet} onChange={(v) => setForm((p) => ({ ...p, price_per_sheet: v }))} placeholder="4187" />
            </FormField>

            {/* Авто-расчёт м² */}
            {computedM2 !== null && (
              <div className="px-3 py-2 rounded-xl bg-night-50 border border-night-200 text-sm">
                <span className="text-night-500">Цена за м²: </span>
                <span className="font-semibold text-night-900">{computedM2.toFixed(2)} ₽/м²</span>
                {sheetArea && <span className="text-night-500 text-xs ml-2">({sheetArea} м²)</span>}
              </div>
            )}

            {isCountertop(form.category) && (
              <FormField label="Размер столешницы">
                <SecureInput value={form.countertop_size} onChange={(v) => setForm((p) => ({ ...p, countertop_size: v }))} placeholder="4100*600*38" />
              </FormField>
            )}

            <FormField label="Назначение">
              <SecureInput value={form.purpose} onChange={(v) => setForm((p) => ({ ...p, purpose: v }))} placeholder="Назначение" />
            </FormField>

            {/* Toggle — Активен */}
            <FormField label="Активен">
              <button type="button" onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
                className={clsx("relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent", form.is_active ? "bg-accent" : "bg-night-300")}
                aria-pressed={form.is_active}>
                <span className={clsx("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", form.is_active ? "translate-x-4" : "translate-x-0.5")} />
              </button>
            </FormField>

            <FormField label="Комментарий">
              <SecureInput value={form.comment} onChange={(v) => setForm((p) => ({ ...p, comment: v }))} placeholder="Комментарий" />
            </FormField>
          </div>

          <div className="md:col-span-2 flex gap-3">
            <SecureButton type="submit" className="px-6 py-3 flex items-center gap-2">
              {editingId ? <><FaSave /> Сохранить изменения</> : <><FaPlus /> Добавить запись</>}
            </SecureButton>
            {editingId && (
              <SecureButton type="button" variant="ghost" onClick={() => { setEditingId(null); setForm(emptyForm()); }} className="flex items-center gap-2">
                <FaTimes /> Отмена
              </SecureButton>
            )}
          </div>
        </form>

        {/* Таблица */}
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-left text-sm">
            <thead>
              <tr className="text-night-400">
                <th className="py-3 pr-4 w-14">ID</th>
                <th className="py-3 pr-4">Категория</th>
                <th className="py-3 pr-4">Наименование</th>
                <th className="py-3 pr-4 text-right">Цена за м²</th>
                <th className="py-3 pr-4 text-right">Цена за ед.</th>
                <th className="py-3 pr-4 text-center">Активен</th>
                <th className="py-3 pr-4 w-36 text-center">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const area = item.sheet_length_mm && item.sheet_width_mm ? ((item.sheet_length_mm * item.sheet_width_mm) / 1_000_000).toFixed(3) : null;
                return (
                  <tr key={item.id} className="border-t border-night-100 text-night-900">
                    <td className="py-3 pr-4 font-semibold whitespace-nowrap text-xs">#{item.id}</td>
                    <td className="py-3 pr-4"><span className="block min-w-0 max-w-full break-words clamp-2">{item.category || "—"}</span></td>
                    <td className="py-3 pr-4"><span className="block min-w-0 max-w-full break-words clamp-2">{item.name}</span></td>
                    <td className="py-3 pr-4 text-right">
                      {fmt(item.price_per_m2)}
                      {area && <span className="text-xs text-night-500 block">({area} м²)</span>}
                    </td>
                    <td className="py-3 pr-4 text-right">{fmt(item.price_per_sheet)}</td>
                    <td className="py-3 pr-4 text-center">
                      <span className={clsx("inline-block px-2 py-0.5 rounded-lg text-xs font-medium", item.is_active ? "bg-green-100 text-green-700" : "bg-night-100 text-night-500")}>
                        {item.is_active ? "Да" : "Нет"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button type="button" onClick={() => handleEdit(item)} title="Редактировать"
                          className="h-10 px-4 py-2 text-xs flex items-center justify-center border border-accent/30 text-accent-dark hover:border-accent/50 hover:bg-accent/10 rounded-full transition-colors">
                          <LuPencil size={16} />
                        </button>
                        <button type="button" onClick={() => handleDelete(item.id)} title="Удалить"
                          className="h-10 px-4 py-2 text-xs flex items-center justify-center border border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors">
                          <LuTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default MaterialsAdmin;