const normalizePart = (value) => {
  const s = String(value ?? "").trim();
  if (!s) return "";
  return s
    .replace(/\s+/g, "")
    .replace(/[-–—]+/g, "")
    .replace(/[\\/]+/g, "")
    .trim();
};

const normalizeNum = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n));
};

const buildArticle = ({
  category,
  section,
  subcategory,
  name,
  size1,
  size2,
  size3,
  primaryColor,
  secondaryColor,
}) => {
  const parts = [
    normalizePart(category),
    normalizePart(section),
    normalizePart(subcategory),
    normalizePart(name),
    normalizeNum(size1),
    normalizeNum(size2),
    normalizeNum(size3),
    normalizePart(primaryColor),
    normalizePart(secondaryColor),
  ].filter(Boolean);

  if (parts.length === 0) return null;
  return parts.join("-");
};

module.exports = {
  buildArticle,
  normalizePart,
};
