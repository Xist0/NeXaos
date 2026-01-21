import SecureButton from "../../ui/SecureButton";

const HeroWorksMediaModal = ({
  endpoint,
  editingId,
  mediaModalOpen,
  closeMediaModal,
  onMediaInputChange,
  modalMediaPreviewUrls,
  mediaModalFiles,
  mediaUploading,
  removeMediaModalFile,
  setMediaModalPreview,
  submitMediaModal,
}) => {
  if (!mediaModalOpen) return null;
  if (endpoint !== "/hero-slides" && endpoint !== "/works") return null;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeMediaModal();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 relative shadow-2xl rounded-2xl bg-white border border-night-200 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label="Закрыть"
          className="absolute right-4 top-4 text-night-400 hover:text-night-700 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-night-100 transition-colors"
          onClick={closeMediaModal}
          type="button"
        >
          ✕
        </button>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-night-900">Загрузка фотографий</h3>
            {endpoint === "/hero-slides" ? (
              <p className="text-sm text-night-500">Можно выбрать только 1 фотографию</p>
            ) : (
              <p className="text-sm text-night-500">Можно выбрать несколько файлов</p>
            )}
          </div>

          <input
            type="file"
            accept={endpoint === "/hero-slides" ? "image/*" : "image/*,video/*"}
            multiple={endpoint !== "/hero-slides"}
            onChange={onMediaInputChange}
            className="block w-full text-xs text-night-600 file:mr-3 file:rounded-full file:border-0 file:bg-night-900 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-night-800"
            disabled={mediaUploading}
          />

          {mediaModalFiles.length === 0 ? (
            <div className="text-sm text-night-500">Файлы не выбраны</div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {modalMediaPreviewUrls.map(({ file, url }, idx) => (
                <div key={`${file.name}-${idx}`} className="relative">
                  <img
                    src={url}
                    alt={file.name}
                    className={`h-24 w-24 rounded-md object-cover border ${idx === 0 ? "border-night-900" : "border-night-100"}`}
                  />

                  {endpoint === "/works" && idx !== 0 && mediaModalFiles.length > 1 && (
                    <button
                      type="button"
                      className="absolute -bottom-2 left-0 bg-white border border-night-200 rounded-full px-2 h-6 text-[10px]"
                      onClick={() => setMediaModalPreview(idx)}
                      aria-label="Сделать превью"
                      title="Сделать превью"
                      disabled={mediaUploading}
                    >
                      Превью
                    </button>
                  )}

                  <button
                    type="button"
                    className="absolute -top-2 -right-2 bg-white border border-night-200 rounded-full w-6 h-6 text-xs"
                    onClick={() => removeMediaModalFile(idx)}
                    aria-label="Удалить"
                    title="Удалить"
                    disabled={mediaUploading}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <SecureButton type="button" variant="ghost" onClick={closeMediaModal}>
              Отмена
            </SecureButton>
            <SecureButton
              type="button"
              variant="primary"
              disabled={mediaModalFiles.length === 0 || mediaUploading}
              onClick={submitMediaModal}
            >
              {editingId ? "Загрузить" : "Добавить"}
            </SecureButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroWorksMediaModal;
