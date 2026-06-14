import { useEffect, useState } from "react";
import { FaPlus, FaSave, FaTimes } from "react-icons/fa";
import { LuPencil, LuTrash2 } from "react-icons/lu";
import SecureButton from "../../ui/SecureButton";
import { fmtPrice } from "./adminFormat";

/**
 * Модальное окно позиций группы: таблица + скрытая форма по кнопке Добавить/Редактировать.
 */
const AdminItemsModal = ({
  open,
  title,
  columns = [],
  rows = [],
  formOpen = false,
  formTitle = "",
  formFields = null,
  onClose,
  onStartAdd,
  onStartEdit,
  onCancelForm,
  onSaveForm,
  onDeleteRow,
  editingId = null,
}) => {
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!open) setEditMode(false);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-white border border-night-200 shadow-2xl">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-night-200">
          <h3 className="text-lg font-semibold text-night-900 truncate">{title}</h3>
          <button type="button" onClick={onClose} className="text-night-400 hover:text-night-700 text-2xl leading-none px-2">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <SecureButton type="button" onClick={onStartAdd} className="px-4 py-2 text-sm flex items-center gap-2">
              <FaPlus /> Добавить
            </SecureButton>
            <SecureButton
              type="button"
              variant={editMode ? "primary" : "outline"}
              onClick={() => setEditMode((v) => !v)}
              className="px-4 py-2 text-sm flex items-center gap-2"
            >
              <LuPencil size={14} /> Редактировать
            </SecureButton>
          </div>

          {formOpen ? (
            <div className="rounded-xl border border-night-200 bg-night-50/80 p-4 space-y-4">
              <div className="text-sm font-semibold text-night-800">{formTitle}</div>
              {formFields}
              <div className="flex gap-2">
                <SecureButton type="button" onClick={onSaveForm} className="px-4 py-2 text-sm flex items-center gap-2">
                  <FaSave /> Сохранить
                </SecureButton>
                <SecureButton type="button" variant="ghost" onClick={onCancelForm} className="px-4 py-2 text-sm flex items-center gap-2">
                  <FaTimes /> Отмена
                </SecureButton>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-left text-sm">
              <thead>
                <tr className="text-night-400">
                  {columns.map((col) => (
                    <th key={col.key} className={`py-3 pr-4 ${col.className || ""}`}>
                      {col.label}
                    </th>
                  ))}
                  <th className="py-3 pr-4 w-28 text-center">Действия</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="py-8 text-center text-night-500">
                      Позиции не добавлены
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-night-100 text-night-900">
                      {columns.map((col) => (
                        <td key={col.key} className={`py-3 pr-4 ${col.className || ""}`}>
                          <span className="block min-w-0 break-words">
                            {col.render ? col.render(row) : row[col.key] ?? "—"}
                          </span>
                        </td>
                      ))}
                      <td className="py-3 pr-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => onStartEdit?.(row)}
                            title="Редактировать"
                            className="h-9 px-3 flex items-center justify-center border border-accent/30 text-accent-dark hover:bg-accent/10 rounded-full"
                          >
                            <LuPencil size={15} />
                          </button>
                          {editMode ? (
                            <button
                              type="button"
                              onClick={() => onDeleteRow?.(row)}
                              title="Удалить"
                              className="h-9 px-3 flex items-center justify-center border border-red-200 text-red-600 hover:bg-red-50 rounded-full"
                            >
                              <LuTrash2 size={15} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export { fmtPrice };
export default AdminItemsModal;
