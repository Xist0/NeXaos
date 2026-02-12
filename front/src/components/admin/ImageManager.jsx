import { useState, useEffect, useCallback, useRef } from "react";
import useApi from "../../hooks/useApi";
import useLogger from "../../hooks/useLogger";
import useAuthStore from "../../store/authStore";
import SecureButton from "../ui/SecureButton";
import { FaSpinner, FaUpload, FaImage, FaCheckCircle, FaTrash } from "react-icons/fa";
import { API_BASE_URL } from "../../utils/constants";
import { getImageUrl, getThumbUrl, placeholderImage } from "../../utils/image";

const ImageManager = ({
  entityType,
  entityId,
  onUpdate,
  onPreviewUpdate,
  onCreateTemp,
  onDeleteTemp,
  onMediaChange,
  fileInputId,
}) => {
  const { get, del, post } = useApi();
  const logger = useLogger();

  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!entityId || entityId === "null") {
      setImages([]);
      setInitialLoaded(true);
      return;
    }
    setInitialLoaded(false);
    fetchImages();
  }, [entityId, entityType]);

  const fetchImages = useCallback(async (overrideEntityId, { bypassCache = false } = {}) => {
    const effectiveEntityId = overrideEntityId ?? entityId;
    if (!effectiveEntityId) {
      setImages([]);
      onMediaChange?.(0);
      return;
    }
    setLoading(true);
    try {
      const params = bypassCache ? { _ts: Date.now() } : undefined;
      const response = await get(`/images/${entityType}/${effectiveEntityId}`, params);
      const nextImages = Array.isArray(response?.data) ? response.data : [];
      setImages(nextImages);
      onMediaChange?.(nextImages.length);
      if (response?.data?.[0]?.url) {
        onPreviewUpdate?.(response.data[0].url);
      }
    } catch (error) {
      logger.error("Ошибка загрузки изображений:", error?.message || error);
      setImages([]);
      onMediaChange?.(0);
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  }, [entityId, entityType, get, logger, onPreviewUpdate, onMediaChange]);

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const token = useAuthStore.getState().accessToken;
    if (!token) {
      logger.error("❌ Вы не авторизованы. Логин требуется.");
      return;
    }

    let actualEntityId = entityId;
    let tempCreatedHere = false;
    if (!actualEntityId && onCreateTemp) {
      const tempId = await onCreateTemp();
      if (tempId) {
        actualEntityId = tempId;
        tempCreatedHere = true;
      }
    }

    if (!actualEntityId) {
      logger.warn("Не удалось создать запись для загрузки медиа");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    let successCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("entityType", entityType);
          formData.append("entityId", String(actualEntityId));
          formData.append("alt", file.name.split(".")[0]);

          const response = await fetch(`${API_BASE_URL}/images`, {
            method: "POST",
            body: formData,
            credentials: "include",
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({
              message: `HTTP ${response.status}`
            }));
            throw new Error(errorData?.message || `HTTP ${response.status}`);
          }

          const _data = await response.json();
          successCount++;
          logger.info(`✅ Загружено: ${file.name}`);
          setUploadProgress(((i + 1) / files.length) * 100);
        } catch (error) {
          logger.error(`❌ ${file.name}:`, error?.message || String(error));
        }
      }

      if (successCount > 0) {
        logger.info(`✅ ${successCount} файл(ов) загружено`);
        await fetchImages(actualEntityId, { bypassCache: true });
        onUpdate?.();
      } else if (tempCreatedHere && onDeleteTemp) {
        await onDeleteTemp(actualEntityId);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (imageId) => {
    if (!confirm("Удалить изображение?")) return;

    try {
      await del(`/images/${imageId}`);
      logger.info("✅ Изображение удалено");
      await fetchImages(undefined, { bypassCache: true });
      onUpdate?.();
    } catch (error) {
      logger.error("❌ Ошибка удаления:", error?.message || error);
    }
  };

  const handleSetPreview = async (imageId) => {
    try {
      await post(`/images/${imageId}/set-preview`);
      logger.info("✅ Превью обновлено");
      const previewImage = images.find((img) => img.id === imageId);
      if (previewImage?.url) {
        onPreviewUpdate?.(previewImage.url);
      }
      await fetchImages(undefined, { bypassCache: true });
    } catch (error) {
      logger.error("❌ Ошибка установки превью:", error?.message || error);
    }
  };

  const getPreviewUrl = (url) => {
    if (!url) return placeholderImage;
    return getImageUrl(url);
  };

  const getGridThumbUrl = (url) => {
    if (!url) return placeholderImage;
    return getThumbUrl(url, { w: 420, h: 252, q: 70, fit: "cover" });
  };

  const isVideoMedia = (item) => {
    if (!item) return false;
    if (item.media_type && String(item.media_type).toLowerCase() === "video") return true;
    if (item.mime_type && String(item.mime_type).toLowerCase().startsWith("video/")) return true;
    const url = String(item.url || "").toLowerCase();
    return url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".ogg") || url.endsWith(".mov");
  };

  if (!initialLoaded && loading) {
    return (
      <div className="relative">
        <div className="absolute inset-0 z-[1000] rounded-3xl bg-white/60 backdrop-blur-sm" />
        <div className="relative z-[1001] glass-card p-16 text-center">
          <FaSpinner className="w-16 h-16 text-accent animate-spin mx-auto mb-8" />
          <div className="text-2xl font-bold text-night-900 mb-2">Загружаем фотографии</div>
          <div className="text-sm text-night-600">Пожалуйста, подождите…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {loading && (
        <div className="absolute inset-0 z-[1000] rounded-3xl bg-white/60 backdrop-blur-sm flex items-center justify-center">
          <div className="glass-card px-8 py-6 flex items-center gap-3">
            <FaSpinner className="w-6 h-6 text-accent animate-spin" />
            <span className="text-sm font-semibold text-night-800">Загрузка…</span>
          </div>
        </div>
      )}
      {/* Upload Zone */}
      <label className="block cursor-pointer group">
        <div
          className={`glass-card p-8 text-center border-4 border-dashed rounded-3xl transition-all ${
            uploading
              ? "border-yellow-400 bg-yellow-50/30"
              : "border-night-300 hover:border-accent hover:shadow-xl hover:scale-[1.02]"
          }`}
        >
          <FaUpload
            className={`w-14 h-14 mx-auto mb-4 transition-all ${
              uploading
                ? "text-yellow-500 animate-bounce"
                : "text-accent group-hover:scale-110"
            }`}
          />
          <div className="font-bold text-xl text-night-900 mb-1">
            {uploading ? `Загружаем… ${Math.round(uploadProgress)}%` : "Загрузить медиа"}
          </div>
          <div className="text-sm text-night-600">
            Фото и видео до 100MB | несколько файлов
            {!entityId && onCreateTemp ? " | запись будет создана автоматически" : ""}
          </div>

          {uploading && uploadProgress > 0 && (
            <div className="mt-4 h-2 bg-night-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent to-accent-dark transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          <input
            id={fileInputId}
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleUpload}
            disabled={uploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </label>

      {/* Images Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <FaSpinner className="w-10 h-10 text-accent animate-spin mr-3" />
          <span className="text-lg font-semibold">Загружаем фото…</span>
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-night-200 rounded-3xl bg-night-50/50">
          <FaImage className="w-16 h-16 mx-auto mb-4 text-night-400" />
          <p className="text-lg font-semibold text-night-900">Фото еще не загружены</p>
          <p className="text-sm text-night-600">Выберите файлы выше</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, idx) => (
            <div
              key={image.id}
              className={`glass-card overflow-hidden rounded-2xl transition-all cursor-pointer group ${
                image.is_preview
                  ? "ring-4 ring-accent/50 shadow-2xl scale-105 border border-accent"
                  : "hover:shadow-xl hover:scale-105"
              }`}
            >
              <div className="relative w-full h-36 overflow-hidden bg-night-100">
                {isVideoMedia(image) ? (
                  <video
                    src={getPreviewUrl(image.url)}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={getGridThumbUrl(image.url)}
                    alt={image.alt || `Image ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.target.src = placeholderImage;
                    }}
                  />
                )}

                <div className="absolute top-2 right-2 bg-night-900/80 text-white px-2 py-1 rounded text-xs font-bold backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  {idx + 1}
                </div>

                {image.is_preview && (
                  <div className="absolute top-2 left-2 bg-accent text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1 shadow-lg">
                    <FaCheckCircle className="w-3 h-3" /> Превью
                  </div>
                )}
              </div>

              <div className="p-3 space-y-2 bg-white">
                <div className="text-xs text-night-700 font-medium truncate">
                  {image.alt || "Изображение"}
                </div>

                <div className="flex gap-1">
                  <SecureButton
                    size="sm"
                    variant={image.is_preview ? "ghost" : "outline"}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!image.is_preview) handleSetPreview(image.id);
                    }}
                    className="flex-1 text-xs h-7 px-2"
                    disabled={image.is_preview}
                  >
                    {image.is_preview ? "Превью ✓" : "Превью"}
                  </SecureButton>
                  <SecureButton
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(image.id);
                    }}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                  >
                    <FaTrash className="w-3 h-3" />
                  </SecureButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageManager;
