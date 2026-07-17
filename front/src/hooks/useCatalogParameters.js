import { useCallback, useEffect, useRef, useState } from "react";

let catalogCache = null;
let catalogCachePromise = null;

/** Фиксированный порядок секций (категорий) параметров каталога. */
const SECTION_ORDER = [
  "Общие параметры",
  "Основные характеристики",
  "Дополнительная информация",
];

const sectionSortKey = (name) => {
  const idx = SECTION_ORDER.indexOf(String(name || "").trim());
  return idx >= 0 ? idx : SECTION_ORDER.length;
};

const buildCatalog = (categories, parameters, valueTemplates) => {
  const templatesByField = {};
  const fieldLabels = {};
  const allFieldKeys = [];

  const valuesByParam = new Map();
  for (const row of valueTemplates || []) {
    const pid = Number(row.parameter_id);
    if (!pid) continue;
    const value = String(row.value || "").trim();
    if (!value) continue;
    if (!valuesByParam.has(pid)) valuesByParam.set(pid, []);
    const list = valuesByParam.get(pid);
    if (!list.includes(value)) list.push(value);
  }

  const paramsByCategory = new Map();
  for (const param of parameters || []) {
    const cid = Number(param.category_id);
    if (!paramsByCategory.has(cid)) paramsByCategory.set(cid, []);
    paramsByCategory.get(cid).push(param);
  }

  const sections = (categories || [])
    .slice()
    .sort((a, b) => sectionSortKey(a.name) - sectionSortKey(b.name) || String(a.name || "").localeCompare(String(b.name || ""), "ru"))
    .map((cat) => {
      const fields = (paramsByCategory.get(Number(cat.id)) || [])
        .slice()
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name).localeCompare(String(b.name), "ru"))
        .map((param) => {
          const key = String(param.field_key || `param_${param.id}`).trim();
          fieldLabels[key] = param.name || key;
          allFieldKeys.push(key);
          const suggestions = (valuesByParam.get(Number(param.id)) || []).slice().sort((a, b) => a.localeCompare(b, "ru"));
          templatesByField[key] = suggestions;
          return { key, label: param.name || key, parameterId: param.id, suggestions };
        })
        .filter((f) => f.key)
        .filter((f) => f.key !== "supports_type");

      return {
        id: `cat_${cat.id}`,
        categoryId: cat.id,
        title: cat.name,
        fields,
      };
    })
    .filter((s) => s.fields.length > 0);

  return { sections, templatesByField, fieldLabels, allFieldKeys };
};

const fetchCatalog = async (get) => {
  const [catRes, paramRes, valRes] = await Promise.all([
    get("/product-parameter-categories", { limit: 500 }),
    get("/product-parameters", { limit: 500 }),
    get("/product-parameter-value-templates", { limit: 2000 }),
  ]);
  return buildCatalog(catRes?.data, paramRes?.data, valRes?.data);
};

const useCatalogParameters = (get) => {
  const getRef = useRef(get);
  const [catalog, setCatalog] = useState(catalogCache || { sections: [], templatesByField: {}, fieldLabels: {}, allFieldKeys: [] });
  const [loading, setLoading] = useState(!catalogCache);

  useEffect(() => {
    getRef.current = get;
  }, [get]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchCatalog((...args) => getRef.current(...args));
      catalogCache = next;
      setCatalog(next);
      return next;
    } catch {
      const empty = { sections: [], templatesByField: {}, fieldLabels: {}, allFieldKeys: [] };
      catalogCache = empty;
      setCatalog(empty);
      return empty;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (catalogCache) {
        setCatalog(catalogCache);
        setLoading(false);
        return;
      }

      if (!catalogCachePromise) {
        catalogCachePromise = fetchCatalog((...args) => getRef.current(...args))
          .then((data) => {
            catalogCache = data;
            return data;
          })
          .catch(() => {
            const empty = { sections: [], templatesByField: {}, fieldLabels: {}, allFieldKeys: [] };
            catalogCache = empty;
            return empty;
          });
      }

      try {
        const data = await catalogCachePromise;
        if (!active) return;
        setCatalog(data);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  return { ...catalog, loading, reload };
};

export const invalidateCatalogParametersCache = () => {
  catalogCache = null;
  catalogCachePromise = null;
};

export { buildCatalog };
export default useCatalogParameters;
