import { useEffect, useMemo, useState } from "react";
import SecureInput from "../ui/SecureInput";
import FormField from "../ui/FormField";
import AdminGroupPlates from "./shared/AdminGroupPlates";
import AdminConfirmDialog from "./shared/AdminConfirmDialog";
import AdminItemsModal, { fmtPrice } from "./shared/AdminItemsModal";
import AdminPriceInput from "./shared/AdminPriceInput";
import { loadStoredGroups, mergeGroupsFromItems, parsePrice, saveStoredGroups } from "./shared/adminFormat";
import { useAdminCrud } from "./shared/useAdminCrud";
import { buildMaterialSku } from "../../utils/translit";

const API = "/api/hardware-extended";
const GROUPS_KEY = "admin_hardware_groups";

const HardwareAdmin = () => {
  const { items, loading, fetchItems, createItem, updateItem, deleteItem } = useAdminCrud(API);

  const [storedGroups, setStoredGroups] = useState(() => loadStoredGroups(GROUPS_KEY));
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [panelMode, setPanelMode] = useState(null);
  const [panelValue, setPanelValue] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [itemForm, setItemForm] = useState({ name: "", price_per_unit: "" });
  const [confirm, setConfirm] = useState(null);

  const groups = useMemo(() => mergeGroupsFromItems(storedGroups, items), [storedGroups, items]);

  const groupItems = useMemo(
    () => (selectedGroup ? items.filter((i) => i.category === selectedGroup) : []),
    [items, selectedGroup]
  );

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const persistGroups = (next) => {
    setStoredGroups(next);
    saveStoredGroups(GROUPS_KEY, next);
  };

  const handleSaveGroupPanel = () => {
    const name = panelValue.trim();
    if (!name) return;

    if (panelMode === "add") {
      if (!groups.includes(name)) persistGroups([...storedGroups, name]);
    } else if (panelMode === "edit" && selectedGroup) {
      const next = storedGroups.map((g) => (g === selectedGroup ? name : g));
      persistGroups(next.filter((g, i, arr) => arr.indexOf(g) === i));
      if (selectedGroup !== name) {
        const toUpdate = items.filter((i) => i.category === selectedGroup);
        Promise.all(
          toUpdate.map((item) =>
            updateItem(item.id, {
              ...item,
              category: name,
              sku: buildMaterialSku({ category: name, name: item.name }),
            })
          )
        ).then(() => fetchItems());
      }
      setSelectedGroup(name);
    }

    setPanelMode(null);
    setPanelValue("");
  };

  const handleDeleteGroup = async (groupName) => {
    const hasItems = items.some((i) => i.category === groupName);
    if (hasItems) {
      window.alert(`В группе «${groupName}» есть позиции. Сначала удалите их.`);
      return;
    }
    setConfirm({
      message: "Вы действительно хотите удалить?",
      onConfirm: () => {
        persistGroups(storedGroups.filter((g) => g !== groupName));
        if (selectedGroup === groupName) setSelectedGroup(null);
        setConfirm(null);
      },
    });
  };

  const handleGroupClick = (group) => {
    setSelectedGroup(group);
    if (editMode) {
      setPanelMode("edit");
      setPanelValue(group);
      return;
    }
    setModalOpen(true);
    setFormOpen(false);
    setEditingId(null);
    setItemForm({ name: "", price_per_unit: "" });
  };

  const handleToggleEdit = () => {
    setEditMode((prev) => {
      const next = !prev;
      if (!next) {
        setPanelMode(null);
        setPanelValue("");
      }
      return next;
    });
  };

  const handleSaveItem = async () => {
    if (!selectedGroup || !itemForm.name.trim()) return;

    const rawPrice = String(itemForm.price_per_unit ?? "").trim();
    const price = parsePrice(rawPrice);
    if (rawPrice && price === undefined) {
      window.alert("Некорректная стоимость. Пример: 1 260,00");
      return;
    }

    const payload = {
      name: itemForm.name.trim(),
      category: selectedGroup,
      sku: buildMaterialSku({ category: selectedGroup, name: itemForm.name }),
      is_active: true,
    };
    if (price !== undefined) payload.price_per_unit = price;
    try {
      if (editingId) {
        await updateItem(editingId, payload);
      } else {
        await createItem(payload);
      }
      setFormOpen(false);
      setEditingId(null);
      setItemForm({ name: "", price_per_unit: "" });
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
      price_per_unit: row.price_per_unit != null && row.price_per_unit !== "" ? String(row.price_per_unit) : "",
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

  return (
    <div className="flex-1 min-w-0 w-full">
      <section className="glass-card p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-night-900">Фурнитура</h2>
          <p className="text-sm text-night-400">Группы и позиции фурнитуры</p>
        </div>

        <AdminGroupPlates
          groups={groups}
          selectedGroup={selectedGroup}
          editMode={editMode}
          panelMode={panelMode}
          panelValue={panelValue}
          onPanelValueChange={setPanelValue}
          onStartAdd={() => {
            setPanelMode("add");
            setPanelValue("");
          }}
          onToggleEdit={handleToggleEdit}
          onCancelPanel={() => {
            setPanelMode(null);
            setPanelValue("");
          }}
          onSavePanel={handleSaveGroupPanel}
          onSelectGroup={handleGroupClick}
          onRequestDeleteGroup={handleDeleteGroup}
        />

        {loading ? <p className="text-sm text-night-500">Загрузка…</p> : null}
      </section>

      <AdminItemsModal
        open={modalOpen}
        title={selectedGroup ? `Наименование позиции — ${selectedGroup}` : "Наименование позиции"}
        columns={[
          { key: "name", label: "Наименование позиции" },
          { key: "price", label: "Стоимость", className: "text-right", render: (r) => fmtPrice(r.price_per_unit) },
        ]}
        rows={groupItems}
        formOpen={formOpen}
        formTitle={editingId ? "Редактирование позиции" : "Новая позиция"}
        formFields={
          <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
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
        }
        editingId={editingId}
        onClose={() => {
          setModalOpen(false);
          setFormOpen(false);
          setEditingId(null);
        }}
        onStartAdd={() => {
          setEditingId(null);
          setItemForm({ name: "", price_per_unit: "" });
          setFormOpen(true);
        }}
        onStartEdit={handleEditItem}
        onCancelForm={() => {
          setFormOpen(false);
          setEditingId(null);
          setItemForm({ name: "", price_per_unit: "" });
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
