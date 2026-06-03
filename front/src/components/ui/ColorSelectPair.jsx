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
 * Пара склеенных селектов цветов (основной + доп.) без разрыва и скруглений на стыке.
 * Используется в формах создания товаров.
 */
const ColorSelectPair = ({
  colors = [],
  primaryColorId,
  secondaryColorId,
  onPrimaryChange,
  onSecondaryChange,
  label = "Выбор цвета",
  ref: externalRef,
}) => {
  const [openPrimary, setOpenPrimary] = useState(false);
  const [openSecondary, setOpenSecondary] = useState(false);
  const internalRef = useRef(null);
  const rootRef = externalRef || internalRef;

  const facadeColors = colors.filter((c) => c?.type === "facade");
  const corpusColors = colors.filter((c) => c?.type === "corpus");
  const universalColors = colors.filter((c) => !c?.type);

  const selectedPrimary = colors.find((c) => Number(c.id) === Number(primaryColorId));
  const selectedSecondary = colors.find((c) => Number(c.id) === Number(secondaryColorId));

  useEffect(() => {
    if (!openPrimary && !openSecondary) return;
    const onPointerDown = (e) => {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(e.target)) return;
      setOpenPrimary(false);
      setOpenSecondary(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [openPrimary, openSecondary, rootRef]);

  return (
    <div className="space-y-3" ref={rootRef}>
      <h3 className="text-base font-bold text-night-900 border-b border-night-200 pb-2">
        {label}
      </h3>

      <div className="grid gap-0 md:grid-cols-2">
        {/* Основной цвет */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-night-700">Основной цвет</div>
          <button
            type="button"
            onClick={() => {
              setOpenPrimary((v) => !v);
              setOpenSecondary(false);
            }}
            className="w-full flex items-center justify-between px-3 py-2 border border-night-200 bg-white hover:border-accent transition h-10 rounded-t-xl rounded-b-none"
          >
            <span className="flex items-center gap-2">
              {selectedPrimary ? (
                <ColorBadge colorData={selectedPrimary} />
              ) : (
                <span className="text-xs text-night-500">Выберите цвет</span>
              )}
            </span>
            <span className="text-night-400">▾</span>
          </button>
          {openPrimary && (
            <div className="relative">
              <div className="absolute z-[1000] top-full mt-1 w-full rounded-b-xl border border-t-0 border-night-200 bg-white shadow-xl max-h-80 overflow-auto">
                <div className="p-2 space-y-2">
                  <ColorGroup
                    title="Основные цвета"
                    colors={facadeColors}
                    selectedId={primaryColorId}
                    onSelect={(id) => {
                      onPrimaryChange?.(id);
                      setOpenPrimary(false);
                    }}
                    selectedClassName="border-accent bg-accent/5"
                  />
                  <ColorGroup
                    title="Универсальные цвета"
                    colors={universalColors}
                    selectedId={primaryColorId}
                    onSelect={(id) => {
                      onPrimaryChange?.(id);
                      setOpenPrimary(false);
                    }}
                    selectedClassName="border-accent bg-accent/5"
                    divider
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Доп. цвет — склеен с основным */}
        <div className="space-y-2 md:border-l-0">
          <div className="text-xs font-semibold text-night-700">Доп. цвет</div>
          <button
            type="button"
            onClick={() => {
              setOpenSecondary((v) => !v);
              setOpenPrimary(false);
            }}
            className="w-full flex items-center justify-between px-3 py-2 border border-night-200 bg-white hover:border-accent transition h-10 rounded-t-xl rounded-b-none"
          >
            <span className="flex items-center gap-2">
              {selectedSecondary ? (
                <ColorBadge colorData={selectedSecondary} />
              ) : (
                <span className="text-xs text-night-500">Выберите цвет</span>
              )}
            </span>
            <span className="text-night-400">▾</span>
          </button>
          {openSecondary && (
            <div className="relative">
              <div className="absolute z-[1000] top-full mt-1 w-full rounded-b-xl border border-t-0 border-night-200 bg-white shadow-xl max-h-80 overflow-auto">
                <div className="p-2 space-y-2">
                  <ColorGroup
                    title="Доп. цвета"
                    colors={corpusColors}
                    selectedId={secondaryColorId}
                    onSelect={(id) => {
                      onSecondaryChange?.(id);
                      setOpenSecondary(false);
                    }}
                    selectedClassName="border-green-500 bg-green-50"
                  />
                  <ColorGroup
                    title="Универсальные цвета"
                    colors={universalColors}
                    selectedId={secondaryColorId}
                    onSelect={(id) => {
                      onSecondaryChange?.(id);
                      setOpenSecondary(false);
                    }}
                    selectedClassName="border-green-500 bg-green-50"
                    divider
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ColorSelectPair;
