import { useMemo, useState, useEffect, useRef } from "react";
import useApi from "../hooks/useApi";
import { getImageUrl, placeholderImage } from "../utils/image";
import { FaChevronLeft, FaChevronRight, FaPlay, FaPause } from "react-icons/fa";

const HeroSlider = ({ autoPlayInterval = 5000, showControls = true }) => {
  const { get } = useApi();
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const intervalRef = useRef(null);
  const videoRefs = useRef({});
  const startedAtRef = useRef(Date.now());
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(null);

  // Load slides from public API
  useEffect(() => {
    const fetchSlides = async () => {
      try {
        const response = await get("/public/hero-slides");
        // Extract data from response.data
        const data = Array.isArray(response?.data) ? response.data : [];
        setSlides(data);
      } catch (error) {
        console.error("Failed to load hero slides:", error);
        setSlides([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSlides();
  }, [get]);

  useEffect(() => {
    if (!slides.length) {
      if (currentIndex !== 0) setCurrentIndex(0);
      return;
    }
    if (currentIndex >= slides.length) {
      setCurrentIndex(0);
      startedAtRef.current = Date.now();
      setProgress(0);
    }
  }, [slides.length, currentIndex]);

  // Auto-play logic
  useEffect(() => {
    if (!isPlaying || slides.length <= 1) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    startedAtRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
      startedAtRef.current = Date.now();
    }, autoPlayInterval);

    const tick = () => {
      const elapsed = Date.now() - startedAtRef.current;
      const p = Math.min(1, elapsed / autoPlayInterval);
      setProgress(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, slides.length, autoPlayInterval]);

  // Handle video auto-play/pause based on current slide
  useEffect(() => {
    const currentSlide = slides[currentIndex];
    if (!currentSlide) return;

    // Pause all videos
    Object.values(videoRefs.current).forEach((video) => {
      if (video && typeof video.pause === "function") {
        video.pause();
      }
    });

    // Play current video if it's the first media item
    const currentVideo = videoRefs.current[`slide-${currentIndex}-video-0`];
    if (currentVideo && typeof currentVideo.play === "function") {
      currentVideo.play().catch(() => {
        // Auto-play might be blocked, that's fine
      });
    }
  }, [currentIndex, slides]);

  const handlePrev = () => {
    if (!slides.length) return;
    startedAtRef.current = Date.now();
    setProgress(0);
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNext = () => {
    if (!slides.length) return;
    startedAtRef.current = Date.now();
    setProgress(0);
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const handleDotClick = (index) => {
    startedAtRef.current = Date.now();
    setProgress(0);
    setCurrentIndex(index);
  };

  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  const setVideoRef = (slideIndex, mediaIndex, el) => {
    videoRefs.current[`slide-${slideIndex}-video-${mediaIndex}`] = el;
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  };

  const normalizedSlides = useMemo(() => {
    return (Array.isArray(slides) ? slides : []).map((slide) => {
      const mediaItems = Array.isArray(slide?.media) ? slide.media : [];
      const firstMedia = mediaItems.length > 0 ? mediaItems[0] : null;
      return {
        ...slide,
        _mediaItems: mediaItems,
        _firstMedia: firstMedia,
      };
    });
  }, [slides]);

  if (loading) {
    return (
      <div className="w-full h-96 md:h-[500px] bg-night-100 animate-pulse flex items-center justify-center">
        <div className="text-night-400">Загрузка...</div>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="w-full h-96 md:h-[500px] bg-gradient-to-r from-night-100 to-night-200 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-night-800 mb-2">Добро пожаловать</h2>
          <p className="text-night-600">Слайдеры появятся здесь после добавления в админке</p>
        </div>
      </div>
    );
  }

  const currentSlideData = normalizedSlides[currentIndex];

  const isVideo = (media) => {
    if (!media) return false;
    if (media.media_type === "video") return true;
    if (media.mime_type && media.mime_type.startsWith("video/")) return true;
    const url = String(media.url || "").toLowerCase();
    return url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".ogg") || url.endsWith(".mov");
  };

  return (
    <div className="relative w-full h-96 md:h-[500px] bg-night-900 overflow-hidden group">
      {/* Slides Track */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="h-full w-full flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {normalizedSlides.map((slide, idx) => {
            const firstMedia = slide?._firstMedia;
            return (
              <div key={slide?.id ?? idx} className="relative w-full h-full flex-shrink-0">
                {firstMedia ? (
                  isVideo(firstMedia) ? (
                    <video
                      ref={(el) => setVideoRef(idx, 0, el)}
                      src={getImageUrl(firstMedia.url)}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      loop
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  ) : (
                    <img
                      src={getImageUrl(firstMedia.url)}
                      alt={firstMedia.alt || slide.title || "Слайд"}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = placeholderImage;
                      }}
                    />
                  )
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-accent/10 to-accent/20" />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-night-950/70 via-night-950/40 to-night-950/10" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex items-center">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 text-white drop-shadow-lg">
              {currentSlideData.title || "Заголовок слайда"}
            </h1>
            {currentSlideData.description && (
              <p className="text-lg md:text-xl lg:text-2xl text-white drop-shadow-md">
                {currentSlideData.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Created date overlay */}
      {currentSlideData?.created_at && (
        <div className="absolute bottom-4 left-4 z-20 text-white/80 text-xs bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full">
          {formatDate(currentSlideData.created_at)}
        </div>
      )}

      {/* Navigation Controls */}
      {showControls && slides.length > 1 && (
        <>
          {/* Previous/Next buttons */}
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-3 rounded-full transition-all opacity-0 group-hover:opacity-100 z-30 pointer-events-auto"
            aria-label="Previous slide"
          >
            <FaChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-3 rounded-full transition-all opacity-0 group-hover:opacity-100 z-30 pointer-events-auto"
            aria-label="Next slide"
          >
            <FaChevronRight className="w-5 h-5" />
          </button>

          {/* Countdown ring */}
          <div className="absolute top-4 right-4 z-30 pointer-events-none">
            <svg width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" stroke="rgba(255,255,255,0.25)" strokeWidth="4" fill="none" />
              <circle
                cx="22"
                cy="22"
                r="18"
                stroke="rgba(255,255,255,0.9)"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 18}
                strokeDashoffset={(1 - progress) * 2 * Math.PI * 18}
                transform="rotate(-90 22 22)"
                style={{ transition: "stroke-dashoffset 50ms linear" }}
              />
            </svg>
          </div>

          {/* Play/Pause button */}
          <button
            onClick={togglePlayPause}
            className="absolute bottom-4 right-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-2 rounded-full transition-all opacity-0 group-hover:opacity-100 z-30 pointer-events-auto"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <FaPause className="w-4 h-4" /> : <FaPlay className="w-4 h-4" />}
          </button>

          {/* Dots indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? "bg-white w-8"
                    : "bg-white/50 hover:bg-white/70"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default HeroSlider;
