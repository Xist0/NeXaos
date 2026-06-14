const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SKIP_EXTENSIONS = new Set([".svg", ".gif"]);
const SKIP_MIMES = new Set(["image/svg+xml", "image/gif"]);

/**
 * Конвертирует загруженное растровое изображение в AVIF (fallback — WebP).
 * SVG/GIF и уже оптимизированные файлы не трогаем.
 */
const optimizeUploadedImage = async (inputPath, options = {}) => {
  const ext = path.extname(inputPath).toLowerCase();
  const mimeType = options.mimeType || "";

  if (SKIP_EXTENSIONS.has(ext) || SKIP_MIMES.has(mimeType)) {
    return { path: inputPath, mimeType: mimeType || null, ext, optimized: false };
  }

  if (ext === ".avif") {
    return { path: inputPath, mimeType: "image/avif", ext: ".avif", optimized: false };
  }

  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, ext);
  const avifPath = path.join(dir, `${base}.avif`);

  try {
    const meta = await sharp(inputPath).metadata();
    if (meta.pages && meta.pages > 1) {
      return { path: inputPath, mimeType: mimeType || null, ext, optimized: false };
    }

    await sharp(inputPath)
      .rotate()
      .avif({ quality: 80, effort: 4, chromaSubsampling: "4:4:4" })
      .toFile(avifPath);

    if (fs.existsSync(inputPath) && path.resolve(inputPath) !== path.resolve(avifPath)) {
      fs.unlinkSync(inputPath);
    }

    return { path: avifPath, mimeType: "image/avif", ext: ".avif", optimized: true };
  } catch (avifError) {
    try {
      const webpPath = path.join(dir, `${base}.webp`);
      await sharp(inputPath).rotate().webp({ quality: 85, effort: 4 }).toFile(webpPath);

      if (fs.existsSync(inputPath) && path.resolve(inputPath) !== path.resolve(webpPath)) {
        fs.unlinkSync(inputPath);
      }

      return { path: webpPath, mimeType: "image/webp", ext: ".webp", optimized: true };
    } catch {
      return { path: inputPath, mimeType: mimeType || null, ext, optimized: false };
    }
  }
};

module.exports = { optimizeUploadedImage };
