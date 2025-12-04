import { useState, useEffect } from "react";
import useApi from "../../hooks/useApi";
import useLogger from "../../hooks/useLogger";
import SecureButton from "../ui/SecureButton";

const ImageManager = ({ entityType, entityId, onUpdate }) => {
  const { get, post, del, put } = useApi();
  const logger = useLogger();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (entityId) {
      fetchImages();
    }
  }, [entityId, entityType]);

  const fetchImages = async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const response = await get(`/images/${entityType}/${entityId}`);
      setImages(response?.data || []);
    } catch (error) {
      logger.error("Не удалось загрузить изображения", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !entityId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);

      await post("/images/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      logger.info("Изображение загружено");
      await fetchImages();
      onUpdate?.();
    } catch (error) {
      logger.error("Не удалось загрузить изображение", error);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDelete = async (imageId) => {
    if (!confirm("Удалить это изображение?")) return;

    try {
      await del(`/images/${imageId}`);
      logger.info("Изображение удалено");
      await fetchImages();
      onUpdate?.();
    } catch (error) {
      logger.error("Не удалось удалить изображение", error);
    }
  };

  const handleSetPreview = async (imageId) => {
    try {
      await put(`/images/${imageId}/preview`);
      logger.info("Превью установлено");
      await fetchImages();
      onUpdate?.();
    } catch (error) {
      logger.error("Не удалось установить превью", error);
    }
  };

  const handleReorder = async (newOrder) => {
    try {
      await put("/images/reorder", { imageIds: newOrder });
      logger.info("Порядок изображений обновлен");
      await fetchImages();
      onUpdate?.();
    } catch (error) {
      logger.error("Не удалось изменить порядок", error);
    }
  };

  const moveImage = (index, direction) => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === images.length - 1)
    ) {
      return;
    }

    const newImages = [...images];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];

    const newOrder = newImages.map((img) => img.id);
    handleReorder(newOrder);
  };

  if (!entityId) {
    return (
      <div className="text-sm text-night-500 p-4 border border-night-200 rounded">
        Сохраните запись, чтобы добавить изображения
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-night-900">Изображения</h3>
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
          <SecureButton
            type="button"
            variant="outline"
            disabled={uploading}
            className="text-xs px-3 py-1"
          >
            {uploading ? "Загрузка..." : "+ Добавить"}
          </SecureButton>
        </label>
      </div>

      {loading ? (
        <div className="text-sm text-night-500">Загрузка...</div>
      ) : images.length === 0 ? (
        <div className="text-sm text-night-500 p-4 border border-night-200 rounded">
          Изображений пока нет
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((img, index) => (
            <div
              key={img.id}
              className={`relative border-2 rounded-lg overflow-hidden ${
                img.is_preview ? "border-accent" : "border-night-200"
              }`}
            >
              <img
                src={img.url}
                alt={img.alt || "Изображение"}
                className="w-full h-32 object-cover"
              />
              {img.is_preview && (
                <div className="absolute top-1 left-1 bg-accent text-white text-xs px-2 py-0.5 rounded">
                  Превью
                </div>
              )}
              <div className="p-2 space-y-1">
                <div className="flex gap-1">
                  <SecureButton
                    variant="ghost"
                    className="text-xs px-2 py-1 flex-1"
                    onClick={() => moveImage(index, "up")}
                    disabled={index === 0}
                  >
                    ↑
                  </SecureButton>
                  <SecureButton
                    variant="ghost"
                    className="text-xs px-2 py-1 flex-1"
                    onClick={() => moveImage(index, "down")}
                    disabled={index === images.length - 1}
                  >
                    ↓
                  </SecureButton>
                </div>
                <div className="flex gap-1">
                  {!img.is_preview && (
                    <SecureButton
                      variant="outline"
                      className="text-xs px-2 py-1 flex-1"
                      onClick={() => handleSetPreview(img.id)}
                    >
                      Превью
                    </SecureButton>
                  )}
                  <SecureButton
                    variant="ghost"
                    className="text-xs px-2 py-1 flex-1 text-red-600"
                    onClick={() => handleDelete(img.id)}
                  >
                    Удалить
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

