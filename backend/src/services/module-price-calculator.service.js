/**
 * Аналоги Excel-функций для расчёта стоимости модуля.
 */
const ROUND = (value, digits = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
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

  const materials = refs.materials || [];
  const hardware = refs.hardware || [];
  const edgePricePerM = Number(refs.edgePricePerM) || VLOOKUP("Кромка", materials, 2) || 0;

  const G5 = chars.showcase_back_panel_color || chars.back_panel || "";
  const G7 = chars.corpus_color || chars.material_corpus || "";
  const G9 = chars.facade_color || chars.material_facade || "";
  const G18 = chars.lift_mechanism || "";
  const D18 = Number(chars.lift_mechanism_count) || 0;
  const G20 = chars.hinges_type || chars.drawers_type || "";
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

  // N7 — площадь корпуса
  const N7 = IFERROR(
    () => (((D31 * D35) + ((D33 - 100) * D35 * 2) + ((D31 * 80) * 2)) / 1_000_000) * O4,
    0
  );

  // N8 — периметр корпуса
  const N8 = IFERROR(
    () => ((((D31 + D35) * 2) + (((D33 - 100 + D35) * 2) * 2) + (2 * (D31 + 80) * 2)) / 1000) * O5,
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

  // H5 — задняя стенка витрины
  const H5 = IFERROR(() => (D31 * D33) / 1_000_000 * VLOOKUP(G5, materials), 0);
  const E11 = H5;

  // H7 — корпус
  const materialPrice = VLOOKUP(G7, materials);
  const H7 = materialPrice * SUM(N10, N7) + SUM(N11, N8) * edgePricePerM;

  // H9 — фасады
  const specialMaterials = ["латунь", "черный браш"];
  const g9lower = String(G9).trim().toLowerCase();
  const H9 = IF(
    specialMaterials.includes(g9lower),
    N13 * (Number(refs.specialFacadePrice1) || 0) + N13 * (Number(refs.specialFacadePrice2) || 0),
    IFERROR(() => VLOOKUP(G9, materials) * N13 + N14 * VLOOKUP(G9, materials, 2), 0)
  );

  // H18 — подъёмные механизмы
  const H18 = IFERROR(() => HW_LOOKUP(G18, hardware) * D18, 0);

  // H22 — петли
  const hingeWithDamper = HW_LOOKUP("С доводчиком", hardware) || HW_LOOKUP("петля с доводчиком", hardware);
  const hingePush = HW_LOOKUP("От нажатия", hardware) || HW_LOOKUP("петля от нажатия", hardware);
  const screwPrice = HW_LOOKUP("Саморез 3,5х16", hardware);
  const N31 = Number(hardwareMatrix.screw_3_5x16?.total) || D22 * 2;
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
  const P34 = Number(hardwareMatrix.flipper?.total) || 0;
  const H24 = IFERROR(
    () =>
      IF(
        G24 === "Съемные",
        VLOOKUP(G7, materials) * (D31 * D35 / 1_000_000 * O5) + HW_LOOKUP("FLIPPER", hardware) * P34,
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
  const O32 = Number(hardwareMatrix.screw_3_5x19?.total) || D28;
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

  // Фурнитура U28-U37
  const hwQty = (key, col) => Number(hardwareMatrix[key]?.[col]) || 0;
  const hwRowTotal = (key) => {
    const cols = ["drawer", "hinge", "support", "shelf", "bottom", "post", "rail", "lid"];
    return SUM(...cols.map((c) => hwQty(key, c)));
  };

  const hwPrices = {
    cross_brace: HW_LOOKUP("Меж-я стяжка", hardware) || HW_LOOKUP("Межсекционная стяжка", hardware),
    dowel_8x30: HW_LOOKUP("Шкант 8х30", hardware),
    euro_screw_7x50: HW_LOOKUP("евровинт 7х50", hardware),
    screw_3_5x16: screwPrice,
    screw_3_5x19: HW_LOOKUP("Саморез 3,5х19", hardware),
    screw_4x60: HW_LOOKUP("Саморез 4x60", hardware),
    flipper: HW_LOOKUP("FLIPPER", hardware),
    eccentric: HW_LOOKUP("Эксцентрик", hardware),
    brace_d20: HW_LOOKUP("Стяжка D20", hardware),
  };

  const hardwareRows = [
    { key: "cross_brace", label: "Меж-я стяжка" },
    { key: "dowel_8x30", label: "Шкант 8х30" },
    { key: "euro_screw_7x50", label: "евровинт 7х50" },
    { key: "screw_3_5x16", label: "Саморез 3,5х16" },
    { key: "screw_3_5x19", label: "Саморез 3,5х19" },
    { key: "screw_4x60", label: "Саморез 4x60" },
    { key: "flipper", label: "FLIPPER" },
    { key: "eccentric", label: "Эксцентрик" },
    { key: "brace_d20", label: "Стяжка D20" },
  ].map((row) => {
    const qty = hwRowTotal(row.key);
    const unitPrice = hwPrices[row.key] || 0;
    return {
      ...row,
      drawer: hwQty(row.key, "drawer"),
      hinge: hwQty(row.key, "hinge"),
      support: hwQty(row.key, "support"),
      shelf: hwQty(row.key, "shelf"),
      bottom: hwQty(row.key, "bottom"),
      post: hwQty(row.key, "post"),
      rail: hwQty(row.key, "rail"),
      lid: hwQty(row.key, "lid"),
      price: unitPrice * qty,
    };
  });

  const U28 = hwPrices.cross_brace * hwRowTotal("cross_brace");
  const U29 = hwPrices.dowel_8x30 * hwRowTotal("dowel_8x30");
  const U30 = hwPrices.euro_screw_7x50 * hwRowTotal("euro_screw_7x50");
  const U31 = hwPrices.screw_3_5x16 * hwRowTotal("screw_3_5x16");
  const U32 = hwPrices.screw_3_5x19 * hwRowTotal("screw_3_5x19");
  const U33 = hwPrices.screw_4x60 * hwRowTotal("screw_4x60");
  const U34 = hwPrices.flipper * hwRowTotal("flipper");
  const U35 = hwPrices.eccentric * hwRowTotal("eccentric");
  const U36 = hwPrices.brace_d20 * hwRowTotal("brace_d20");
  const U37 = SUM(U28, U29, U30, U31, U32, U33, U34, U35, U36);

  const sumH = SUM(H5, H7, H9, H18, H22, H24, H26, H28);
  const sumL = SUM(L20, L21, L22);
  const S = sumH + sumL + E11 + U37;
  const K3 = ROUND(S * L4, 0);

  return {
    price: K3,
    breakdown: {
      H5, H7, H9, H18, H22, H24, H26, H28,
      L20, L21, L22,
      E11, U37,
      sumH, sumL, S, coefficient: L4,
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
    details: { D31, D33, D35, N7, N8, N10, N11, N13, N14 },
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
