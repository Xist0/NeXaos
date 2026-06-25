/**
 * Аналоги Excel-функций для расчёта стоимости модуля.
 */
const ROUND = (value, digits = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** digits;
  return Math.ceil(n * factor) / factor;
};

const SUM = (...args) => {
  const flat = args.flat(Infinity);
  return flat.reduce((acc, v) => acc + (Number(v) || 0), 0);
};

const IFERROR = (fn, fallback = 0) => {
  try {
    const result = typeof fn === "function" ? fn() : fn;
    if (result === null || result === undefined || Number.isNaN(result)) return fallback;
    return result;
  } catch {
    return fallback;
  }
};

const IF = (condition, whenTrue, whenFalse = 0) => (condition ? whenTrue : whenFalse);

const VLOOKUP = (lookup, table, colIndex = 1) => {
  const key = String(lookup ?? "").trim().toLowerCase();
  if (!key) return 0;
  const row = table.find(
    (r) =>
      String(r.name ?? "").trim().toLowerCase() === key ||
      String(r.sku ?? "").trim().toLowerCase() === key
  );
  if (!row) return 0;
  if (colIndex === 1) return Number(row.price_per_m2 ?? row.price ?? 0) || 0;
  if (colIndex === 2) return Number(row.edge_price_per_m ?? row.edgePrice ?? 0) || 0;
  return 0;
};

const HW_LOOKUP = (lookup, table) => {
  const key = String(lookup ?? "").trim().toLowerCase();
  if (!key) return 0;
  const row = table.find(
    (r) =>
      String(r.name ?? "").trim().toLowerCase() === key ||
      String(r.sku ?? "").trim().toLowerCase() === key
  );
  return Number(row?.price_per_unit ?? 0) || 0;
};

const normalizeKey = (value) => String(value ?? "").trim().toLowerCase();

const FASTENER_CATEGORY = "крепежная фурнитура";

const HW_MATRIX_COLUMNS = ["drawer", "hinge", "support", "shelf", "bottom", "post", "rail", "lid"];

/** Сопоставление legacy-ключей матрицы с наименованиями в справочнике фурнитуры. */
const LEGACY_HW_KEY_NAMES = {
  cross_brace: ["меж-я стяжка", "межсекционная стяжка"],
  dowel_8x30: ["шкант 8х30"],
  euro_screw_7x50: ["евровинт 7х50"],
  screw_3_5x16: ["саморез 3,5х16"],
  screw_3_5x19: ["саморез 3,5х19"],
  screw_4x60: ["саморез 4x60"],
  flipper: ["flipper"],
  eccentric: ["эксцентрик"],
  brace_d20: ["стяжка d20"],
};

const findHardwareByName = (hardware, name) => {
  const key = normalizeKey(name);
  return hardware.find(
    (item) =>
      normalizeKey(item.name) === key ||
      normalizeKey(item.sku) === key
  );
};

const resolveMatrixKeys = (lookupKey, hardware) => {
  const keys = new Set();
  if (lookupKey != null && lookupKey !== "") {
    keys.add(String(lookupKey));
    keys.add(normalizeKey(lookupKey));
  }

  const legacyNames = LEGACY_HW_KEY_NAMES[lookupKey] || [];
  for (const legacyName of legacyNames) {
    keys.add(normalizeKey(legacyName));
    const item = findHardwareByName(hardware, legacyName);
    if (item?.id != null) keys.add(String(item.id));
  }

  const directItem = findHardwareByName(hardware, lookupKey);
  if (directItem?.id != null) keys.add(String(directItem.id));

  return Array.from(keys);
};

const parseDrawerCounts = (drawersDetail, characteristics = {}) => {
  const result = { k84: 0, k116: 0, k199: 0, types: [] };

  const text = String(drawersDetail ?? characteristics.drawers_detail ?? "").trim();
  if (text) {
    for (const part of text.split(";")) {
      const m = part.trim().match(/^(.+?)\s*[×x*]\s*(\d+)$/i);
      const type = m ? m[1].trim() : part.trim();
      const qty = m ? Number(m[2]) : 1;
      if (/84/.test(type)) result.k84 += qty;
      else if (/116/.test(type)) result.k116 += qty;
      else if (/199/.test(type)) result.k199 += qty;
      result.types.push({ type, qty, key: /84/.test(type) ? "84" : /116/.test(type) ? "116" : /199/.test(type) ? "199" : type });
    }
  }

  if (!result.k84 && !result.k116 && !result.k199) {
    result.k84 = Number(characteristics.drawer_84_count) || 0;
    result.k116 = Number(characteristics.drawer_116_count) || 0;
    result.k199 = Number(characteristics.drawer_199_count) || 0;
  }

  return result;
};

