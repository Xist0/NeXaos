import { useState, useEffect } from "react";
import useApi from "../hooks/useApi";
import { getImageUrl, placeholderImage } from "../utils/image";
import { FaPlay, FaTimes, FaChevronLeft, FaChevronRight } from "react-icons/fa";

const WorksPage = () => {
  const { get } = useApi();
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWork, setSelectedWork] = useState(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  // Load works from public API
  useEffect(() => {
    const fetchWorks = async () => {
      try {
        const response = await get("/public/works");
        const data = Array.isArray(response?.data) ? response.data : [];
        setWorks(data);
      } catch (error) {
        console.error("Failed to load works:", error);
        setWorks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWorks();
  }, [get]);

  const isVideo = (media) => {
    if (!media) return false;
    if (media.media_type === "video") return true;
    if (media.mime_type && media.mime_type.startsWith("video/")) return true;
    const url = String(media.url || "").toLowerCase();
    return url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".ogg") || url.endsWith(".mov");
  };

  const getPreviewMedia = (work) => {
    if (!work?.media || !Array.isArray(work.media)) return null;
    // First try to find media marked as preview
    const preview = work.media.find(m => m.is_preview);
    if (preview) return preview;
    // Fallback to first media
    return work.media[0];
  };

  const openModal = (work, mediaIndex = 0) => {
    setSelectedWork(work);
    setSelectedMediaIndex(mediaIndex);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setTimeout(() => {
      setSelectedWork(null);
      setSelectedMediaIndex(0);
    }, 300);
  };

  const navigateMedia = (direction) => {
    if (!selectedWork?.media) return;
    const media = selectedWork.media;
    if (direction === "prev") {
      setSelectedMediaIndex((prev) => (prev - 1 + media.length) % media.length);
    } else {
      setSelectedMediaIndex((prev) => (prev + 1) % media.length);
    }
  };

  const currentMedia = selectedWork?.media?.[selectedMediaIndex];

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="animate-pulse">
          <div className="h-8 bg-night-200 rounded w-1/3 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-night-100 rounded-lg h-64"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <header className="mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-night-900 mb-4">Наши работы</h1>
        <p className="text-lg text-night-600">
          Примеры реализованных проектов. Нажмите на работу, чтобы посмотреть фото и видео.
        </p>
      </header>

      {works.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-night-400 text-lg mb-2">Работы пока не добавлены</div>
          <p className="text-night-500">Скоро здесь появятся примеры наших проектов</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {works.map((work) => {
            const mediaItems = Array.isArray(work.media) ? work.media : [];
            const previewMedia = getPreviewMedia(work);
            const hasVideo = mediaItems.some(isVideo);

            return (
              <div
                key={work.id}
                className="group cursor-pointer"
                onClick={() => openModal(work, 0)}
              >
                <div className="relative overflow-hidden rounded-lg bg-night-100 aspect-[4/3] mb-4">
                  {previewMedia ? (
                    isVideo(previewMedia) ? (
                      <video
                        src={getImageUrl(previewMedia.url)}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        muted
                        playsInline
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      <img
                        src={getImageUrl(previewMedia.url)}
                        alt={previewMedia.alt || work.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.target.src = placeholderImage;
                        }}
                      />
                    )
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-accent/20 to-accent/40" />
                  )}

                  {/* Preview badge */}
                  {previewMedia?.is_preview && (
                    <div className="absolute top-3 left-3 bg-accent text-white text-xs px-2 py-1 rounded font-semibold">
                      Превью
                    </div>
                  )}

                  {/* Video indicator */}
                  {hasVideo && (
                    <div className="absolute top-3 right-3 bg-accent text-white p-2 rounded-full">
                      <FaPlay className="w-3 h-3" />
                    </div>
                  )}

                  {/* Multiple items indicator */}
                  {mediaItems.length > 1 && (
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      {mediaItems.length} {mediaItems.length === 1 ? "медиа" : mediaItems.length < 5 ? "медиа" : "медиа"}
                    </div>
                  )}

                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-night-900 mb-2 group-hover:text-accent transition-colors">
                    {work.title}
                  </h3>
                  {work.description && (
                    <p className="text-night-600 line-clamp-2">{work.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && selectedWork && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="relative max-w-6xl max-h-[90vh] w-full bg-white rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 z-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-2 rounded-full transition-all"
              aria-label="Close"
            >
              <FaTimes className="w-5 h-5" />
            </button>

            {/* Navigation */}
            {selectedWork.media && selectedWork.media.length > 1 && (
              <>
                <button
                  onClick={() => navigateMedia("prev")}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-3 rounded-full transition-all"
                  aria-label="Previous"
                >
                  <FaChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navigateMedia("next")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-3 rounded-full transition-all"
                  aria-label="Next"
                >
                  <FaChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Media content */}
            <div className="flex flex-col lg:flex-row max-h-[90vh]">
              {/* Media viewer */}
              <div className="flex-1 bg-black flex items-center justify-center min-h-[400px]">
                {currentMedia ? (
                  isVideo(currentMedia) ? (
                    <video
                      src={getImageUrl(currentMedia.url)}
                      className="max-w-full max-h-[70vh] object-contain"
                      controls
                      autoPlay
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  ) : (
                    <img
                      src={getImageUrl(currentMedia.url)}
                      alt={currentMedia.alt || selectedWork.title}
                      className="max-w-full max-h-[70vh] object-contain"
                      onError={(e) => {
                        e.target.src = placeholderImage;
                      }}
                    />
                  )
                ) : (
                  <div className="text-white text-center">
                    <div className="text-lg mb-2">Нет медиа</div>
                    <div className="text-sm opacity-70">Попробуйте выбрать другой элемент</div>
                  </div>
                )}
              </div>

              {/* Sidebar with info and thumbnails */}
              <div className="w-full lg:w-80 bg-white p-6 overflow-y-auto">
                <h2 className="text-2xl font-bold text-night-900 mb-4">{selectedWork.title}</h2>
                {selectedWork.description && (
                  <p className="text-night-600 mb-6">{selectedWork.description}</p>
                )}

                {/* Thumbnails */}
                {selectedWork.media && selectedWork.media.length > 1 && (
                  <div>
                    <h3 className="text-sm font-semibold text-night-700 mb-3">Все медиа ({selectedWork.media.length})</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedWork.media.map((media, index) => (
                        <button
                          key={media.id}
                          onClick={() => setSelectedMediaIndex(index)}
                          className={`relative aspect-[4/3] rounded overflow-hidden border-2 transition-all ${
                            index === selectedMediaIndex
                              ? "border-accent scale-105"
                              : "border-transparent hover:border-night-300"
                          }`}
                        >
                          {isVideo(media) ? (
                            <>
                              <video
                                src={getImageUrl(media.url)}
                                className="w-full h-full object-cover"
                                muted
                                onError={(e) => {
                                  e.target.style.display = "none";
                                }}
                              />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <FaPlay className="w-4 h-4 text-white" />
                              </div>
                            </>
                          ) : (
                            <img
                              src={getImageUrl(media.url)}
                              alt={media.alt || `${selectedWork.title} ${index + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src = placeholderImage;
                              }}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorksPage;
