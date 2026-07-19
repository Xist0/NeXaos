import { useEffect, useMemo, useRef, useState } from "react";
import { FaUpload } from "react-icons/fa";
import SecureInput from "../ui/SecureInput";
import FormField from "../ui/FormField";
import AdminGroupPlates from "./shared/AdminGroupPlates";
import AdminConfirmDialog from "./shared/AdminConfirmDialog";
import AdminItemsModal, { fmtPrice } from "./shared/AdminItemsModal";
import AdminPriceInput from "./shared/AdminPriceInput";
import { parsePrice } from "./shared/adminFormat";
import { useAdminCrud } from "./shared/useAdminCrud";
import HardwareFastenerPicker, { HW_CATEGORIES_WITH_FASTENERS } from "./HardwareFastenerPicker";
import apiClient from "../../services/apiClient";
import useAuthStore from "../../store/authStore";
import { buildMaterialSku } from "../../utils/translit";
import clsx from "clsx";

const API = "/api/hardware-extended";

const STATIC_HARDWARE_GROUPS = [
  "Крепежная фурнитура",
  "Расходники",
  "Навесы",
  "Лоток",
  "Сушка",
  "Решётка вентиляционная",
  "Опора",
  "Петли",
  "Подъемные механизмы",
  "Выдвижные системы",
];

const FASTENER_CATEGORIES = new Set(["Крепежная фурнитура", "Расходники"]);

