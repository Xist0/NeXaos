export const parsePrice = (value) => {
  if (value === null || value === undefined || value === "") return undefined;

  let s = String(value).replace(/\u00a0/g, " ").trim();
  if (!s) return undefined;

  const compact = s.replace(/\s/g, "");
  // Европейский формат: 1.260,00
  if (/,\d{1,2}$/.test(compact)) {
    s = compact.replace(/\./g, "").replace(",", ".");
  } else {
    s = compact.replace(",", ".");
  }

  const match = s.match(/^(\d+)(?:\.(\d+))?/);
  if (!match) return undefined;

  const num = Number(match[1] + (match[2] != null ? `.${match[2]}` : ""));
  return Number.isFinite(num) ? num : undefined;
};

export const fmtPrice = (v) =>
  v == null || v === ""
    ? "—"
    : `${Number(v).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;

export const calcPricePerM2 = (pricePerSheet, lengthMm, widthMm) => {
  const pps = Number(pricePerSheet);
  const l = Number(lengthMm);
  const w = Number(widthMm);
  if (!pps || !l || !w) return null;
  const area = (l * w) / 1_000_000;
  if (area <= 0) return null;
  return Math.ceil((pps / area) * 100) / 100;
};

export const sheetAreaM2 = (lengthMm, widthMm) => {
  const l = Number(lengthMm);
  const w = Number(widthMm);
  if (!l || !w) return null;
  return Math.round(((l * w) / 1_000_000) * 1000) / 1000;
};

export const loadStoredGroups = (key) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((g) => typeof g === "string" && g.trim()) : [];
  } catch {
    return [];
  }
};

export const saveStoredGroups = (key, groups) => {
  localStorage.setItem(key, JSON.stringify(groups));
};

export const mergeGroupsFromItems = (storedGroups, items, categoryField = "category") => {
  const set = new Set(storedGroups);
  for (const item of items) {
    const cat = String(item?.[categoryField] ?? "").trim();
    if (cat) set.add(cat);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
};
