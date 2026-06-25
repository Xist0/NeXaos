import { useEffect, useMemo, useState } from "react";
import SecureInput from "../ui/SecureInput";
import FormField from "../ui/FormField";
import AdminGroupPlates from "./shared/AdminGroupPlates";
import AdminConfirmDialog from "./shared/AdminConfirmDialog";
import AdminItemsModal, { fmtPrice } from "./shared/AdminItemsModal";
import AdminPriceInput from "./shared/AdminPriceInput";
import { parsePrice } from "./shared/adminFormat";
import { useAdminCrud } from "./shared/useAdminCrud";
import { buildMaterialSku } from "../../utils/translit";

const API = "/api/hardware-extended";

const OTHER_MATERIAL_GROUPS = [
  "Рамка",
  "Стекло в рамку",
  "Пленка под фрезу",
  "Вид фрезы",
];

const OtherMaterialsAdmin = () => {
  const { items, loading, fetchItems, createItem, updateItem, deleteItem } = useAdminCrud(API);

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [itemForm, setItemForm] = useState({
    name: "",
    price_per_m2: "",
  });
  const [confirm, setConfirm] = useState(null);

  const groupItems = useMemo(
    () => (selectedGroup ? items.filter((i) => i.category === selectedGroup) : []),
    [items, selectedGroup]
  );

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleGroupClick = (group) => {
    setSelectedGroup(group);
    setModalOpen(true);
    setFormOpen(false);
    setEditingId(null);
    setItemForm({ name: "", price_per_m2: "" });
  };

  const handleSaveItem = async () => {
    if (!selectedGroup || !itemForm.name.trim()) return;

    const rawM2 = String(itemForm.price_per_m2 ?? "").trim();
    const pricePerM2 = parsePrice(rawM2);

    const payload = {
      name: itemForm.name.trim(),
      category: selectedGroup,
      sku: buildMaterialSku({ category: selectedGroup, name: itemForm.name }),
      is_active: true,
    };

    if (pricePerM2 !== undefined) payload.price_per_m2 = pricePerM2;

    try {
      if (editingId) {
        await updateItem(editingId, payload);
      } else {
        await createItem(payload);
      }
      setFormOpen(false);
      setEditingId(null);
      setItemForm({ name: "", price_per_m2: "" });
      await fetchItems();
    } catch (e) {
      console.error(e);
      window.alert(e?.message || "Не удалось сохранить позицию");
    }
  };

  const handleEditItem = (row) => {
    setEditingId(row.id);
    setItemForm({
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
          await deleteItem(row.id);
          await fetchItems();
        } catch (e) {
          console.error(e);
        }
        setConfirm(null);
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
        <SecureInput value={itemForm.name} onChange={(v) => setItemForm((p) => ({ ...p, name: v }))} />
      </FormField>
      <FormField label="Стоимость за м²">
        <AdminPriceInput
          value={itemForm.price_per_m2}
          onChange={(v) => setItemForm((p) => ({ ...p, price_per_m2: v }))}
        />
      </FormField>
    </div>
  ), [itemForm]);

  return (
    <div className="flex-1 min-w-0 w-full">
      <section className="glass-card p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-night-900">Прочее материал</h2>
          <p className="text-sm text-night-400">Рамка, стекло, пленка, фрезеровка</p>
        </div>

        <AdminGroupPlates
          groups={OTHER_MATERIAL_GROUPS}
          selectedGroup={selectedGroup}
          readOnly
          onSelectGroup={handleGroupClick}
        />

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
          setItemForm({ name: "", price_per_m2: "" });
          setFormOpen(true);
        }}
        onStartEdit={handleEditItem}
        onCancelForm={() => {
          setFormOpen(false);
          setEditingId(null);
          setItemForm({ name: "", price_per_m2: "" });
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

export default OtherMaterialsAdmin;
