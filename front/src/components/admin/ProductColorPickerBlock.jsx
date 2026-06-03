import { useEffect, useRef, useState } from "react";
import ColorBadge from "../ui/ColorBadge";
import { getThumbUrl } from "../../utils/image";

const LazyImg = ({ src, alt, className }) => {
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
      {isVisible ? (
        <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />
      ) : null}
    </span>
  );
};

const ColorOptionList = ({ title, colors, selectedId, onSelect, selectedClassName }) => (
  <>
    <div className="text-xs font-semibold text-night-500 uppercase tracking-wide px-1">{title}</div>
    <div className="space-y-1">
      {colors.map((c) => {
        const isSelected = Number(selectedId) === Number(c.id);
        return (
          <button
            key={`color-opt-${c.id}`}
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

const ProductColorPickerBlock = ({
  colors = [],
  primaryColorId = "",
  secondaryColorId = "",
  onPrimaryChange,
  onSecondaryChange,
  pickerRef,
}) => {
  const [openPrimary, setOpenPrimary] = useState(false);
  const [openSecondary, setOpenSecondary] = useState(false);
  const internalRef = useRef(null);
  const colorPickerRef = pickerRef || internalRef;

  const colorsByType = {
    facade: colors.filter((c) => c?.type === "facade"),
    corpus: colors.filter((c) => c?.type === "corpus"),
    universal: colors.filter((c) => !c?.type),
  };

  const selectedPrimary = colors.find((c) => Number(c.id) === Number(primaryColorId));
  const selectedSecondary = colors.find((c) => Number(c.id) === Number(secondaryColorId));

  useEffect(() => {
    if (!openPrimary && !openSecondary) return;
    const onPointerDown = (e) => {
      const root = colorPickerRef.current;
      if (!root) return;
      if (root.contains(e.target)) return;
      setOpenPrimary(false);
      setOpenSecondary(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [colorPickerRef, openPrimary, openSecondary]);

  return (
    <div className="space-y-3" ref={colorPickerRef}>
      <h3 className="text-base font-bold text-night-900 border-b border-night-200 pb-2">Цвет</h3>
      <div className="relative py-2">
        <div className="border-t border-night-200" />
        <span className="absolute -top-2 left-3 px-2 text-xs text-night-500 bg-white/70">Выбор цвета</span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-xs font-semibold text-night-700">Основной цвет</div>
          <button
            type="button"
            onClick={() => {
              setOpenPrimary((v) => !v);
              setOpenSecondary(false);
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-night-200 bg-white hover:border-accent transition"
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
          {openPrimary ? (
            <div className="relative">
              <div className="absolute z-[1000] top-full mt-1 w-full rounded-xl border border-night-200 bg-white shadow-xl max-h-80 overflow-auto">
                <div className="p-2 space-y-2">
                  <ColorOptionList
                    title="Основные цвета"
                    colors={colorsByType.facade}
                    selectedId={primaryColorId}
                    onSelect={(id) => {
                      onPrimaryChange?.(id);
                      setOpenPrimary(false);
                    }}
                    selectedClassName="border-accent bg-accent/5"
                  />
                  <div className="my-2 border-t border-night-200" />
                  <ColorOptionList
                    title="Универсальные цвета"
                    colors={colorsByType.universal}
                    selectedId={primaryColorId}
                    onSelect={(id) => {
                      onPrimaryChange?.(id);
                      setOpenPrimary(false);
                    }}
                    selectedClassName="border-accent bg-accent/5"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-night-700">Доп. цвет</div>
          <button
            type="button"
            onClick={() => {
              setOpenSecondary((v) => !v);
              setOpenPrimary(false);
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-night-200 bg-white hover:border-accent transition"
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
          {openSecondary ? (
            <div className="relative">
              <div className="absolute z-[1000] top-full mt-1 w-full rounded-xl border border-night-200 bg-white shadow-xl max-h-80 overflow-auto">
                <div className="p-2 space-y-2">
                  <ColorOptionList
                    title="Доп. цвета"
                    colors={colorsByType.corpus}
                    selectedId={secondaryColorId}
                    onSelect={(id) => {
                      onSecondaryChange?.(id);
                      setOpenSecondary(false);
                    }}
                    selectedClassName="border-green-500 bg-green-50"
                  />
                  <div className="my-2 border-t border-night-200" />
                  <ColorOptionList
                    title="Универсальные цвета"
                    colors={colorsByType.universal}
                    selectedId={secondaryColorId}
                    onSelect={(id) => {
                      onSecondaryChange?.(id);
                      setOpenSecondary(false);
                    }}
                    selectedClassName="border-green-500 bg-green-50"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ProductColorPickerBlock;
