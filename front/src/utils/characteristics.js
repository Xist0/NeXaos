import {
  PRODUCT_CHARACTERISTIC_FIELDS,
  PRODUCT_CHARACTERISTIC_SECTIONS,
} from "../constants/productCharacteristics";

const LABEL_BY_KEY = Object.fromEntries(
  Object.entries(PRODUCT_CHARACTERISTIC_FIELDS).map(([key, def]) => [key, def.label])
);

export const parseCharacteristicField = (raw) => {
  if (raw === null || raw === undefined) {
    return { value: "", visible: true };
  }
  if (typeof raw === "object" && !Array.isArray(raw) && "value" in raw) {
    const value =
      raw.value === null || raw.value === undefined
        ? ""
        : typeof raw.value === "string"
          ? raw.value
          : String(raw.value);
    return { value, visible: raw.visible !== false };
  }
  if (typeof raw === "boolean") {
    return { value: raw ? "Да" : "", visible: true };
  }
  if (typeof raw === "number") {
    return { value: String(raw), visible: true };
  }
  return { value: String(raw), visible: true };
};

export const createEmptyCharacteristicsForm = () => {
  const next = {};
  for (const key of Object.keys(LABEL_BY_KEY)) {
    next[key] = { value: "", visible: true };
  }
  return next;
};

export const characteristicsFromApi = (apiValue) => {
  const base = createEmptyCharacteristicsForm();
  const source = apiValue && typeof apiValue === "object" && !Array.isArray(apiValue) ? apiValue : {};
  for (const [key, raw] of Object.entries(source)) {
    if (!(key in base)) {
      const parsed = parseCharacteristicField(raw);
      base[key] = parsed;
      continue;
    }
    base[key] = parseCharacteristicField(raw);
  }
  return base;
};

export const normalizeCharacteristicsForSave = (formValue) => {
  const obj = formValue && typeof formValue === "object" && !Array.isArray(formValue) ? formValue : {};
  const next = {};
  for (const [key, raw] of Object.entries(obj)) {
    const { value, visible } = parseCharacteristicField(raw);
    const trimmed = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    if (!trimmed) continue;
    next[key] = { value: trimmed, visible: visible !== false };
  }
  return next;
};

/** Строки для карточки товара: только видимые и непустые. */
export const characteristicsToDisplayRows = (apiValue) => {
  const source = apiValue && typeof apiValue === "object" && !Array.isArray(apiValue) ? apiValue : {};
  const rows = [];

  for (const section of PRODUCT_CHARACTERISTIC_SECTIONS) {
    for (const rowKeys of section.rows) {
      for (const key of rowKeys) {
        const def = PRODUCT_CHARACTERISTIC_FIELDS[key];
        if (!def) continue;
        const parsed = parseCharacteristicField(source[key]);
        if (!parsed.visible) continue;
        const value = String(parsed.value ?? "").trim();
        if (!value) continue;
        rows.push({
          key,
          label: def.label,
          value,
          sectionId: section.id,
          sectionTitle: section.title,
        });
      }
    }
  }

  for (const [key, raw] of Object.entries(source)) {
    if (LABEL_BY_KEY[key]) continue;
    const parsed = parseCharacteristicField(raw);
    if (!parsed.visible) continue;
    const value = String(parsed.value ?? "").trim();
    if (!value) continue;
    rows.push({ key, label: key, value, sectionId: "other", sectionTitle: "Прочее" });
  }

  return rows;
};

export const groupCharacteristicRows = (rows) => {
  const map = new Map();
  for (const row of rows) {
    const id = row.sectionId || "other";
    if (!map.has(id)) {
      map.set(id, { id, title: row.sectionTitle || "Прочее", rows: [] });
    }
    map.get(id).rows.push(row);
  }
  return Array.from(map.values());
};
