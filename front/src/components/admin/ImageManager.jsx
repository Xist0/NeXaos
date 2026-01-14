import { useState, useEffect, useCallback, useRef } from "react";
import useApi from "../../hooks/useApi";
import useLogger from "../../hooks/useLogger";
import useAuthStore from "../../store/authStore";
import SecureButton from "../ui/SecureButton";
import { FaSpinner, FaUpload, FaImage, FaCheckCircle, FaTrash } from "react-icons/fa";
import { API_BASE_URL } from "../../utils/constants";
import { getImageUrl } from "../../utils/image";

const ImageManager = ({ entityType, entityId, onUpdate, onPreviewUpdate }) => {
  const { get, del, post } = useApi();
  const logger = useLogger();

  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!entityId || entityId === "null") {
      setImages([]);
      return;
    }
    fetchImages();
  }, [entityId, entityType]);

  const fetchImages = useCallback(async () => {
    if (!entityId) {
      setImages([]);
      return;
    }
    setLoading(true);
    try {
      const response = await get(`/images/${entityType}/${entityId}`);
      setImages(Array.isArray(response?.data) ? response.data : []);
      if (response?.data?.[0]?.url) {
        onPreviewUpdate?.(response.data[0].url);
      }
    } catch (error) {
      logger.error("Ошибка загрузки изображений:", error?.message || error);
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, get, logger, onPreviewUpdate]);

  const handleUpload = async (event) => {
    if (!entityId) {
      logger.warn("Нет entityId для загрузки");
      return;
    }

    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const token = useAuthStore.getState().accessToken;
    if (!token) {
      logger.error("❌ Вы не авторизованы. Логин требуется.");
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
          formData.append("entityId", String(entityId));
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

          const data = await response.json();
          successCount++;
          logger.info(`✅ Загружено: ${file.name}`);
          setUploadProgress(((i + 1) / files.length) * 100);
        } catch (error) {
          logger.error(`❌ ${file.name}:`, error?.message || String(error));
        }
      }

      if (successCount > 0) {
        logger.info(`✅ ${successCount} файл(ов) загружено`);
        await fetchImages();
        onUpdate?.();
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
      await fetchImages();
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
      await fetchImages();
    } catch (error) {
      logger.error("❌ Ошибка установки превью:", error?.message || error);
    }
  };

  const getPreviewUrl = (url) => {
    if (!url) return "https://via.placeholder.com/300x200?text=Нет+изображения";
    return getImageUrl(url);
  };

  if (!entityId || entityId === "null") {
    return (
      <div className="border-4 border-dashed border-accent/50 bg-accent/5 rounded-3xl p-12 text-center">
        <FaImage className="w-20 h-20 text-accent/70 mx-auto mb-6" />
        <div className="text-xl font-bold text-night-900 mb-2">⏳ Модуль создаётся…</div>
        <div className="text-night-600 text-sm">Фото доступны после создания модуля</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
            {uploading ? `Загружаем… ${Math.round(uploadProgress)}%` : "Загрузить фото"}
          </div>
          <div className="text-sm text-night-600">
            PNG, JPG, WebP до 10MB | несколько файлов
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
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
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
                <img
                  src={getPreviewUrl(image.url)}
                  alt={image.alt || `Image ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />

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
                    {image.is_preview ? "Превью ✓" : "Выбрать"}
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
