import EditableSelect from "./EditableSelect";

/**
 * Глобальный компонент — карточка характеристики с toggle видимости.
 * Заменяет дублирующийся паттерн из ProductCharacteristicsEditor.
 *
 * @param {object} props
 * @param {string} props.label — название характеристики
 * @param {string} props.value — текущее значение
 * @param {function} props.onChange — (value) => void
 * @param {function} props.onVisibilityChange — (visible: boolean) => void
 * @param {boolean} props.visible — видна ли характеристика
 * @param {Array} [props.suggestions=[]] — подсказки для EditableSelect
 * @param {boolean} [props.disabled=false] — заблокировано ли поле
 */
const CharacteristicCard = ({
  label,
  value,
  onChange,
  onVisibilityChange,
  visible = true,
  suggestions = [],
  disabled = false,
}) => (
  <div
    className={`rounded-xl border p-3 space-y-2 min-w-0 overflow-visible ${
      visible ? "border-night-100 bg-white" : "border-night-100/60 bg-night-50/60"
    }`}
  >
    <div className="flex items-center justify-between gap-2">
      <div className="text-xs font-semibold text-night-800 leading-snug">{label}</div>
      <button
        type="button"
        onClick={() => onVisibilityChange?.(!visible)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent ${
          visible ? "bg-accent" : "bg-night-300"
        }`}
        aria-pressed={visible}
        title={visible ? "Скрыть характеристику" : "Показать характеристику"}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            visible ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
    <EditableSelect
      value={value}
      onChange={onChange}
      suggestions={suggestions}
      disabled={!visible || disabled}
      placeholder="—"
    />
  </div>
);

export default CharacteristicCard;
