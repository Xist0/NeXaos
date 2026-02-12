import SecureButton from "../../ui/SecureButton";
import { FaEdit, FaTrash } from "react-icons/fa";
import { getImageUrl } from "../../../utils/image";

const EntityTable = ({
  items,
  loading,
  normalizedFields,
  colors,
  onEdit,
  onDelete,
  dragSort,
}) => {
  const list = dragSort?.isReorderable ? dragSort.orderedItems : items;
  const colSpan = normalizedFields.length + 2 + (dragSort?.isReorderable ? 1 : 0);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-night-400">
              {dragSort?.isReorderable && <th className="py-3 pr-4 w-8"></th>}
              <th className="py-3 pr-4">ID</th>
              {normalizedFields.map((field) => (
                <th key={field.name} className="py-3 pr-4">
                  {field.label}
                </th>
              ))}
              <th className="py-3 pr-4">Действия</th>
            </tr>
          </thead>
          <tbody>
            {list.map((item, index) => (
              <tr
                key={item.id || `item-${index}`}
                className={
                  "border-t border-night-100 text-night-900" +
                  (dragSort?.isReorderable &&
                  dragSort?.dragOverId &&
                  String(dragSort.dragOverId) === String(item?.id)
                    ? " bg-night-50"
                    : "")
                }
                {...(dragSort?.isReorderable ? dragSort.getRowProps(item) : {})}
              >
                {dragSort?.isReorderable && (
                  <td className="py-3 pr-4">
                    <span
                      className={
                        "cursor-grab select-none text-night-300" +
                        ((dragSort?.savingSortOrder || !item?.id) ? " opacity-40" : "")
                      }
                      title={item?.id ? "Перетащите для изменения порядка" : "Нельзя перемещать"}
                    >
                      ⋮⋮
                    </span>
                  </td>
                )}
                <td className="py-3 pr-4 font-semibold">#{item.id || "—"}</td>
                {normalizedFields.map((field) => (
                  <td key={field.name} className="py-3 pr-4">
                    {field.inputType === "image" && item[field.name] ? (
                      <img
                        src={getImageUrl(item[field.name])}
                        alt={field.label}
                        className="h-10 w-10 rounded object-cover border border-night-100"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : field.type === "checkbox" ? (
                      (() => {
                        const v = item[field.name];
                        const checked =
                          v === true ||
                          v === 1 ||
                          v === "1" ||
                          v === "true";
                        const knownFalse =
                          v === false ||
                          v === 0 ||
                          v === "0" ||
                          v === "false";

                        if (v === undefined || v === null || v === "") return "—";
                        return checked ? "Да" : knownFalse ? "Нет" : v ? "Да" : "Нет";
                      })()
                    ) : field.type === "color" && item[field.name] ? (
                      (() => {
                        const colorId = Number(item[field.name]);
                        const color = colors.find((c) => c.id === colorId);
                        if (color) {
                          const imageUrl = getImageUrl(color.image_url);
                          return (
                            <div className="flex items-center gap-2">
                              {imageUrl && (
                                <img
                                  src={imageUrl}
                                  alt={color.name}
                                  className="h-8 w-8 rounded object-cover border border-night-200"
                                  crossOrigin="anonymous"
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                  }}
                                />
                              )}
                              <span className="text-sm text-night-900">{color.name}</span>
                            </div>
                          );
                        }
                        return item[field.name] ?? "—";
                      })()
                    ) : field.type === "select" && Array.isArray(field.options) ? (
                      (() => {
                        const raw = item[field.name];
                        const normalizedValue =
                          (field.name === "type" && (raw === null || raw === undefined || raw === ""))
                            ? "universal"
                            : raw;
                        const opt = field.options.find((o) => String(o?.value) === String(normalizedValue));
                        return opt?.label ?? (normalizedValue ?? "—");
                      })()
                    ) : (
                      item[field.name] ?? "—"
                    )}
                  </td>
                ))}
                <td className="py-3 pr-4">
                  <div className="flex gap-2">
                    <SecureButton
                      variant="outline"
                      className="px-3 py-2 text-xs flex items-center gap-1.5"
                      onClick={() => onEdit(item)}
                      title="Редактировать"
                    >
                      <FaEdit />
                      Редактировать
                    </SecureButton>
                    <SecureButton
                      variant="ghost"
                      className="px-3 py-2 text-xs flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => onDelete(item.id, item)}
                      title="Удалить"
                    >
                      <FaTrash />
                      Удалить
                    </SecureButton>
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && !loading && (
              <tr>
                <td colSpan={colSpan} className="py-6 text-center text-night-400">
                  Нет записей
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {dragSort?.savingSortOrder && dragSort?.isReorderable && (
        <div className="text-sm text-night-500 mt-3">Сохраняем порядок…</div>
      )}
    </>
  );
};

export default EntityTable;
