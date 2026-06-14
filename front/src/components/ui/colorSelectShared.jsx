import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { getThumbUrl } from "../../utils/image";

export const LazyImg = ({ src, alt, className, crossOrigin = "anonymous" }) => {
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

export const ColorGroup = ({
  title,
  colors = [],
  selectedId,
  onSelect,
  selectedClassName = "border-accent bg-accent/5",
  divider = false,
  keyPrefix = "color",
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
              key={`${keyPrefix}-${c.id}`}
              type="button"
              onClick={() => onSelect(String(c.id))}
              className={clsx(
                "w-full flex items-center gap-2 p-2 rounded-lg border transition text-left",
                isSelected ? selectedClassName : "border-night-200 hover:border-accent"
              )}
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

export const ColorSelectTrigger = ({ open, onClick, placeholder = "Выберите цвет", selectedColor, disabled = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={clsx(
      "w-full flex items-center justify-between gap-3 border border-night-200 bg-white text-night-900 h-10 px-3 py-2 text-sm",
      "focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors",
      disabled ? "opacity-60 cursor-not-allowed" : "hover:border-night-400",
      open ? "rounded-t-xl rounded-b-none" : "rounded-xl"
    )}
  >
    {selectedColor ? (
      <span className="min-w-0 flex-1 truncate text-left flex items-center gap-2">
        <LazyImg
          src={getThumbUrl(selectedColor.image_url, { w: 48, h: 48, q: 70, fit: "cover" })}
          alt={selectedColor.name}
          className="h-5 w-5 rounded object-cover border border-night-200 flex-shrink-0"
        />
        <span className="truncate text-night-900">{selectedColor.name}</span>
      </span>
    ) : (
      <span className="min-w-0 flex-1 truncate text-left text-night-500">{placeholder}</span>
    )}
    <span className="text-night-400 shrink-0 text-sm">▾</span>
  </button>
);

export const ColorSelectPopover = ({ open, children }) => {
  if (!open) return null;
  return (
    <div className="absolute z-50 top-full left-0 right-0 w-full mt-0">
      <div className="border border-t-0 border-night-200 bg-white shadow-xl overflow-auto max-h-80 rounded-b-xl">
        <div className="p-2 space-y-2">{children}</div>
      </div>
    </div>
  );
};
