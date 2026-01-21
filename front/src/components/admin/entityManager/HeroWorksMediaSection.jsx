import SecureButton from "../../ui/SecureButton";
import { getImageUrl } from "../../../utils/image";

const HeroWorksMediaSection = ({
  endpoint,
  editingId,
  existingMedia,
  mediaLoading,
  pendingMediaPreviewUrls,
  pendingMediaFiles,
  openMediaModal,
  deleteExistingMediaItem,
  setExistingMediaPreview,
  removePendingMediaFile,
  setPendingPreview,
}) => {
  if (endpoint !== "/hero-slides" && endpoint !== "/works") return null;

  return (
    <div className="border-t border-night-200 pt-6 mt-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-night-900">Медиа</h3>
        <SecureButton
          type="button"
          variant="outline"
          className="px-4 py-2 text-xs"
          onClick={openMediaModal}
        >
          Загрузить фотографии
        </SecureButton>
      </div>

      {editingId ? (
        mediaLoading ? (
          <div className="text-sm text-night-500">Загрузка...</div>
        ) : existingMedia.length === 0 ? (
          <div className="text-sm text-night-500">Нет медиа</div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {existingMedia.map((img) => (
              <div key={img.id} className="relative">
                <img
                  src={getImageUrl(img.url)}
                  alt={img.alt || ""}
                  className={`h-20 w-20 rounded-md object-cover border ${img.is_preview ? "border-night-900" : "border-night-100"}`}
                  crossOrigin="anonymous"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />

                {endpoint === "/works" && !img.is_preview && existingMedia.length > 1 && (
                  <button
                    type="button"
                    className="absolute -bottom-2 left-0 bg-white border border-night-200 rounded-full px-2 h-6 text-[10px]"
                    onClick={() => setExistingMediaPreview(img.id)}
                    aria-label="Сделать превью"
                    title="Сделать превью"
                  >
                    Превью
                  </button>
                )}

                <button
                  type="button"
                  className="absolute -top-2 -right-2 bg-white border border-night-200 rounded-full w-6 h-6 text-xs"
                  onClick={() => deleteExistingMediaItem(img.id)}
                  aria-label="Удалить"
                  title="Удалить"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )
      ) : pendingMediaFiles.length === 0 ? (
        <div className="text-sm text-night-500">Нет медиа</div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {pendingMediaPreviewUrls.map(({ file, url }, idx) => (
            <div key={`${file.name}-${idx}`} className="relative">
              <img
                src={url}
                alt={file.name}
                className={`h-20 w-20 rounded-md object-cover border ${idx === 0 ? "border-night-900" : "border-night-100"}`}
              />

              {endpoint === "/works" && idx !== 0 && pendingMediaFiles.length > 1 && (
                <button
                  type="button"
                  className="absolute -bottom-2 left-0 bg-white border border-night-200 rounded-full px-2 h-6 text-[10px]"
                  onClick={() => setPendingPreview(idx)}
                  aria-label="Сделать превью"
                  title="Сделать превью"
                >
                  Превью
                </button>
              )}

              <button
                type="button"
                className="absolute -top-2 -right-2 bg-white border border-night-200 rounded-full w-6 h-6 text-xs"
                onClick={() => removePendingMediaFile(idx)}
                aria-label="Удалить"
                title="Удалить"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {!editingId && endpoint === "/hero-slides" && (
        <div className="text-xs text-night-500">Для Hero-слайда требуется 1 фотография</div>
      )}
    </div>
  );
};

export default HeroWorksMediaSection;
