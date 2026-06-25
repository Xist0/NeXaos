import { useCallback, useEffect, useRef, useState } from "react";
import { MATERIAL_SELECT_SOURCE_TYPES } from "../constants/productCharacteristics";

const isCountertopCategory = (cat) => cat && String(cat).startsWith("Столешница");

let materialsCache = null;
let materialsCachePromise = null;

const fetchAllMaterials = async (get) => {
  const [sheetRes, linearRes, hardwareRes] = await Promise.all([
    get("/sheet-materials", { limit: 500, isActive: true }),
    get("/linear-materials", { limit: 500, isActive: true }),
    get("/hardware-extended", { limit: 500, isActive: true }),
  ]);

  const sheetItems = Array.isArray(sheetRes?.data) ? sheetRes.data : [];
  const linearItems = Array.isArray(linearRes?.data) ? linearRes.data : [];
  const hardwareItems = Array.isArray(hardwareRes?.data) ? hardwareRes.data : [];

  const bySourceType = {
    [MATERIAL_SELECT_SOURCE_TYPES.sheet]: sheetItems.filter((i) => !isCountertopCategory(i.category)),
    [MATERIAL_SELECT_SOURCE_TYPES.sheet_countertop]: sheetItems.filter((i) => isCountertopCategory(i.category)),
    [MATERIAL_SELECT_SOURCE_TYPES.sheet_all]: sheetItems,
    [MATERIAL_SELECT_SOURCE_TYPES.linear]: linearItems,
    [MATERIAL_SELECT_SOURCE_TYPES.hardware]: hardwareItems,
  };

  return { bySourceType, sheetItems, linearItems, hardwareItems };
};

const useMaterialsForSelect = (get) => {
  const getRef = useRef(get);
  const [materials, setMaterials] = useState(
    materialsCache || {
      bySourceType: {},
      sheetItems: [],
      linearItems: [],
      hardwareItems: [],
    }
  );
  const [loading, setLoading] = useState(!materialsCache);

  useEffect(() => {
    getRef.current = get;
  }, [get]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchAllMaterials((...args) => getRef.current(...args));
      materialsCache = next;
      setMaterials(next);
      return next;
    } catch {
      const empty = { bySourceType: {}, sheetItems: [], linearItems: [], hardwareItems: [] };
      materialsCache = empty;
      setMaterials(empty);
      return empty;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (materialsCache) {
        setMaterials(materialsCache);
        setLoading(false);
        return;
      }

      if (!materialsCachePromise) {
        materialsCachePromise = fetchAllMaterials((...args) => getRef.current(...args))
          .then((data) => {
            materialsCache = data;
            return data;
          })
          .catch(() => {
            const empty = { bySourceType: {}, sheetItems: [], linearItems: [], hardwareItems: [] };
            materialsCache = empty;
            return empty;
          });
      }

      try {
        const data = await materialsCachePromise;
        if (!active) return;
        setMaterials(data);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const getItemsForField = useCallback(
    (selectType) => {
      if (!selectType) return [];
      return materials.bySourceType[selectType] || [];
    },
    [materials.bySourceType]
  );

  return { materials, loading, reload, getItemsForField };
};

export const invalidateMaterialsCache = () => {
  materialsCache = null;
  materialsCachePromise = null;
};

export default useMaterialsForSelect;
