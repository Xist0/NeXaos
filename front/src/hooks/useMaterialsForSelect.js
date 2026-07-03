import { useCallback, useEffect, useRef, useState } from "react";
import { MATERIAL_SELECT_SOURCE_TYPES } from "../constants/productCharacteristics";

const isCountertopCategory = (cat) => cat && String(cat).startsWith("Столешница");

const NON_SHEET_CATEGORIES = new Set(["Кромка", "Пиломатериал", "Рамка", "Стекло в рамку", "Пленка под фрезу", "Вид фрезы"]);

const AREA_HW_CATEGORIES = new Set(["Рамка", "Стекло в рамку", "Пленка под фрезу"]);
const FACADE_HW_CATEGORIES = new Set(["Рамка"]);

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

  const sheetNonCountertop = sheetItems.filter((i) => !isCountertopCategory(i.category));
  const sheetPure = sheetNonCountertop.filter((i) => !NON_SHEET_CATEGORIES.has(i.category || ""));

  // Площадные материалы: чистый листовой + фурнитура с price_per_m2 (Рамка, Стекло в рамку, Пленка под фрезу)
  const areaHwItems = hardwareItems.filter((i) => {
    const cat = String(i.category || "").trim().toLowerCase();
    for (const ac of AREA_HW_CATEGORIES) {
      if (cat === String(ac).trim().toLowerCase()) return true;
    }
    return false;
  });
  const sheetAreaItems = [...sheetPure, ...areaHwItems];

  // Фасадные цвета: чистый листовой + только Рамка
  const facadeHwItems = hardwareItems.filter((i) => {
    const cat = String(i.category || "").trim().toLowerCase();
    for (const fc of FACADE_HW_CATEGORIES) {
      if (cat === String(fc).trim().toLowerCase()) return true;
    }
    return false;
  });
  const sheetFacadeItems = [...sheetPure, ...facadeHwItems];

  // Уникальные категории листовых материалов (для поля "Материал корпуса/фасада")
  const categorySet = new Set();
  const sheetCategories = [];
  for (const item of sheetNonCountertop) {
    if (item.category && !categorySet.has(item.category)) {
      categorySet.add(item.category);
      sheetCategories.push({ id: item.category, name: item.category, category: item.category, price_per_m2: null });
    }
  }

  const bySourceType = {
    [MATERIAL_SELECT_SOURCE_TYPES.sheet]: sheetNonCountertop,
    [MATERIAL_SELECT_SOURCE_TYPES.sheet_pure]: sheetPure,
    [MATERIAL_SELECT_SOURCE_TYPES.sheet_countertop]: sheetItems.filter((i) => isCountertopCategory(i.category)),
    [MATERIAL_SELECT_SOURCE_TYPES.sheet_all]: sheetItems,
    [MATERIAL_SELECT_SOURCE_TYPES.linear]: linearItems,
    [MATERIAL_SELECT_SOURCE_TYPES.hardware]: hardwareItems,
    [MATERIAL_SELECT_SOURCE_TYPES.sheet_category]: sheetCategories,
    [MATERIAL_SELECT_SOURCE_TYPES.sheet_area]: sheetAreaItems,
    [MATERIAL_SELECT_SOURCE_TYPES.sheet_facade]: sheetFacadeItems,
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
