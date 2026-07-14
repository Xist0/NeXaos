import {
  PRODUCT_CHARACTERISTIC_FIELDS,
  PRODUCT_CHARACTERISTIC_SECTIONS,
  CALCULATION_ONLY_KEYS,
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

export const createEmptyCharacteristicsForm = (extraKeys = []) => {
  const next = {};
  const keys = new Set([...Object.keys(LABEL_BY_KEY), ...(extraKeys || [])]);
  for (const key of keys) {
    next[key] = { value: "", visible: true };
  }
  return next;
};

export const characteristicsFromApi = (apiValue, extraKeys = []) => {
  const base = createEmptyCharacteristicsForm(extraKeys);
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

/** Габариты из характеристик: ширина → length, глубина/высота по ключам. */
export const getCharacteristicDimensions = (characteristics) => {
  const source = characteristics && typeof characteristics === "object" && !Array.isArray(characteristics)
    ? characteristics
    : {};

  const readMm = (key) => {
    const parsed = parseCharacteristicField(source[key]);
    const n = Number(String(parsed.value ?? "").trim());
    return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
  };

  return {
    length_mm: readMm("width_mm"),
    depth_mm: readMm("depth_mm_char"),
    height_mm: readMm("height_mm_char"),
  };
};

/** При загрузке: перенос legacy-полей сущности в характеристики, если там пусто. */
export const mergeEntityDimensionsIntoCharacteristics = (characteristics, entityDims = {}) => {
  const next = characteristics && typeof characteristics === "object" && !Array.isArray(characteristics)
    ? { ...characteristics }
    : {};
  const base = characteristicsFromApi(next);

  const apply = (key, value) => {
    const parsed = parseCharacteristicField(base[key]);
    if (String(parsed.value ?? "").trim()) return;
    if (value == null || value === "") return;
    base[key] = { ...parsed, value: String(value) };
  };

  apply("width_mm", entityDims.length_mm ?? entityDims.total_length_mm);
  apply("depth_mm_char", entityDims.depth_mm ?? entityDims.total_depth_mm);
  apply("height_mm_char", entityDims.height_mm ?? entityDims.total_height_mm);

  return base;
};

/** Строки для карточки товара: только видимые и непустые. */
export const characteristicsToDisplayRows = (apiValue, catalogSections = null, fieldLabels = {}) => {
  const source = apiValue && typeof apiValue === "object" && !Array.isArray(apiValue) ? apiValue : {};
  const rows = [];

  const pushRow = (key, sectionTitle, label) => {
    const parsed = parseCharacteristicField(source[key]);
    if (!parsed.visible) return;
    const value = String(parsed.value ?? "").trim();
    if (!value) return;
    rows.push({
      key,
      section: sectionTitle,
      label: label || PRODUCT_CHARACTERISTIC_FIELDS[key]?.label || fieldLabels[key] || key,
      value,
    });
  };

  if (Array.isArray(catalogSections) && catalogSections.length > 0) {
    for (const section of catalogSections) {
      for (const field of section.fields || []) {
        pushRow(field.key, section.title, field.label);
      }
    }
    for (const section of PRODUCT_CHARACTERISTIC_SECTIONS.filter((s) => s.id === "colors")) {
      for (const rowKeys of section.rows) {
        for (const key of rowKeys) pushRow(key, section.title);
      }
    }
    return rows;
  }

  for (const section of PRODUCT_CHARACTERISTIC_SECTIONS) {
    for (const rowKeys of section.rows) {
      for (const key of rowKeys) {
        if (CALCULATION_ONLY_KEYS.includes(key)) continue;
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

/** Секции с фиксированными линиями для карточки товара (3 колонки, пустые слоты = null). */
export const buildCharacteristicSectionsWithLines = (apiValue) => {
  const source = apiValue && typeof apiValue === "object" && !Array.isArray(apiValue) ? apiValue : {};
  const valueMap = {};
  for (const [key, raw] of Object.entries(source)) {
    const parsed = parseCharacteristicField(raw);
    if (parsed.visible && String(parsed.value ?? "").trim()) {
      valueMap[key] = String(parsed.value).trim();
    }
  }

  const sections = [];
  for (const section of PRODUCT_CHARACTERISTIC_SECTIONS) {
    if (!section.lines) {
      // Габариты — без lines, обычные rows
      const rows = [];
      for (const rowKeys of section.rows) {
        for (const key of rowKeys) {
          if (CALCULATION_ONLY_KEYS.includes(key)) continue;
          const def = PRODUCT_CHARACTERISTIC_FIELDS[key];
          if (!def) continue;
          const val = valueMap[key] || "";
          if (!val) continue;
          rows.push({ key, label: def.label, value: val });
        }
      }
      if (rows.length > 0) {
        sections.push({ id: section.id, title: section.title, rows, lines: null });
      }
      continue;
    }

    // Секции с lines: строим линии с фиксированными слотами
    const builtLines = section.lines.map((line) =>
      line.map((key) => {
        if (key === null) return null;
        const def = PRODUCT_CHARACTERISTIC_FIELDS[key];
        if (!def) return null;
        const val = valueMap[key] || "";
        return { key, label: def.label, value: val };
      })
    );

    // Секция добавляется всегда, даже если все значения пусты — сетка не прыгает
    sections.push({ id: section.id, title: section.title, lines: builtLines });
  }

  return sections;
};
