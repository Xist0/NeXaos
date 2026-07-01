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
const SHEET_API = "/api/sheet-materials";

const ALL_GROUPS = [
  "Пиломатериал",
  "Рамка",
  "Стекло в рамку",
  "Пленка под фрезу",
  "Вид фрезы",
];

const SHEET_GROUPS = new Set(["Пиломатериал"]);

const OtherMaterialsAdmin = () => {
  const { items: hwItems, loading: hwLoading, fetchItems: fetchHwItems, createItem: createHwItem, updateItem: updateHwItem, deleteItem: deleteHwItem } = useAdminCrud(HARDWARE_API);
  const { items: sheetItems, loading: sheetLoading, fetchItems: fetchSheetItems, createItem: createSheetItem, updateItem: updateSheetItem, deleteItem: deleteSheetItem } = useAdminCrud(SHEET_API);

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirm, setConfirm] = useState(null);

  // Форма для hardware групп (Рамка, Стекло, Пленка, Фрезы)
  const [hwForm, setHwForm] = useState({ name: "", price_per_m2: "" });

  // Форма для sheet групп (Пиломатериал)
  const [sheetForm, setSheetForm] = useState({ name: "", price_per_m2: "", price_per_sheet: "" });

  const isSheetGroup = (g) => SHEET_GROUPS.has(g);

  const groupItems = useMemo(() => {
    if (!selectedGroup) return [];
    if (isSheetGroup(selectedGroup)) {
      return sheetItems.filter((i) => i.category === selectedGroup);
    }
    return hwItems.filter((i) => i.category === selectedGroup);
  }, [selectedGroup, hwItems, sheetItems]);

  useEffect(() => {
    fetchHwItems();
    fetchSheetItems();
  }, [fetchHwItems, fetchSheetItems]);

  const handleGroupClick = (group) => {
    setSelectedGroup(group);
    setModalOpen(true);
    setFormOpen(false);
    setEditingId(null);
    if (isSheetGroup(group)) {
      setSheetForm({ name: "", price_per_m2: "", price_per_sheet: "" });
    } else {
      setHwForm({ name: "", price_per_m2: "" });
    }
  };

  // ——— Save ———
  const handleSaveItem = async () => {
    if (!selectedGroup) return;

    if (isSheetGroup(selectedGroup)) {
      if (!sheetForm.name.trim()) return;
      const payload = {
        name: sheetForm.name.trim(),
        category: selectedGroup,
        sku: buildMaterialSku({ category: selectedGroup, name: sheetForm.name }),
        price_per_m2: parsePrice(sheetForm.price_per_m2) ?? undefined,
        price_per_sheet: parsePrice(sheetForm.price_per_sheet) ?? undefined,
        is_active: true,
      };
      try {
        if (editingId) await updateSheetItem(editingId, payload);
        else await createSheetItem(payload);
        setFormOpen(false);
        setEditingId(null);
        setSheetForm({ name: "", price_per_m2: "", price_per_sheet: "" });
        await fetchSheetItems();
      } catch (e) {
        console.error(e);
        window.alert(e?.message || "Не удалось сохранить позицию");
      }
      return;
    }

    // Hardware groups
    if (!hwForm.name.trim()) return;
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

  // ——— Edit ———
  const handleEditItem = (row) => {
    setEditingId(row.id);
    if (isSheetGroup(selectedGroup)) {
      setSheetForm({
        name: row.name || "",
        price_per_m2: row.price_per_m2 != null ? String(row.price_per_m2) : "",
        price_per_sheet: row.price_per_sheet != null ? String(row.price_per_sheet) : "",
      });
    } else {
      setHwForm({
        name: row.name || "",
        price_per_m2: row.price_per_m2 != null && row.price_per_m2 !== "" ? String(row.price_per_m2) : "",
      });
    }
    setFormOpen(true);
  };

  // ——— Delete ———
  const handleDeleteItem = (row) => {
    setConfirm({
      message: "Вы действительно хотите удалить?",
      onConfirm: async () => {
        try {
          if (isSheetGroup(selectedGroup)) await deleteSheetItem(row.id);
          else await deleteHwItem(row.id);
        } catch (e) { console.error(e); }
        setConfirm(null);
        if (isSheetGroup(selectedGroup)) await fetchSheetItems();
        else await fetchHwItems();
      },
    });
  };

  // ——— Columns & form for modal ———
  const columnsForGroup = useMemo(() => {
    if (isSheetGroup(selectedGroup)) {
      return [
        { key: "name", label: "Наименование позиции" },
        { key: "price_m2", label: "Стоимость за м²", className: "text-right", render: (r) => fmtPrice(r.price_per_m2) },
        { key: "price_sheet", label: "Стоимость за ед.", className: "text-right", render: (r) => fmtPrice(r.price_per_sheet) },
      ];
    }
    return [
      { key: "name", label: "Наименование позиции" },
      { key: "price_m2", label: "Стоимость за м²", className: "text-right", render: (r) => fmtPrice(r.price_per_m2) },
    ];
  }, [selectedGroup]);

  const formFieldsForGroup = useMemo(() => {
    if (isSheetGroup(selectedGroup)) {
      return (
        <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
          <FormField label="Наименование позиции" required>
            <SecureInput value={sheetForm.name} onChange={(v) => setSheetForm((p) => ({ ...p, name: v }))} />
          </FormField>
          <FormField label="Стоимость за м²">
            <AdminPriceInput value={sheetForm.price_per_m2} onChange={(v) => setSheetForm((p) => ({ ...p, price_per_m2: v }))} />
          </FormField>
          <FormField label="Стоимость за ед.">
            <AdminPriceInput value={sheetForm.price_per_sheet} onChange={(v) => setSheetForm((p) => ({ ...p, price_per_sheet: v }))} />
          </FormField>
        </div>
      );
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
        <FormField label="Наименование позиции" required>
          <SecureInput value={hwForm.name} onChange={(v) => setHwForm((p) => ({ ...p, name: v }))} />
        </FormField>
        <FormField label="Стоимость за м²">
          <AdminPriceInput value={hwForm.price_per_m2} onChange={(v) => setHwForm((p) => ({ ...p, price_per_m2: v }))} />
        </FormField>
      </div>
    );
  }, [selectedGroup, hwForm, sheetForm]);

  const handleStartAdd = () => {
    setEditingId(null);
    if (isSheetGroup(selectedGroup)) setSheetForm({ name: "", price_per_m2: "", price_per_sheet: "" });
    else setHwForm({ name: "", price_per_m2: "" });
    setFormOpen(true);
  };

  const handleCancelForm = () => {
    setFormOpen(false);
    setEditingId(null);
    if (isSheetGroup(selectedGroup)) setSheetForm({ name: "", price_per_m2: "", price_per_sheet: "" });
    else setHwForm({ name: "", price_per_m2: "" });
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
          <h2 className="text-xl font-semibold text-night-900">Прочее материал</h2>
          <p className="text-sm text-night-400">Пиломатериал, рамка, стекло, пленка, фрезеровка</p>
        </div>

        <AdminGroupPlates
          groups={ALL_GROUPS}
          selectedGroup={selectedGroup}
          readOnly
          onSelectGroup={handleGroupClick}
        />

        {(hwLoading || sheetLoading) ? <p className="text-sm text-night-500">Загрузка…</p> : null}
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

export default OtherMaterialsAdmin;
