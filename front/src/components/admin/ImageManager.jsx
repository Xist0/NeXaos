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
  const [draggedIndex, setDraggedIndex] = useState(null);

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
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || !entityId) {
      console.log("Нет файлов или entityId", { filesLength: files.length, entityId });
      return;
    }
    
    console.log("Начинаем загрузку", { filesCount: files.length, entityId, entityType });
    setUploading(true);
    let successCount = 0;
    let errorCount = 0;
    
    try {
      // Загружаем все файлы последовательно с обработкой ошибок
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("entityType", entityType);
          formData.append("entityId", String(entityId));
          // Добавляем оригинальное имя файла для alt
          formData.append("alt", file.name);

          console.log(`Загрузка файла ${i + 1}/${files.length}:`, file.name);
          const response = await post("/images/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          console.log("Файл загружен успешно:", response);
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Не удалось загрузить файл ${file.name}:`, error);
          logger.error(`Не удалось загрузить файл ${file.name}`, error);
        }
      }

      if (successCount > 0) {
        logger.info(`Загружено ${successCount} из ${files.length} изображений`);
        await fetchImages();
        onUpdate?.();
      }
      
      if (errorCount > 0) {
        logger.error(`Не удалось загрузить ${errorCount} файлов`);
      }
    } catch (error) {
      logger.error("Ошибка при загрузке изображений", error);
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

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const draggedItem = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedItem);

    setImages(newImages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null) {
      const newOrder = images.map((img) => img.id);
      handleReorder(newOrder);
    }
    setDraggedIndex(null);
  };

  const getImageUrl = (url) => {
    if (!url) return "";
    if (url.startsWith('/uploads/')) {
      return import.meta.env.DEV ? `http://localhost:5000${url}` : url;
    }
    return url;
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
        <h3 className="text-sm font-semibold text-night-900">
          Изображения {images.length > 0 && `(${images.length})`}
        </h3>
        <div className="flex items-center gap-2">
          <input
            id={`image-upload-${entityId}`}
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            disabled={uploading || !entityId}
            className="hidden"
          />
          <SecureButton
            type="button"
            variant="outline"
            disabled={uploading || !entityId}
            className="text-xs px-3 py-1"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!uploading && entityId) {
                const input = document.getElementById(`image-upload-${entityId}`);
                if (input) {
                  input.click();
                }
              }
            }}
          >
            {uploading ? "Загрузка..." : "+ Добавить фото"}
          </SecureButton>
        </div>
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
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative border-2 rounded-lg overflow-hidden cursor-move transition-all ${
                img.is_preview ? "border-accent" : "border-night-200"
              } ${draggedIndex === index ? "opacity-50 scale-95" : "hover:shadow-lg"}`}
            >
              <div className="absolute top-1 right-1 bg-night-900/70 text-white text-xs px-2 py-0.5 rounded z-10">
                #{index + 1}
              </div>
              <img
                src={getImageUrl(img.url)}
                alt={img.alt || "Изображение"}
                className="w-full h-32 object-cover"
                crossOrigin="anonymous"
                onError={(e) => {
                  e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3EНет фото%3C/text%3E%3C/svg%3E";
                }}
              />
              {img.is_preview && (
                <div className="absolute top-1 left-1 bg-accent text-white text-xs px-2 py-0.5 rounded">
                  Превью
                </div>
              )}
              <div className="p-2 space-y-1 bg-night-50">
                <div className="text-xs text-night-600 mb-1 truncate" title={img.alt || img.url}>
                  {img.alt || `Фото ${index + 1}`}
                </div>
                <div className="flex gap-1">
                  <SecureButton
                    variant="ghost"
                    className="text-xs px-2 py-1 flex-1"
                    onClick={() => moveImage(index, "up")}
                    disabled={index === 0}
                    title="Переместить вверх"
                  >
                    ↑
                  </SecureButton>
                  <SecureButton
                    variant="ghost"
                    className="text-xs px-2 py-1 flex-1"
                    onClick={() => moveImage(index, "down")}
                    disabled={index === images.length - 1}
                    title="Переместить вниз"
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
                      title="Установить как превью"
                    >
                      Превью
                    </SecureButton>
                  )}
                  <SecureButton
                    variant="ghost"
                    className="text-xs px-2 py-1 flex-1 text-red-600"
                    onClick={() => handleDelete(img.id)}
                    title="Удалить фото"
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

