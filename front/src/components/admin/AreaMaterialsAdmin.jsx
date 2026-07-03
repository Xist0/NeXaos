import { useEffect, useMemo, useState } from "react";
import SecureInput from "../ui/SecureInput";
import AdminGroupPlates from "./shared/AdminGroupPlates";
import AdminConfirmDialog from "./shared/AdminConfirmDialog";
import AdminItemsModal, { fmtPrice } from "./shared/AdminItemsModal";
import AdminPriceInput from "./shared/AdminPriceInput";
import FormField from "../ui/FormField";
import { parsePrice } from "./shared/adminFormat";
import { useAdminCrud } from "./shared/useAdminCrud";
import { buildMaterialSku } from "../../utils/translit";

const HARDWARE_API = "/api/hardware-extended";

const ALL_GROUPS = [
  "Рамка",
  "Стекло в рамку",
  "Пленка под фрезу",
];

const AreaMaterialsAdmin = () => {
  const { items: hwItems, loading: hwLoading, fetchItems: fetchHwItems, createItem: createHwItem, updateItem: updateHwItem, deleteItem: deleteHwItem } = useAdminCrud(HARDWARE_API);

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const [hwForm, setHwForm] = useState({ name: "", price_per_m2: "" });

  const groupItems = useMemo(() => {
    if (!selectedGroup) return [];
    return hwItems.filter((i) => i.category === selectedGroup);
  }, [selectedGroup, hwItems]);

  useEffect(() => {
    fetchHwItems();
  }, [fetchHwItems]);

  const handleGroupClick = (group) => {
    setSelectedGroup(group);
    setModalOpen(true);
    setFormOpen(false);
    setEditingId(null);
    setHwForm({ name: "", price_per_m2: "" });
  };

  const handleSaveItem = async () => {
    if (!selectedGroup || !hwForm.name.trim()) return;
    const pricePerM2 = parsePrice(hwForm.price_per_m2);
    const payload = {
      name: hwForm.name.trim(),
      category: selectedGroup,
      sku: buildMaterialSku({ category: selectedGroup, name: hwForm.name }),
      is_active: true,
    };
    if (pricePerM2 !== undefined) payload.price_per_m2 = pricePerM2;
    try {
      if (editingId) await updateHwItem(editingId, payload);
      else await createHwItem(payload);
      setFormOpen(false);
      setEditingId(null);
      setHwForm({ name: "", price_per_m2: "" });
      await fetchHwItems();
    } catch (e) {
      console.error(e);
      window.alert(e?.message || "Не удалось сохранить позицию");
    }
  };

  const handleEditItem = (row) => {
    setEditingId(row.id);
    setHwForm({
      name: row.name || "",
      price_per_m2: row.price_per_m2 != null && row.price_per_m2 !== "" ? String(row.price_per_m2) : "",
    });
    setFormOpen(true);
  };

  const handleDeleteItem = (row) => {
    setConfirm({
      message: "Вы действительно хотите удалить?",
      onConfirm: async () => {
        try {
          await deleteHwItem(row.id);
        } catch (e) { console.error(e); }
        setConfirm(null);
        await fetchHwItems();
      },
    });
  };

  const columnsForGroup = useMemo(() => [
    { key: "name", label: "Наименование позиции" },
    { key: "price_m2", label: "Стоимость за м²", className: "text-right", render: (r) => fmtPrice(r.price_per_m2) },
  ], []);

  const formFieldsForGroup = useMemo(() => (
    <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
      <FormField label="Наименование позиции" required>
        <SecureInput value={hwForm.name} onChange={(v) => setHwForm((p) => ({ ...p, name: v }))} />
      </FormField>
      <FormField label="Стоимость за м²">
        <AdminPriceInput value={hwForm.price_per_m2} onChange={(v) => setHwForm((p) => ({ ...p, price_per_m2: v }))} />
      </FormField>
    </div>
  ), [hwForm]);

  const handleStartAdd = () => {
    setEditingId(null);
    setHwForm({ name: "", price_per_m2: "" });
    setFormOpen(true);
  };

  const handleCancelForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setHwForm({ name: "", price_per_m2: "" });
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setFormOpen(false);
    setEditingId(null);
  };

  return (
    <div className="flex-1 min-w-0 w-full">
      <section className="glass-card p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-night-900">Площадной материал</h2>
          <p className="text-sm text-night-400">Рамка, стекло в рамку, пленка под фрезу</p>
        </div>

        <AdminGroupPlates
          groups={ALL_GROUPS}
          selectedGroup={selectedGroup}
          readOnly
          onSelectGroup={handleGroupClick}
        />

        {hwLoading ? <p className="text-sm text-night-500">Загрузка…</p> : null}
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
        onClose={handleCloseModal}
        onStartAdd={handleStartAdd}
        onStartEdit={handleEditItem}
        onCancelForm={handleCancelForm}
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

export default AreaMaterialsAdmin;
