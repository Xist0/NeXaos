import { useCallback, useEffect, useState } from "react";
import { FaPlus, FaSave, FaTimes } from "react-icons/fa";
import { LuPencil, LuTrash2 } from "react-icons/lu";
import SecureButton from "../ui/SecureButton";
import SecureInput from "../ui/SecureInput";
import FormField from "../ui/FormField";
import AdminConfirmDialog from "./shared/AdminConfirmDialog";
import useApi from "../../hooks/useApi";

const CalculationParametersAdmin = () => {
  const { get, post, put, del } = useApi();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", numeric_value: "" });
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get("/calculation-parameters", { limit: 200 });
      setItems(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm({ name: "", numeric_value: "" });
    setEditingId(null);
    setFormOpen(false);
  };

  const handleEdit = (item) => {
    setForm({
      name: item.name || "",
      numeric_value: item.numeric_value != null ? String(item.numeric_value) : "",
    });
    setEditingId(item.id);
    setFormOpen(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) return;
    const num = Number(String(form.numeric_value).replace(",", "."));
    const payload = {
      name,
      numeric_value: Number.isFinite(num) ? num : 0,
      value: String(form.numeric_value),
    };

    try {
      if (editingId) {
        await put(`/calculation-parameters/${editingId}`, payload);
      } else {
        await post("/calculation-parameters", payload);
      }
      resetForm();
      await load();
    } catch (e) {
      window.alert(e?.response?.data?.message || e?.message || "Не удалось сохранить");
    }
  };

  const handleDelete = (item) => {
    setConfirm({
      message: `Удалить параметр «${item.name}»?`,
      onConfirm: async () => {
        try {
          await del(`/calculation-parameters/${item.id}`);
          await load();
        } catch (e) {
          window.alert(e?.message || "Не удалось удалить");
        }
        setConfirm(null);
      },
    });
  };

  return (
    <div className="flex-1 min-w-0 w-full">
      <section className="glass-card p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-night-900">Параметры расчёта</h2>
          <p className="text-sm text-night-400 mt-1">
            Коэффициенты для серверного расчёта стоимости модуля. Например: Коэф. общий — 2,2; На плитный — 1,2; На кромку — 1,15.
          </p>
        </div>

        <div className="flex justify-end">
          <SecureButton
            type="button"
            onClick={() => {
              resetForm();
              setFormOpen(true);
            }}
            className="px-4 py-2 text-sm flex items-center gap-2"
          >
            <FaPlus /> Добавить параметр
          </SecureButton>
        </div>

        {formOpen ? (
          <div className="rounded-xl border border-night-200 bg-night-50/80 p-4 space-y-4 max-w-lg">
            <div className="text-sm font-semibold text-night-800">
              {editingId ? "Редактировать параметр" : "Новый параметр"}
            </div>
            <FormField label="Наименование параметра" required>
              <SecureInput value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="Коэф. общий" />
            </FormField>
            <FormField label="Число" required>
              <SecureInput
                type="number"
                step="0.01"
                value={form.numeric_value}
                onChange={(v) => setForm((p) => ({ ...p, numeric_value: v }))}
                placeholder="2.2"
              />
            </FormField>
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
          <table className="w-full text-sm border border-night-200 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-night-50 border-b border-night-200">
                <th className="px-4 py-3 text-left font-semibold text-night-700">Наименование</th>
                <th className="px-4 py-3 text-right font-semibold text-night-700">Число</th>
                <th className="px-4 py-3 text-right font-semibold text-night-700 w-24">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-night-400">Загрузка…</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-night-400">Параметры не добавлены</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-night-100 hover:bg-night-50/50">
                    <td className="px-4 py-3 text-night-800">{item.name}</td>
                    <td className="px-4 py-3 text-right font-medium text-night-900">
                      {item.numeric_value != null
                        ? Number(item.numeric_value).toLocaleString("ru-RU", { maximumFractionDigits: 4 })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => handleEdit(item)} className="p-2 text-night-400 hover:text-accent" title="Редактировать">
                          <LuPencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(item)} className="p-2 text-night-400 hover:text-red-500" title="Удалить">
                          <LuTrash2 className="w-4 h-4" />
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

export default CalculationParametersAdmin;