const HardwareAdmin = () => {
  const { items, loading, fetchItems, createItem, updateItem, deleteItem } = useAdminCrud(API);

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [itemForm, setItemForm] = useState({
    name: "",
    price_per_unit: "",
    fasteners: [],
  });
  const [confirm, setConfirm] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const csvInputRef = useRef(null);

  const groups = STATIC_HARDWARE_GROUPS;

  const groupItems = useMemo(
    () => (selectedGroup ? items.filter((i) => i.category === selectedGroup) : []),
    [items, selectedGroup]
  );

  const fastenerItems = useMemo(
    () => items.filter((i) => FASTENER_CATEGORIES.has(i.category) && i.is_active),
    [items]
  );

  const showFastenerPicker = HW_CATEGORIES_WITH_FASTENERS.includes(selectedGroup);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleGroupClick = (group) => {
    setSelectedGroup(group);
    setModalOpen(true);
    setFormOpen(false);
    setEditingId(null);
    setItemForm({
      name: "",
      price_per_unit: "",
      fasteners: [],
    });
  };

  const handleSaveItem = async () => {
    if (!selectedGroup || !itemForm.name.trim()) return;

    const rawPpu = String(itemForm.price_per_unit ?? "").trim();
    const pricePerUnit = parsePrice(rawPpu);
    if (rawPpu && pricePerUnit === undefined) {
      window.alert("Некорректная стоимость за ед. Пример: 1 260,00");
      return;
    }

    const payload = {
      name: itemForm.name.trim(),
      category: selectedGroup,
      sku: buildMaterialSku({ category: selectedGroup, name: itemForm.name }),
      is_active: true,
    };

    if (pricePerUnit !== undefined) payload.price_per_unit = pricePerUnit;
    if (showFastenerPicker) {
      payload.fasteners = itemForm.fasteners.length > 0 ? itemForm.fasteners : [];
    }

    try {
      if (editingId) {
        await updateItem(editingId, payload);
      } else {
        await createItem(payload);
      }
      setFormOpen(false);
      setEditingId(null);
      setItemForm({
        name: "",
        price_per_unit: "",
        fasteners: [],
      });
      await fetchItems();
    } catch (e) {
      console.error(e);
      window.alert(e?.message || "Не удалось сохранить позицию");
    }
  };

  const handleEditItem = (row) => {
    setEditingId(row.id);
    const fasteners = Array.isArray(row.fasteners) ? row.fasteners : [];
    setItemForm({
      name: row.name || "",
      price_per_unit: row.price_per_unit != null && row.price_per_unit !== "" ? String(row.price_per_unit) : "",
      fasteners,
    });
    setFormOpen(true);
  };

  const handleDeleteItem = (row) => {
    setConfirm({
      message: "Вы действительно хотите удалить?",
      onConfirm: async () => {
        try {
          await deleteItem(row.id);
          await fetchItems();
        } catch (e) {
          console.error(e);
        }
        setConfirm(null);
      },
    });
  };

  const renderFasteners = (row) => {
    const fasteners = Array.isArray(row.fasteners) ? row.fasteners : [];
    if (fasteners.length === 0) return "—";
    return fasteners.map((f) => `${f.name} (${f.quantity} шт.)`).join(", ");
  };

  const columnsForGroup = useMemo(() => {
    const cols = [
      { key: "name", label: "Наименование позиции" },
      { key: "price", label: "Стоимость", className: "text-right", render: (r) => fmtPrice(r.price_per_unit) },
    ];
    if (showFastenerPicker) {
      cols.push({ key: "fasteners", label: "Крепеж / расходники", render: renderFasteners });
    }
    return cols;
  }, [showFastenerPicker]);

  const formFieldsForGroup = useMemo(() => (
    <div className="space-y-4 max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Наименование позиции" required>
          <SecureInput value={itemForm.name} onChange={(v) => setItemForm((p) => ({ ...p, name: v }))} />
        </FormField>
        <FormField label="Стоимость">
          <AdminPriceInput
            value={itemForm.price_per_unit}
            onChange={(v) => setItemForm((p) => ({ ...p, price_per_unit: v }))}
          />
        </FormField>
      </div>
      {showFastenerPicker && (
        <FormField label="Крепеж и расходники">
          <HardwareFastenerPicker
            hardwareItems={fastenerItems}
            value={itemForm.fasteners}
            onChange={(v) => setItemForm((p) => ({ ...p, fasteners: v }))}
          />
        </FormField>
      )}
    </div>
  ), [itemForm, showFastenerPicker, fastenerItems]);

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvImporting(true);
    setCsvResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = useAuthStore.getState().accessToken;
      const { data } = await apiClient.post("/hardware-extended/import-csv", formData, {
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
      <section className="glass-card p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-night-900">Фурнитура</h2>
          <p className="text-sm text-night-400">Группы и позиции фурнитуры</p>
        </div>

        <div className="border-t border-night-200 pt-4">
          <div className="text-sm font-semibold text-night-800 mb-2">Фурнитура</div>
          <AdminGroupPlates
            groups={STATIC_HARDWARE_GROUPS}
            selectedGroup={selectedGroup}
            readOnly
            onSelectGroup={handleGroupClick}
          />
        </div>

        {loading ? <p className="text-sm text-night-500">Загрузка…</p> : null}
      </section>

      <AdminItemsModal
        open={modalOpen}
        title={selectedGroup ? `Наименование позиции — ${selectedGroup}` : "Наименование позиции"}
        columns={columnsForGroup}
        rows={groupItems}
        formOpen={formOpen}
        formTitle={editingId ? "Редактирование позиции" : "Новая позиция"}
        formFields={formFieldsForGroup}
        editingId={editingId}
        onClose={() => {
          setModalOpen(false);
          setFormOpen(false);
          setEditingId(null);
        }}
        onStartAdd={() => {
          setEditingId(null);
          setItemForm({
            name: "",
            price_per_unit: "",
            fasteners: [],
          });
          setFormOpen(true);
        }}
        onStartEdit={handleEditItem}
        onCancelForm={() => {
          setFormOpen(false);
          setEditingId(null);
          setItemForm({
            name: "",
            price_per_unit: "",
            fasteners: [],
          });
        }}
        onSaveForm={handleSaveItem}
        onDeleteRow={handleDeleteItem}
      />

      <AdminConfirmDialog
        open={Boolean(confirm)}
        message={confirm?.message}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};

export default HardwareAdmin;