/**
 * Основной расчёт стоимости модуля (логика Excel).
 */
const calculateModulePrice = (input, refs) => {
  const {
    width_mm: D31 = 0,
    height_mm: D33 = 0,
    depth_mm: D35 = 0,
    front_count: D16 = 1,
    characteristics = {},
    hardwareMatrix = {},
  } = input;

  const chars = characteristics;
  const coeff = refs.coefficients || {};
  const L4 = Number(coeff.general) || 1;
  const O4 = Number(coeff.sheet) || 1;
  const O5 = Number(coeff.edge) || 1;
  const addSheet = Number(coeff.addSheet) || 0;
  const addEdge = Number(coeff.addEdge) || 0;

  const materials = refs.materials || [];
  const hardware = refs.hardware || [];
  const edgePricePerM = Number(refs.edgePricePerM) || VLOOKUP("Кромка", materials, 2) || 0;

  const G5 = chars.showcase_back_panel_color || "";
  const D11 = chars.back_panel || "";
  const G7 = chars.corpus_color || chars.material_corpus || "";
  const G9 = chars.facade_color || chars.material_facade || "";
  const G18 = chars.lift_mechanism || "";
  const D18 = Number(chars.lift_mechanism_count) || 0;
  const G20 = chars.hinges_type || "";
  const D22 = Number(chars.hinges_count) || 0;
  const G24 = chars.shelves_type || "";
  const D24 = Number(chars.shelf_count) || 0;
  const G26 = chars.hangers_type || "";
  const D26 = Number(chars.hangers_count) || 0;
  const G28 = chars.supports_type || "";
  const D28 = Number(chars.supports_count) || 0;

  const drawers = parseDrawerCounts(chars.drawers_detail, chars);
  const K20 = drawers.k84;
  const K21 = drawers.k116;
  const K22 = drawers.k199;

  // N7 — площадь корпуса (дно + крышка + 2 боковины)
  const N7 = IFERROR(
    () => (2 * D31 * D35 + 2 * (D33 - 100) * D35) / 1_000_000 * O4,
    0
  );

  // N8 — периметр корпуса (дно + крышка + 2 боковины)
  const N8 = IFERROR(
    () => (4 * (D31 + D35) + 4 * (D33 - 100 + D35)) / 1000 * O5,
    0
  );

  // M20-M22 — площади ящиков
  const M20 = IFERROR(() => K20 * (((D31 - 110) * (D35 - 24)) + ((D31 - 120) * 84)) / 1_000_000, 0);
  const M21 = IFERROR(() => K21 * (((D31 - 110) * (D35 - 24)) + ((D31 - 120) * 116)) / 1_000_000, 0);
  const M22 = IFERROR(() => K22 * (((D31 - 110) * (D35 - 24)) + ((D31 - 120) * 199)) / 1_000_000, 0);

  // N20-N22 — периметры ящиков
  const N20 = IFERROR(() => K20 * (((D31 - 110) + (D35 - 24)) * 2 + ((D31 - 120) + 84) * 2) / 1000, 0);
  const N21 = IFERROR(() => K21 * ((((D31 - 110) + (D35 - 24)) * 2) + (((D31 - 120) + 116) * 2)) / 1000, 0);
  const N22 = IFERROR(() => K22 * ((((D31 - 110) + (D35 - 24)) * 2) + (((D31 - 120) + 199) * 2)) / 1000, 0);

  // O20-O22 — периметры фасадов ящиков
  const O20 = IFERROR(() => ((D31 + ((D33 - 100) / 4)) * 2 / 1000) * K20, 0);
  const O21 = IFERROR(() => ((D31 + ((D33 - 100) / 4)) * 2 / 1000) * K21, 0);
  const O22 = IFERROR(() => ((D31 + ((D33 - 100) / 4 * 2)) * 2 / 1000) * K22, 0);

  const N10 = SUM(M20, M21, M22) * O4;
  const N11 = SUM(N20, N21, N22) * O5;
  const N13 = (D31 * (D33 - 100)) / 1_000_000 * O4;

  const N14 = IFERROR(
    () => ((D31 / D16) + (D33 - 100)) * 2 / 1000 * D16 * O5,
    SUM(O20, O21, O22)
  );

  // H5 — задняя стенка (только для ЛХДФ белый)
  const H5 = IF(
    String(D11).trim().toLowerCase() === "лхдф белый",
    IFERROR(() => (D31 * D33) / 1_000_000 * (VLOOKUP(D11, materials) + addSheet), 0),
    0
  );

  // E11 — цвет задней стенки витрины (для любого материала)
  const E11 = IFERROR(() => (D31 * D33) / 1_000_000 * (VLOOKUP(G5, materials) + addSheet), 0);

  // H7 — корпус
  const materialPrice = VLOOKUP(G7, materials);
  const H7 = (materialPrice + addSheet) * SUM(N10, N7) + (edgePricePerM + addEdge) * SUM(N11, N8);

  // H9 — фасады
  const specialMaterials = ["латунь", "черный браш"];
  const g9lower = String(G9).trim().toLowerCase();
  const H9 = IF(
    specialMaterials.includes(g9lower),
    N13 * (Number(refs.specialFacadePrice1) || 0) + N13 * (Number(refs.specialFacadePrice2) || 0),
    IFERROR(() => (VLOOKUP(G9, materials) + addSheet) * N13 + (VLOOKUP(G9, materials, 2) + addEdge) * N14, 0)
  );

  // H18 — подъёмные механизмы
  const H18 = IFERROR(() => HW_LOOKUP(G18, hardware) * D18, 0);

  // H22 — петли
  const hingeWithDamper = HW_LOOKUP("С доводчиком", hardware) || HW_LOOKUP("петля с доводчиком", hardware);
  const hingePush = HW_LOOKUP("От нажатия", hardware) || HW_LOOKUP("петля от нажатия", hardware);
  const screwPrice = HW_LOOKUP("Саморез 3,5х16", hardware);

  const hwQty = (lookupKey, col) => {
    for (const key of resolveMatrixKeys(lookupKey, hardware)) {
      const qty = Number(hardwareMatrix[key]?.[col]);
      if (Number.isFinite(qty) && qty !== 0) return qty;
    }
    return 0;
  };

  const hwRowTotal = (lookupKey) => SUM(...HW_MATRIX_COLUMNS.map((col) => hwQty(lookupKey, col)));

  const rowTotalByNames = (names, fallback = 0) => {
    for (const name of [].concat(names)) {
      const total = hwRowTotal(name);
      if (total > 0) return total;
    }
    return fallback;
  };

  const N31 = rowTotalByNames(["Саморез 3,5х16", "screw_3_5x16"], D22 * 2);
  const H22 = IFERROR(
    () =>
      IF(
        G20 === "С доводчиком",
        hingeWithDamper * D22 + N31 * screwPrice,
        IF(G20 === "От нажатия", hingePush * D22 + N31 * screwPrice, 0)
      ),
    0
  );

  // H24 — полки
  const P34 = rowTotalByNames(["FLIPPER", "flipper"], 0);
  const H24 = IFERROR(
    () =>
      IF(
        G24 === "Съемные",
        (VLOOKUP(G7, materials) + addSheet) * (D31 * D35 / 1_000_000 * O5) + HW_LOOKUP("FLIPPER", hardware) * P34,
        0
      ) * D24,
    0
  );

  // H26 — навесы
  const H26 = IFERROR(
    () =>
      IF(
        G26 === "801 навесы верх. яруса(крабы комплект л+п)",
        HW_LOOKUP("801 навесы верх. яруса(крабы комплект л+п)", hardware) * D26 / 2 +
          SUM(HW_LOOKUP("навес краб л", hardware), HW_LOOKUP("навес краб п", hardware)),
        IF(
          G26 === "807 Мебельный навес для коробов нижнего яруса (л+п)",
          HW_LOOKUP("807 Мебельный навес для коробов нижнего яруса (л+п)", hardware) * D26 / 2,
          IF(
            G26 === "STELS СН11 (скрытый л+п)",
            HW_LOOKUP("STELS СН11 (скрытый л+п)", hardware) * D26 / 2,
            0
          )
        )
      ),
    0
  );

  // H28 — опоры
  const O32 = rowTotalByNames(["Саморез 3,5х19", "screw_3_5x19"], D28);
  const H28 = IFERROR(
    () =>
      IF(
        G28 === "Пластиковые с регулировкой",
        (HW_LOOKUP("Пластиковые с регулировкой", hardware) + HW_LOOKUP("Саморез 3,5х19", hardware) * O32) * D28,
        IF(
          G28 === "Скрытые мебельные (Integrato)",
          (HW_LOOKUP("Скрытые мебельные (Integrato)", hardware) + screwPrice * O32) * D28,
          IF(G28 === "Вбивные опоры (ОС - 17)", HW_LOOKUP("Вбивные опоры (ОС - 17)", hardware) * D28, 0)
        )
      ),
    0
  );

  const M31 = N31;

  // L20-L22 — ящики
  const drawerHwPrice = (typeName, count) => {
    if (!count || count === "нет" || count === 0) return 0;
    return IFERROR(() => (HW_LOOKUP(typeName, hardware) + screwPrice * M31) * count, 0);
  };

  const J20 = "Slim TL A, высота 84мм белый";
  const J21 = "Slim TL A, высота 116мм, белый";
  const J22 = "Slim TL A, высота 199мм, белый";

  const L20 = drawerHwPrice(J20, K20 || "нет");
  const L21 = drawerHwPrice(J21, K21 || "нет");
  const L22 = drawerHwPrice(J22, K22 || "нет");

  const fasteningItems = (hardware || [])
    .filter((item) => normalizeKey(item.category) === FASTENER_CATEGORY)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ru"));

  const hardwareRows = fasteningItems.map((item) => {
    const key = String(item.id);
    const unitPrice = Number(item.price_per_unit) || 0;
    const row = {
      key,
      id: item.id,
      label: item.name,
      unitPrice,
    };

    let qty = 0;
    for (const col of HW_MATRIX_COLUMNS) {
      row[col] = hwQty(key, col);
      qty += row[col];
    }
    row.price = unitPrice * qty;
    return row;
  });

  const U37 = SUM(...hardwareRows.map((row) => row.price));

  const sumH = SUM(H5, H7, H9, H18, H22, H24, H26, H28);
  const sumL = SUM(L20, L21, L22);
  const S = sumH + sumL + E11 + U37;
  const markupSheet = addSheet * SUM(N10, N7);
  const markupEdge = addEdge * SUM(N11, N8, N14);
  const markupGeneral = S * (L4 - 1);
  const S_withAdd = S + markupSheet + markupEdge;
  const K3 = ROUND(S_withAdd * L4, 0);

  return {
    price: K3,
    breakdown: {
      H5, H7, H9, H18, H22, H24, H26, H28,
      L20, L21, L22,
      E11, U37,
      sumH, sumL, S, coefficient: L4,
      markupSheet, markupEdge, markupGeneral,
      addSheet, addEdge,
    },
    fieldBreakdown: {
      back_panel: H5,
      showcase_back_panel_color: E11,
      material_corpus: H7,
      corpus_color: H7,
      material_facade: H9,
      facade_color: H9,
      lift_mechanism: H18,
      hinges_type: H22,
      drawers_type: 0,
      shelves_type: H24,
      hangers_type: H26,
      supports_type: H28,
      drawers_detail: SUM(L20, L21, L22),
      hardware_small: U37,
    },
    areas: {
      corpusArea: ROUND(N7, 4),
      corpusPerimeter: ROUND(N8, 4),
      drawersArea: ROUND(N10, 4),
      drawersPerimeter: ROUND(N11, 4),
      facadeArea: ROUND(N13, 4),
      facadePerimeter: ROUND(N14, 4),
    },
    drawers: {
      types: [
        { key: "84", label: "84 мм", price: L20, area: ROUND(M20, 4), perimeter: ROUND(N20, 4), facadePerimeter: ROUND(O20, 4), count: K20 },
        { key: "116", label: "116 мм", price: L21, area: ROUND(M21, 4), perimeter: ROUND(N21, 4), facadePerimeter: ROUND(O21, 4), count: K21 },
        { key: "199", label: "199 мм", price: L22, area: ROUND(M22, 4), perimeter: ROUND(N22, 4), facadePerimeter: ROUND(O22, 4), count: K22 },
      ],
    },
    hardware: {
      rows: hardwareRows,
      total: ROUND(U37, 2),
    },
    details: { D31, D33, D35, D16, N7, N8, N10, N11, N13, N14, K20, K21, K22, O4, O5, addSheet, addEdge },
  };
};

module.exports = {
  ROUND,
  SUM,
  IF,
  IFERROR,
  VLOOKUP,
  calculateModulePrice,
  parseDrawerCounts,
};
