import { useCallback, useEffect, useMemo, useState } from "react";

const moveToFront = (arr, idx) => {
  if (!Array.isArray(arr)) return [];
  if (idx <= 0 || idx >= arr.length) return arr;
  const next = [...arr];
  const [picked] = next.splice(idx, 1);
  next.unshift(picked);
  return next;
};

const useHeroWorksMedia = ({ endpoint, editingId, request, get, post, del, logger }) => {
  const isHeroOrWorks = endpoint === "/hero-slides" || endpoint === "/works";
  const isHeroSlides = endpoint === "/hero-slides";
  const isWorks = endpoint === "/works";

  const mediaEntityType = useMemo(
    () => String(endpoint || "").replace(/^\//, "").replace(/-/g, "_"),
    [endpoint]
  );

  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaModalFiles, setMediaModalFiles] = useState([]);
  const [pendingMediaFiles, setPendingMediaFiles] = useState([]);
  const [existingMedia, setExistingMedia] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);

  const pendingMediaPreviewUrls = useMemo(
    () => pendingMediaFiles.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [pendingMediaFiles]
  );

  useEffect(() => {
    return () => {
      pendingMediaPreviewUrls.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [pendingMediaPreviewUrls]);

  const modalMediaPreviewUrls = useMemo(
    () => mediaModalFiles.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [mediaModalFiles]
  );

  useEffect(() => {
    return () => {
      modalMediaPreviewUrls.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [modalMediaPreviewUrls]);

  const resetPending = useCallback(() => {
    setPendingMediaFiles([]);
  }, []);

  const resetAll = useCallback(() => {
    setMediaModalOpen(false);
    setMediaModalFiles([]);
    setPendingMediaFiles([]);
    setExistingMedia([]);
    setMediaLoading(false);
    setMediaUploading(false);
  }, []);

  useEffect(() => {
    if (!isHeroOrWorks) return;
    if (!editingId) {
      setExistingMedia([]);
      return;
    }

    let active = true;
    setMediaLoading(true);
    get(`/images/${mediaEntityType}/${editingId}`)
      .then((res) => {
        if (!active) return;
        const next = Array.isArray(res?.data) ? res.data : [];
        setExistingMedia(next);
      })
      .catch((e) => {
        if (!active) return;
        logger.error("Не удалось загрузить медиа", e);
        setExistingMedia([]);
      })
      .finally(() => {
        if (!active) return;
        setMediaLoading(false);
      });

    return () => {
      active = false;
    };
  }, [editingId, get, isHeroOrWorks, logger, mediaEntityType]);

  useEffect(() => {
    if (!isHeroOrWorks) return;
    setMediaModalOpen(false);
    setMediaModalFiles([]);
    setPendingMediaFiles([]);
    setExistingMedia([]);
  }, [endpoint, isHeroOrWorks]);

  const openMediaModal = useCallback(() => {
    setMediaModalFiles([]);
    setMediaModalOpen(true);
  }, []);

  const closeMediaModal = useCallback(() => {
    if (mediaUploading) return;
    setMediaModalOpen(false);
    setMediaModalFiles([]);
  }, [mediaUploading]);

  const applyHeroLimit = useCallback(
    (files) => {
      if (!isHeroSlides) return files;
      return files.length > 0 ? [files[0]] : [];
    },
    [isHeroSlides]
  );

  const onMediaInputChange = useCallback(
    (event) => {
      const files = Array.from(event.target.files || []);
      const limited = applyHeroLimit(files);
      setMediaModalFiles(limited);
    },
    [applyHeroLimit]
  );

  const removeMediaModalFile = useCallback((idx) => {
    setMediaModalFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const removePendingMediaFile = useCallback((idx) => {
    setPendingMediaFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const setPendingPreview = useCallback((idx) => {
    setPendingMediaFiles((prev) => moveToFront(prev, idx));
  }, []);

  const setMediaModalPreview = useCallback((idx) => {
    setMediaModalFiles((prev) => moveToFront(prev, idx));
  }, []);

  const deleteExistingMediaItem = useCallback(
    async (imageId) => {
      if (!imageId) return;
      if (!confirm("Удалить изображение?")) return;
      try {
        await del(`/images/${imageId}`);
        setExistingMedia((prev) => prev.filter((x) => x.id !== imageId));
        logger.info("Изображение удалено");
      } catch (e) {
        logger.error("Не удалось удалить изображение", e);
      }
    },
    [del, logger]
  );

  const setExistingMediaPreview = useCallback(
    async (imageId) => {
      if (!imageId) return;
      if (!editingId) return;
      try {
        await post(`/images/${imageId}/set-preview`);
        const res = await get(`/images/${mediaEntityType}/${editingId}`);
        setExistingMedia(Array.isArray(res?.data) ? res.data : []);
        logger.info("Превью обновлено");
      } catch (e) {
        logger.error("Не удалось обновить превью", e);
      }
    },
    [editingId, get, logger, mediaEntityType, post]
  );

  const uploadMediaForEntity = useCallback(
    async (entityId, files) => {
      if (!entityId) throw new Error("Missing entityId");
      const list = Array.isArray(files) ? files : [];
      if (list.length === 0) return;

      setMediaUploading(true);
      try {
        for (const file of list) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("entityType", mediaEntityType);
          formData.append("entityId", String(entityId));
          formData.append("alt", String(file?.name || "media").split(".")[0]);
          await request({
            method: "POST",
            url: "/images",
            data: formData,
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
      } finally {
        setMediaUploading(false);
      }
    },
    [mediaEntityType, request]
  );

  const submitMediaModal = useCallback(async () => {
    const files = applyHeroLimit(mediaModalFiles);
    if (files.length === 0) {
      logger.error("Выберите файл");
      return;
    }

    if (!editingId) {
      setPendingMediaFiles(files);
      closeMediaModal();
      return;
    }

    if (isHeroSlides && existingMedia.length > 0) {
      if (!confirm("Заменить текущее изображение?")) return;
      for (const img of existingMedia) {
        try {
          await del(`/images/${img.id}`);
        } catch (e) {
          logger.error("Не удалось удалить старое изображение", e);
        }
      }
      setExistingMedia([]);
    }

    try {
      await uploadMediaForEntity(editingId, files);
      const res = await get(`/images/${mediaEntityType}/${editingId}`);
      setExistingMedia(Array.isArray(res?.data) ? res.data : []);
      closeMediaModal();
    } catch (e) {
      logger.error("Не удалось загрузить медиа", e);
    }
  }, [applyHeroLimit, closeMediaModal, del, editingId, existingMedia, get, isHeroSlides, logger, mediaEntityType, mediaModalFiles, uploadMediaForEntity]);

  const uploadPendingToEntity = useCallback(
    async (entityId) => {
      const files = applyHeroLimit(pendingMediaFiles);
      await uploadMediaForEntity(entityId, files);
    },
    [applyHeroLimit, pendingMediaFiles, uploadMediaForEntity]
  );

  const requireMediaForCreate = isHeroOrWorks;
  const hasPendingMedia = pendingMediaFiles.length > 0;

  return {
    isHeroOrWorks,
    isHeroSlides,
    isWorks,
    mediaEntityType,

    mediaModalOpen,
    mediaModalFiles,
    pendingMediaFiles,
    existingMedia,
    mediaLoading,
    mediaUploading,

    pendingMediaPreviewUrls,
    modalMediaPreviewUrls,

    openMediaModal,
    closeMediaModal,
    onMediaInputChange,
    removeMediaModalFile,
    removePendingMediaFile,
    submitMediaModal,

    setPendingPreview,
    setMediaModalPreview,

    deleteExistingMediaItem,
    setExistingMediaPreview,

    resetPending,
    resetAll,

    uploadPendingToEntity,

    requireMediaForCreate,
    hasPendingMedia,
  };
};

export default useHeroWorksMedia;
