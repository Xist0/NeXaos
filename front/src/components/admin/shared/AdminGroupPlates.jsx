import clsx from "clsx";
import SecureButton from "../../ui/SecureButton";
import SecureInput from "../../ui/SecureInput";
import { FaPlus, FaSave, FaTimes } from "react-icons/fa";
import { LuPencil } from "react-icons/lu";

/**
 * Список групп плашками: Добавить / Редактировать, удаление крестиком справа.
 */
const AdminGroupPlates = ({
  groups = [],
  selectedGroup = null,
  editMode = false,
  panelMode = null,
  panelValue = "",
  onPanelValueChange,
  onStartAdd,
  onToggleEdit,
  onCancelPanel,
  onSavePanel,
  onSelectGroup,
  onRequestDeleteGroup,
}) => (
  <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      <SecureButton type="button" onClick={onStartAdd} className="px-4 py-2 text-sm flex items-center gap-2">
        <FaPlus /> Добавить
      </SecureButton>
      <SecureButton
        type="button"
        variant={editMode ? "primary" : "outline"}
        onClick={onToggleEdit}
        className="px-4 py-2 text-sm flex items-center gap-2"
      >
        <LuPencil size={14} /> Редактировать
      </SecureButton>
    </div>

    {panelMode ? (
      <div className="rounded-xl border border-night-200 bg-night-50/80 p-4 space-y-3">
        <div className="text-sm font-semibold text-night-800">
          {panelMode === "add" ? "Новая группа" : "Редактирование группы"}
        </div>
        <SecureInput
          value={panelValue}
          onChange={onPanelValueChange}
          placeholder="Наименование"
          className="max-w-md"
        />
        <div className="flex gap-2">
          <SecureButton type="button" onClick={onSavePanel} className="px-4 py-2 text-sm flex items-center gap-2">
            <FaSave /> Сохранить
          </SecureButton>
          <SecureButton type="button" variant="ghost" onClick={onCancelPanel} className="px-4 py-2 text-sm flex items-center gap-2">
            <FaTimes /> Отмена
          </SecureButton>
        </div>
      </div>
    ) : null}

    {groups.length === 0 ? (
      <p className="text-sm text-night-500">Группы не добавлены. Нажмите «Добавить».</p>
    ) : (
      <div className="flex flex-col gap-2">
        {groups.map((group) => {
          const isActive = selectedGroup === group;
          return (
            <div
              key={group}
              className={clsx(
                "flex items-stretch rounded-xl border transition-colors overflow-hidden",
                isActive ? "border-accent bg-accent/5" : "border-night-200 bg-white hover:border-night-300"
              )}
            >
              <button
                type="button"
                onClick={() => onSelectGroup?.(group)}
                className="flex-1 min-w-0 text-left px-4 py-3 text-sm font-medium text-night-900 truncate"
              >
                {group}
              </button>
              {editMode ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestDeleteGroup?.(group);
                  }}
                  className="px-4 text-night-400 hover:text-red-600 hover:bg-red-50 border-l border-night-200 transition-colors"
                  title="Удалить группу"
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

export default AdminGroupPlates;
