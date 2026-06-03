import { useEffect, useRef, useState } from "react";
import ColorBadge from "./ColorBadge";
import { getThumbUrl } from "../../utils/image";

const LazyImg = ({ src, alt, className, crossOrigin = "anonymous" }) => {
  const holderRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) return;
    const el = holderRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setIsVisible(true));
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setIsVisible(true);
          obs.disconnect();
        }
      },
      { root: null, rootMargin: "50px", threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [isVisible]);

  return (
    <span ref={holderRef} className={className}>
      {isVisible && (
        <img
          src={src}
          alt={alt}
          className={className}
          crossOrigin={crossOrigin}
          loading="lazy"
          decoding="async"
        />
      )}
    </span>
  );
};

/**
 * Группа цветов внутри выпадающего списка.
 */
const ColorGroup = ({
  title,
  colors = [],
  selectedId,
  onSelect,
  selectedClassName = "border-accent bg-accent/5",
  divider = false,
}) => {
  if (!colors || colors.length === 0) return null;

  return (
    <>
      {divider && <div className="my-2 border-t border-night-200" />}
      {title && (
        <div className="text-xs font-semibold text-night-500 uppercase tracking-wide px-1">
          {title}
        </div>
      )}
      <div className="space-y-1">
        {colors.map((c) => {
          const isSelected = Number(selectedId) === Number(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(String(c.id))}
              className={`w-full flex items-center gap-2 p-2 rounded-lg border transition ${
                isSelected ? selectedClassName : "border-night-200 hover:border-accent"
              }`}
            >
              <LazyImg
                src={getThumbUrl(c.image_url, { w: 64, h: 64, q: 65, fit: "cover" })}
                alt={c.name}
                className="h-8 w-8 rounded object-cover border border-night-200 flex-shrink-0"
              />
              <span className="text-xs text-night-700 truncate">{c.name}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};

/**
 * Кнопка-триггер для выбора цвета.
 */
const ColorTrigger = ({
  selectedColor,
  placeholder = "Выберите цвет",
  onClick,
  open,
  className = "",
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center justify-between px-3 py-2 border border-night-200 bg-white hover:border-accent transition h-10 ${className}`}
  >
    <span className="flex items-center gap-2">
      {selectedColor ? (
        <ColorBadge colorData={selectedColor} />
      ) : (
        <span className="text-xs text-night-500">{placeholder}</span>
      )}
    </span>
    <span className="text-night-400">▾</span>
  </button>
);

/**
 * Глобальный компонент — кастомный выпадающий список выбора цвета с картинками.
 * Заменяет 4+ дублирующихся реализации.
 *
 * @param {object} props
 * @param {Array} props.colors — массив всех цветов
 * @param {string|number} [props.value] — выбранный color id
 * @param {function} props.onChange — (id) => void
 * @param {string} [props.label] — текст над селектом
 * @param {string} [props.placeholder] — placeholder для пустого значения
 * @param {Array} [props.facadeColors] — цвета для фасадов (основные)
 * @param {Array} [props.corpusColors] — цвета для корпуса (доп.)
 * @param {Array} [props.universalColors] — универсальные цвета
 * @param {string} [props.facadeTitle="Основные цвета"]
 * @param {string} [props.corpusTitle="Доп. цвета"]
 * @param {string} [props.universalTitle="Универсальные цвета"]
 * @param {boolean} [props.showFacade=true]
 * @param {boolean} [props.showCorpus=false]
 * @param {boolean} [props.showUniversal=true]
 * @param {string} [props.selectedClassName] — стили для выбранного элемента
 * @param {object} [props.ref] — external ref для закрытия по клику снаружи
 */
const ColorSelectDropdown = ({
  colors = [],
  value,
  onChange,
  label,
  placeholder = "Выберите цвет",
  facadeColors,
  corpusColors,
  universalColors,
  facadeTitle = "Основные цвета",
  corpusTitle = "Доп. цвета",
  universalTitle = "Универсальные цвета",
  showFacade = true,
  showCorpus = false,
  showUniversal = true,
  selectedClassName = "border-accent bg-accent/5",
  className = "",
  ref: externalRef,
}) => {
  const [open, setOpen] = useState(false);
  const internalRef = useRef(null);
  const rootRef = externalRef || internalRef;

  // Если не переданы отдельные массивы, извлекаем из colors
  const effectiveFacade = facadeColors ?? colors.filter((c) => c?.type === "facade");
  const effectiveCorpus = corpusColors ?? colors.filter((c) => c?.type === "corpus");
  const effectiveUniversal = universalColors ?? colors.filter((c) => !c?.type);

  const selectedColor = colors.find((c) => Number(c.id) === Number(value));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open, rootRef]);

  return (
    <div className={`space-y-2 ${className}`} ref={rootRef}>
      {label && (
        <div className="text-xs font-semibold text-night-700">{label}</div>
      )}

      <ColorTrigger
        selectedColor={selectedColor}
        placeholder={placeholder}
        onClick={() => setOpen((v) => !v)}
        open={open}
      />

      {open && (
        <div className="relative">
          <div className="absolute z-[1000] top-full mt-1 w-full rounded-b-xl border border-t-0 border-night-200 bg-white shadow-xl max-h-80 overflow-auto">
            <div className="p-2 space-y-2">
              {showFacade && (
                <ColorGroup
                  title={facadeTitle}
                  colors={effectiveFacade}
                  selectedId={value}
                  onSelect={(id) => {
                    onChange?.(id);
                    setOpen(false);
                  }}
                  selectedClassName={selectedClassName}
                />
              )}
              {showCorpus && (
                <ColorGroup
                  title={corpusTitle}
                  colors={effectiveCorpus}
                  selectedId={value}
                  onSelect={(id) => {
                    onChange?.(id);
                    setOpen(false);
                  }}
                  selectedClassName={selectedClassName}
                  divider
                />
              )}
              {showUniversal && effectiveUniversal.length > 0 && (
                <ColorGroup
                  title={universalTitle}
                  colors={effectiveUniversal}
                  selectedId={value}
                  onSelect={(id) => {
                    onChange?.(id);
                    setOpen(false);
                  }}
                  selectedClassName={selectedClassName}
                  divider
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorSelectDropdown;
