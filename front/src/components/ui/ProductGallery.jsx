import { useCallback, useEffect, useRef, useState } from "react";
import ImageLightbox from "./ImageLightbox";
import { getImageUrl as defaultGetImageUrl } from "../../utils/image";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const ProductGallery = ({
  title,
  images = [],
  selectedIndex = 0,
  onSelect,
  onOpenSimilar,
  showSimilarButton = true,
  isNew = false,
  getImageUrl = defaultGetImageUrl,
  className = "",
}) => {
  const safeImages = Array.isArray(images) ? images : [];
  const hasMany = safeImages.length > 1;

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [showMobileArrows, setShowMobileArrows] = useState(false);
  const hideMobileArrowsTimerRef = useRef(null);
  const touchStartRef = useRef(null);
  const lastTapAtRef = useRef(0);

  const thumbsRef = useRef(null);
  const [thumbScroll, setThumbScroll] = useState({ top: 0, max: 0 });

  const [displayIndex, setDisplayIndex] = useState(clamp(Number(selectedIndex) || 0, 0, Math.max(0, safeImages.length - 1)));
  const [prevDisplayIndex, setPrevDisplayIndex] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const animTimerRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const next = clamp(Number(selectedIndex) || 0, 0, Math.max(0, safeImages.length - 1));
    if (!safeImages.length) return;
    if (next === displayIndex) return;

    // Schedule state updates asynchronously to avoid setState directly in effect body.
    queueMicrotask(() => {
      setPrevDisplayIndex(displayIndex);
      setDisplayIndex(next);
      // Start crossfade on next frame so opacity transition is visible
      setIsAnimating(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setIsAnimating(true);
        rafRef.current = null;
      });

      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      animTimerRef.current = setTimeout(() => {
        setIsAnimating(false);
        setPrevDisplayIndex(null);
        animTimerRef.current = null;
      }, 260);
    });
  }, [displayIndex, safeImages.length, selectedIndex]);

  const syncThumbScrollState = useCallback(() => {
    const el = thumbsRef.current;
    if (!el) return;
    setThumbScroll({
      top: el.scrollTop || 0,
      max: Math.max(0, (el.scrollHeight || 0) - (el.clientHeight || 0)),
    });
  }, []);

  useEffect(() => {
    let raf = requestAnimationFrame(() => {
      syncThumbScrollState();
    });
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [syncThumbScrollState, safeImages.length]);

  const scrollThumbsBy = useCallback((delta) => {
    const el = thumbsRef.current;
    if (!el) return;
    el.scrollBy({ top: delta, behavior: "smooth" });
    setTimeout(syncThumbScrollState, 50);
  }, [syncThumbScrollState]);

  const handlePrev = useCallback(() => {
    if (!hasMany) return;
    const next = selectedIndex > 0 ? selectedIndex - 1 : safeImages.length - 1;
    onSelect?.(next);
  }, [hasMany, onSelect, safeImages.length, selectedIndex]);

  const handleNext = useCallback(() => {
    if (!hasMany) return;
    const next = selectedIndex < safeImages.length - 1 ? selectedIndex + 1 : 0;
    onSelect?.(next);
  }, [hasMany, onSelect, safeImages.length, selectedIndex]);

  const openLightbox = useCallback(() => {
    if (!safeImages.length) return;
    setLightboxIndex(clamp(Number(selectedIndex) || 0, 0, safeImages.length - 1));
    setLightboxOpen(true);
  }, [safeImages.length, selectedIndex]);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  useEffect(() => {
    return () => {
      if (hideMobileArrowsTimerRef.current) {
        clearTimeout(hideMobileArrowsTimerRef.current);
        hideMobileArrowsTimerRef.current = null;
      }
      if (animTimerRef.current) {
        clearTimeout(animTimerRef.current);
        animTimerRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const revealMobileArrows = useCallback(() => {
    setShowMobileArrows(true);
    if (hideMobileArrowsTimerRef.current) clearTimeout(hideMobileArrowsTimerRef.current);
    hideMobileArrowsTimerRef.current = setTimeout(() => {
      setShowMobileArrows(false);
    }, 2500);
  }, []);

  const thumbControlBtnClass =
    "rounded-full p-2 text-night-800 drop-shadow-[0_2px_10px_rgba(255,255,255,0.75)] " +
    "bg-transparent hover:bg-black/5 active:bg-black/10 transition";

  const mainControlBtnClass =
    "rounded-full p-2 text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.65)] " +
    "bg-black/25 hover:bg-black/35 active:bg-black/45 transition";

  return (
    <div className={`w-full ${className}`}>
      <div className={`grid gap-3 sm:gap-4 ${hasMany ? "lg:grid-cols-[48px_1fr]" : "lg:grid-cols-1"} lg:items-start`}>
        {/* Thumbnails (desktop only) */}
        {hasMany && (
          <div className="hidden lg:block relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                scrollThumbsBy(-240);
              }}
              disabled={thumbScroll.top <= 0}
              className={`absolute left-1/2 -translate-x-1/2 top-2 z-10 ${thumbControlBtnClass} disabled:opacity-40 disabled:cursor-not-allowed`}
              aria-label="Прокрутить вверх"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 15l-6-6-6 6" />
              </svg>
            </button>

            <div
              ref={thumbsRef}
              onScroll={syncThumbScrollState}
              className="h-full max-h-[667px] overflow-y-auto space-y-2 pt-10 pb-10"
            >
              {safeImages.map((img, index) => (
                <button
                  key={img.id || index}
                  type="button"
                  onClick={() => onSelect?.(index)}
                  className={`w-12 mx-auto rounded-xl overflow-hidden border-2 transition-all bg-white ${
                    Number(selectedIndex) === index
                      ? "border-accent shadow-md ring-2 ring-accent/40"
                      : "border-night-200 hover:border-night-300"
                  }`}
                >
                  <div className="w-12 h-16 bg-night-50">
                    <img
                      src={getImageUrl(img.url)}
                      alt={`${title || ""} ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                scrollThumbsBy(240);
              }}
              disabled={thumbScroll.top >= thumbScroll.max}
              className={`absolute left-1/2 -translate-x-1/2 bottom-2 z-10 ${thumbControlBtnClass} disabled:opacity-40 disabled:cursor-not-allowed`}
              aria-label="Прокрутить вниз"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        )}

        {/* Main image */}
        <div className="min-w-0 sm:flex sm:justify-center">
          <div
            className={
              "relative aspect-[500/667] overflow-hidden group " +
              "bg-night-50 " +
              "border-0 sm:border sm:border-night-200 " +
              "rounded-none sm:rounded-2xl " +
              "shadow-none sm:shadow-lg " +
              "w-screen left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 " +
              "sm:w-full sm:max-w-[500px] lg:max-w-[500px]"
            }
          >
            {showSimilarButton && typeof onOpenSimilar === "function" && (
              <button
                type="button"
                onClick={onOpenSimilar}
                className="absolute right-3 top-3 sm:right-4 sm:top-4 z-20 rounded-full bg-white/90 hover:bg-white shadow-lg px-4 py-2 text-xs font-semibold text-night-700 hover:text-accent transition"
              >
                Похожие
              </button>
            )}

            {isNew && (
              <span className="absolute left-3 top-3 sm:left-4 sm:top-4 z-20 bg-gradient-to-r from-accent to-accent-dark/90 text-white px-3 py-1.5 text-xs font-bold rounded-full shadow-lg">
                Новинка
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                // Mobile: first tap => show arrows, second tap => open lightbox
                let isMobile = false;
                try {
                  isMobile = window.matchMedia && window.matchMedia("(max-width: 639px)").matches;
                } catch {
                  isMobile = false;
                }

                if (!isMobile) {
                  openLightbox();
                  return;
                }

                const now = Date.now();
                const delta = now - (lastTapAtRef.current || 0);
                lastTapAtRef.current = now;

                if (delta > 0 && delta < 320) {
                  openLightbox();
                } else {
                  revealMobileArrows();
                }
              }}
              onTouchStart={(e) => {
                const t = e.touches?.[0];
                if (!t) return;
                touchStartRef.current = { x: t.clientX, y: t.clientY, at: Date.now() };
              }}
              onTouchEnd={(e) => {
                const start = touchStartRef.current;
                touchStartRef.current = null;
                const t = e.changedTouches?.[0];
                if (!start || !t) return;
                const dx = t.clientX - start.x;
                const dy = t.clientY - start.y;
                const dt = Date.now() - start.at;
                if (dt > 600) return;
                if (Math.abs(dx) < 35 || Math.abs(dx) < Math.abs(dy)) return;
                if (dx < 0) handleNext();
                else handlePrev();
              }}
              className="block w-full h-full"
            >
              {safeImages.length ? (
                <div className="relative w-full h-full">
                  {prevDisplayIndex !== null && safeImages[prevDisplayIndex] && (
                    <img
                      src={getImageUrl(safeImages[prevDisplayIndex].url)}
                      alt={title}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-out ${
                        isAnimating ? "opacity-0" : "opacity-100"
                      }`}
                      loading="eager"
                      draggable={false}
                    />
                  )}
                  {safeImages[displayIndex] && (
                    <img
                      src={getImageUrl(safeImages[displayIndex].url)}
                      alt={title}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-out ${
                        prevDisplayIndex !== null ? (isAnimating ? "opacity-100" : "opacity-0") : "opacity-100"
                      }`}
                      loading="eager"
                      draggable={false}
                    />
                  )}
                </div>
              ) : (
                <div className="w-full h-full bg-night-50" />
              )}
            </button>

            {hasMany && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 z-20 ${mainControlBtnClass} ${
                    showMobileArrows ? "opacity-100" : "opacity-0 sm:opacity-0 sm:group-hover:opacity-100"
                  }`}
                  aria-label="Предыдущее"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 z-20 ${mainControlBtnClass} ${
                    showMobileArrows ? "opacity-100" : "opacity-0 sm:opacity-0 sm:group-hover:opacity-100"
                  }`}
                  aria-label="Следующее"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Thumbnails (mobile hidden as requested) */}
        </div>
      </div>

      {lightboxOpen && (
        <ImageLightbox
          images={safeImages}
          startIndex={lightboxIndex}
          onClose={closeLightbox}
          getImageUrl={getImageUrl}
        />
      )}
    </div>
  );
};

export default ProductGallery;
