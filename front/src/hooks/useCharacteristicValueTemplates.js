import { useEffect, useRef, useState } from "react";

let templatesCache = null;
let templatesCachePromise = null;

const rowsToMap = (rows) => {
  const map = {};
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    const fk = String(row?.field_key || "").trim();
    const value = String(row?.value || "").trim();
    if (!fk || !value) continue;
    if (!map[fk]) map[fk] = [];
    if (!map[fk].includes(value)) map[fk].push(value);
  }
  for (const fk of Object.keys(map)) {
    map[fk].sort((a, b) => a.localeCompare(b, "ru"));
  }
  return map;
};

const useCharacteristicValueTemplates = (get) => {
  const getRef = useRef(get);
  const [templatesByField, setTemplatesByField] = useState(templatesCache || {});
  const [loading, setLoading] = useState(!templatesCache);

  useEffect(() => {
    getRef.current = get;
  }, [get]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (templatesCache) {
        setTemplatesByField(templatesCache);
        setLoading(false);
        return;
      }

      if (!templatesCachePromise) {
        templatesCachePromise = getRef
          .current("/characteristic-value-templates", { limit: 500 })
          .then((res) => {
            const map = rowsToMap(res?.data);
            templatesCache = map;
            return map;
          })
          .catch(() => {
            templatesCache = {};
            return {};
          });
      }

      try {
        const map = await templatesCachePromise;
        if (!active) return;
        setTemplatesByField(map);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  return { templatesByField, loading };
};

export const invalidateCharacteristicTemplatesCache = () => {
  templatesCache = null;
  templatesCachePromise = null;
};

export default useCharacteristicValueTemplates;
