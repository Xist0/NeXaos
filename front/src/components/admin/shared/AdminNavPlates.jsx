import clsx from "clsx";
import SecureButton from "../../ui/SecureButton";
import { FaPlus } from "react-icons/fa";
import { LuPencil } from "react-icons/lu";

/**
 * Навигационные плашки: клик — переход, удаление по режиму editMode или conditional (deletable).
 */
const AdminNavPlates = ({
  items = [],
  selectedId = null,
  showAdd = true,
  showEdit = false,
  editMode = false,
  onToggleEdit,
  onStartAdd,
  panel = null,
  onSelectItem,
  onDeleteItem,
  deleteMode = "editMode",
  emptyLabel = "Нет записей. Нажмите «Добавить».",
}) => (
  <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      {showAdd ? (
        <SecureButton type="button" onClick={onStartAdd} className="px-4 py-2 text-sm flex items-center gap-2">
          <FaPlus /> Добавить
        </SecureButton>
      ) : null}
      {showEdit ? (
        <SecureButton
          type="button"
          variant={editMode ? "primary" : "outline"}
          onClick={onToggleEdit}
          className="px-4 py-2 text-sm flex items-center gap-2"
        >
          <LuPencil size={14} /> Редактировать
        </SecureButton>
      ) : null}
    </div>

    {panel}

    {items.length === 0 ? (
      <p className="text-sm text-night-500">{emptyLabel}</p>
    ) : (
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const isActive = selectedId != null && String(selectedId) === String(item.id);
          const showDelete =
            deleteMode === "conditional"
              ? Boolean(item.deletable)
              : editMode && Boolean(item.deletable !== false);

          return (
            <div
              key={item.id}
              className={clsx(
                "flex items-stretch rounded-xl border transition-colors overflow-hidden",
                isActive ? "border-accent bg-accent/5" : "border-night-200 bg-white hover:border-night-300"
              )}
            >
              <button
                type="button"
                onClick={() => onSelectItem?.(item)}
                className="flex-1 min-w-0 text-left px-4 py-3"
              >
                <div className="text-sm font-medium text-night-900 truncate">{item.label}</div>
                {item.subtitle ? <div className="text-xs text-night-500 truncate mt-0.5">{item.subtitle}</div> : null}
              </button>
              {showDelete ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteItem?.(item);
                  }}
                  className="px-4 text-night-400 hover:text-red-600 hover:bg-red-50 border-l border-night-200 transition-colors"
                  title="Удалить"
                >
                  ×
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    )}
  </div>
);

export default AdminNavPlates;
