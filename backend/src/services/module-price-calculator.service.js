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

const normalizeKey = (value) => String(value ?? "").trim().toLowerCase();

const FASTENER_CATEGORY = "крепежная фурнитура";

const HW_MATRIX_COLUMNS = ["drawer", "hinge", "support", "shelf", "bottom", "post", "rail", "lid"];

/** Форматирование значения с аннотацией параметра для формул разбивки стоимости. */
const fa = (val, label, digits = 2) => `${ROUND(Number(val) || 0, digits)} (${label})`;

/** Человекочитаемые названия столбцов матрицы фурнитуры. */
const COL_LABELS = {
  drawer: "ящик",
  hinge: "петля",
  support: "опора",
  shelf: "полка",
  bottom: "дно",
  post: "стойка",
  rail: "царга",
  lid: "крышка",
};

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

  // Фоллбэк: если drawer_count задан, но типы не разбиты — всё считаем как 116 мм
  if (!result.k84 && !result.k116 && !result.k199) {
    const drawerCount = Number(characteristics.drawer_count) || 0;
    if (drawerCount > 0) {
      result.k116 = drawerCount;
      result.types.push({ type: "116 мм", qty: drawerCount, key: "116" });
    }
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
  const G_edge_band = chars.edge_band || "";
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

  const supportsH = Number(chars.supports_height_mm) || 100;

  // Извлечённые lookup-значения (используются в формулах и расчётах)
  const backPanelPrice = VLOOKUP(D11, materials);
  const showcaseBackPanelPrice = VLOOKUP(G5, materials);
  const specialPrice1 = Number(refs.specialFacadePrice1) || 0;
  const specialPrice2 = Number(refs.specialFacadePrice2) || 0;
  const facadeMaterialPrice = VLOOKUP(G9, materials);
  const liftMechRow = G18 ? hardware.find(
    (r) =>
      String(r.name ?? "").trim().toLowerCase() === String(G18 ?? "").trim().toLowerCase() ||
      String(r.sku ?? "").trim().toLowerCase() === String(G18 ?? "").trim().toLowerCase()
  ) : null;
  const liftMechPrice = liftMechRow ? Number(liftMechRow.price_per_unit ?? 0) || 0 : HW_LOOKUP(G18, hardware);
  const flipperPrice = HW_LOOKUP("FLIPPER", hardware);
  const screwPrice = HW_LOOKUP("Саморез 3,5х16", hardware);
  const screw35x19Price = HW_LOOKUP("Саморез 3,5х19", hardware);

  const drawers = parseDrawerCounts(chars.drawers_detail, chars);
  const K20 = drawers.k84;
  const K21 = drawers.k116;
  const K22 = drawers.k199;

  // N7 — площадь корпуса (дно + крышка + 2 боковины)
  const N7 = IFERROR(
    () => (2 * D31 * D35 + 2 * (D33 - supportsH) * D35) / 1_000_000 * O4,
    0
  );

  // N8 — периметр корпуса (дно + крышка + 2 боковины)
  const N8 = IFERROR(
    () => (4 * (D31 + D35) + 4 * (D33 - supportsH + D35)) / 1000 * O5,
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
  const O20 = IFERROR(() => ((D31 + ((D33 - supportsH) / 4)) * 2 / 1000) * K20, 0);
  const O21 = IFERROR(() => ((D31 + ((D33 - supportsH) / 4)) * 2 / 1000) * K21, 0);
  const O22 = IFERROR(() => ((D31 + ((D33 - supportsH) / 4 * 2)) * 2 / 1000) * K22, 0);

  const N10 = SUM(M20, M21, M22) * O4;
  const N11 = SUM(N20, N21, N22) * O5;
  const N13 = (D31 * (D33 - supportsH)) / 1_000_000 * O4;

  // N14 — периметр фасада для кромки
  // Модули с ящиками: периметр фасадов ящиков (O20+O21+O22) × O5
  // Модули с распашными дверями: дверной периметр × O5
  const totalDrawerCount = K20 + K21 + K22;
  const drawerFacadePerimeter = SUM(O20, O21, O22);
  const doorFacadePerimeterRaw = ((D31 / D16) + (D33 - supportsH)) * 2 / 1000 * D16;
  const N14 = totalDrawerCount > 0
    ? drawerFacadePerimeter * O5
    : IFERROR(() => doorFacadePerimeterRaw * O5, drawerFacadePerimeter * O5);

  // H5 — задняя стенка (для любого материала)
  const H5 = IFERROR(() => (D31 * D33) / 1_000_000 * (backPanelPrice + addSheet), 0);
  const H5_formula = `${fa(D31,'Ш')} × ${fa(D33,'В')} / 10⁶ × (${fa(backPanelPrice,'цена_м²')} + ${fa(addSheet,'нац_плит')})`;

  // E11 — цвет задней стенки витрины (для любого материала)
  const E11 = IFERROR(() => (D31 * D33) / 1_000_000 * (showcaseBackPanelPrice + addSheet), 0);
  const E11_formula = `${fa(D31,'Ш')} × ${fa(D33,'В')} / 10⁶ × (${fa(showcaseBackPanelPrice,'цена_м²')} + ${fa(addSheet,'нац_плит')})`;

  // H7 — корпус (uses specific material's edge price with fallback to global)
  const materialPrice = VLOOKUP(G7, materials);
  const edgePriceCorpus = G_edge_band ? VLOOKUP(G_edge_band, materials, 2) : (VLOOKUP(G7, materials, 2) || edgePricePerM);
  const H7_sheet = (materialPrice + addSheet) * SUM(N10, N7);
  const H7_edge = (edgePriceCorpus + addEdge) * SUM(N11, N8);
  const H7 = H7_sheet + H7_edge;
  const H7_sheet_formula = `(${fa(materialPrice,'цена_лист')} + ${fa(addSheet,'нац_плит')}) × (${fa(N10,'S_ящик')} + ${fa(N7,'S_корп')})`;
  const H7_edge_formula = `(${fa(edgePriceCorpus,'цена_кромки')} + ${fa(addEdge,'нац_кромки')}) × (${fa(N11,'P_ящик')} + ${fa(N8,'P_корп')})`;
  const H7_formula = `${fa(H7_sheet,'лист')} + ${fa(H7_edge,'кромка')}`;

  // H9 — фасады
  const specialMaterials = ["латунь", "черный браш"];
  const g9lower = String(G9).trim().toLowerCase();
  const edgePriceFacade = G_edge_band ? VLOOKUP(G_edge_band, materials, 2) : (VLOOKUP(G9, materials, 2) || edgePricePerM);
  let H9_sheet, H9_edge, H9, H9_sheet_formula, H9_edge_formula, H9_formula;
  if (specialMaterials.includes(g9lower)) {
    H9_sheet = N13 * (specialPrice1 + specialPrice2);
    H9_edge = 0;
    H9 = H9_sheet;
    H9_sheet_formula = `${fa(N13,'S_фасад')} × (${fa(specialPrice1,'цена_спец1')} + ${fa(specialPrice2,'цена_спец2')})`;
    H9_edge_formula = "0";
    H9_formula = H9_sheet_formula;
  } else {
    H9_sheet = (facadeMaterialPrice + addSheet) * N13;
    H9_edge = (edgePriceFacade + addEdge) * N14;
    H9 = IFERROR(() => H9_sheet + H9_edge, 0);
    H9_sheet_formula = `(${fa(facadeMaterialPrice,'цена_лист')} + ${fa(addSheet,'нац_плит')}) × ${fa(N13,'S_фасад')}`;
    H9_edge_formula = `(${fa(edgePriceFacade,'цена_кромки')} + ${fa(addEdge,'нац_кромки')}) × ${fa(N14,'P_фасад')}`;
    H9_formula = `${fa(H9_sheet,'лист')} + ${fa(H9_edge,'кромка')}`;
  }

  // H18 — подъёмные механизмы
  const H18 = IFERROR(() => liftMechPrice * D18, 0);
  const H18_formula = `${fa(liftMechPrice,'цена_мех')} × ${fa(D18,'кол-во')}`;

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

  // H22 — петли (динамический lookup по названию из dropdown)
  const hingePrice = HW_LOOKUP(G20, hardware);
  const N31 = rowTotalByNames(["Саморез 3,5х16", "screw_3_5x16"]);
  const H22 = (hingePrice > 0 && D22 > 0)
    ? IFERROR(() => hingePrice * D22 + (N31 > 0 ? N31 * screwPrice : 0), 0)
    : 0;
  const H22_formula = (hingePrice > 0 && D22 > 0)
    ? N31 > 0
      ? `${fa(hingePrice,'цена_петля')} × ${fa(D22,'кол-во')} + ${fa(N31,'кол-во_саморез')} × ${fa(screwPrice,'цена_саморез')}`
      : `${fa(hingePrice,'цена_петля')} × ${fa(D22,'кол-во')}`
    : "0";

  // H24 — полки (всегда считаем материал при D24 > 0, flipper только для съемных)
  const P34 = rowTotalByNames(["FLIPPER", "flipper"], 0);
  const shelfArea = D31 * D35 / 1_000_000 * O5;
  const shelvesHasFlipper = /съемн/i.test(G24);
  let H24, H24_formula;
  if (D24 > 0) {
    const shelfMaterialCost = (materialPrice + addSheet) * shelfArea;
    const shelfFlipperCost = shelvesHasFlipper ? flipperPrice * P34 : 0;
    H24 = IFERROR(() => (shelfMaterialCost + shelfFlipperCost) * D24, 0);
    if (shelvesHasFlipper) {
      H24_formula = `[(${fa(materialPrice,'цена_лист')} + ${fa(addSheet,'нац_плит')}) × ${fa(shelfArea,'S_полки')} + ${fa(flipperPrice,'цена_FLIPPER')} × ${fa(P34,'кол-во_FLIPPER')}] × ${fa(D24,'кол-во_полок')}`;
    } else {
      H24_formula = `(${fa(materialPrice,'цена_лист')} + ${fa(addSheet,'нац_плит')}) × ${fa(shelfArea,'S_полки')} × ${fa(D24,'кол-во_полок')}`;
    }
  } else { H24 = 0; H24_formula = "0"; }

  // H26 — навесы (динамический lookup; "(л+п)" типы — D26 делится на 2, крабы — спецформула)
  const hangerPrice = HW_LOOKUP(G26, hardware);
  const hangerIsPair = /(?:\(л+п\)|\(комплект л+п\))/i.test(G26);
  const hangerIsCrabKit = /крабы комплект/i.test(G26);
  const hangerQty = hangerIsPair ? D26 / 2 : D26;
  let H26, H26_formula;
  if (hangerIsCrabKit && D26 > 0) {
    const crabLeftPrice = HW_LOOKUP("навес краб л", hardware);
    const crabRightPrice = HW_LOOKUP("навес краб п", hardware);
    H26 = IFERROR(() => hangerPrice * hangerQty + crabLeftPrice + crabRightPrice, 0);
    H26_formula = `${fa(hangerPrice,'цена_комплект')} × ${fa(hangerQty,'пар')} + ${fa(crabLeftPrice,'краб_л')} + ${fa(crabRightPrice,'краб_п')}`;
  } else if (hangerPrice > 0 && D26 > 0) {
    H26 = IFERROR(() => hangerPrice * hangerQty, 0);
    H26_formula = hangerIsPair
      ? `${fa(hangerPrice,'цена_навес')} × ${fa(hangerQty,'пар')} (D26=${D26}/2)`
      : `${fa(hangerPrice,'цена_навес')} × ${fa(D26,'кол-во')}`;
  } else { H26 = 0; H26_formula = "0"; }

  // H28 — опоры (динамический lookup; вбивные — без саморезов, Integrato — Саморез 3,5х16, остальные — 3,5х19)
  const O32 = rowTotalByNames(["Саморез 3,5х19", "screw_3_5x19"]);
  const supportPrice = HW_LOOKUP(G28, hardware);
  const supportNoScrews = /вбив/i.test(G28);
  const supportUse35x16 = /integrato/i.test(G28);
  const supportScrewPrice = supportNoScrews ? 0 : supportUse35x16 ? screwPrice : screw35x19Price;
  let H28, H28_formula;
  if (supportPrice > 0 && D28 > 0) {
    H28 = IFERROR(() => (supportPrice + (O32 > 0 ? supportScrewPrice * O32 : 0)) * D28, 0);
    if (supportNoScrews) {
      H28_formula = `${fa(supportPrice,'цена_опора')} × ${fa(D28,'кол-во_опор')} (без саморезов)`;
    } else if (supportUse35x16) {
      H28_formula = O32 > 0
        ? `(${fa(supportPrice,'цена_опора')} + ${fa(screwPrice,'саморез_3,5х16')} × ${fa(O32,'кол-во')}) × ${fa(D28,'кол-во_опор')}`
        : `${fa(supportPrice,'цена_опора')} × ${fa(D28,'кол-во_опор')}`;
    } else {
      H28_formula = O32 > 0
        ? `(${fa(supportPrice,'цена_опора')} + ${fa(screw35x19Price,'саморез_3,5х19')} × ${fa(O32,'кол-во')}) × ${fa(D28,'кол-во_опор')}`
        : `${fa(supportPrice,'цена_опора')} × ${fa(D28,'кол-во_опор')}`;
    }
  } else { H28 = 0; H28_formula = "0"; }

  const M31 = rowTotalByNames(["Саморез 3,5х16", "screw_3_5x16"]);

  // L20-L22 — ящики
  const J20 = "Slim TL A, высота 84мм белый";
  const J21 = "Slim TL A, высота 116мм, белый";
  const J22 = "Slim TL A, высота 199мм, белый";
  const drawer84Price = HW_LOOKUP(J20, hardware);
  const drawer116Price = HW_LOOKUP(J21, hardware);
  const drawer199Price = HW_LOOKUP(J22, hardware);

  const L20 = K20 ? IFERROR(() => (drawer84Price + (M31 > 0 ? screwPrice * M31 : 0)) * K20, 0) : 0;
  const L21 = K21 ? IFERROR(() => (drawer116Price + (M31 > 0 ? screwPrice * M31 : 0)) * K21, 0) : 0;
  const L22 = K22 ? IFERROR(() => (drawer199Price + (M31 > 0 ? screwPrice * M31 : 0)) * K22, 0) : 0;
  const L20_formula = K20 ? M31 > 0
    ? `(${fa(drawer84Price,'цена_ящик')} + ${fa(screwPrice,'цена_саморез')} × ${fa(M31,'кол-во_саморез')}) × ${fa(K20,'кол-во')}`
    : `${fa(drawer84Price,'цена_ящик')} × ${fa(K20,'кол-во')}`
    : "0";
  const L21_formula = K21 ? M31 > 0
    ? `(${fa(drawer116Price,'цена_ящик')} + ${fa(screwPrice,'цена_саморез')} × ${fa(M31,'кол-во_саморез')}) × ${fa(K21,'кол-во')}`
    : `${fa(drawer116Price,'цена_ящик')} × ${fa(K21,'кол-во')}`
    : "0";
  const L22_formula = K22 ? M31 > 0
    ? `(${fa(drawer199Price,'цена_ящик')} + ${fa(screwPrice,'цена_саморез')} × ${fa(M31,'кол-во_саморез')}) × ${fa(K22,'кол-во')}`
    : `${fa(drawer199Price,'цена_ящик')} × ${fa(K22,'кол-во')}`
    : "0";

  const FASTENER_SORT_ORDER = [
    "меж-я стяжка", "межсекционная стяжка",
    "шкант 8х30",
    "евровинт 7х50",
    "саморез 3,5х16",
    "саморез 3,5х19",
    "саморез 4x60",
    "flipper",
    "эксцентрик",
    "стяжка d20",
  ];

  const fasteningSortIndex = (name) => {
    const key = normalizeKey(name);
    const idx = FASTENER_SORT_ORDER.findIndex((o) => key === normalizeKey(o));
    return idx >= 0 ? idx : FASTENER_SORT_ORDER.length;
  };

  const fasteningItems = (hardware || [])
    .filter((item) => normalizeKey(item.category) === FASTENER_CATEGORY)
    .sort((a, b) => fasteningSortIndex(a.name) - fasteningSortIndex(b.name));

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
    row.qty = qty;
    const nonZeroParts = HW_MATRIX_COLUMNS.filter(col => row[col] > 0).map(col => `${fa(row[col], COL_LABELS[col])}`).join(' + ');
    row.formula = nonZeroParts ? `${fa(unitPrice,'цена_шт')} × (${nonZeroParts})` : `${fa(unitPrice,'цена_шт')} × 0`;
    row.price = unitPrice * qty;
    return row;
  });

  const U37 = SUM(...hardwareRows.map((row) => row.price));
  const U37_formula = hardwareRows.filter(row => row.price > 0).map(row => `${fa(row.price, row.label)}`).join(' + ') || "0";

  const sumH = SUM(H5, H7, H9, H18, H22, H24, H26, H28);
  const sumL = SUM(L20, L21, L22);
  const S = sumH + sumL + E11 + U37;
  const markupSheet = addSheet * SUM(N10, N7);
  const markupEdge = addEdge * SUM(N11, N8, N14);
  const markupGeneral = S * (L4 - 1);
  const S_withAdd = S + markupSheet + markupEdge;
  const K3 = ROUND(S_withAdd * L4, 0);

  const sumH_formula = `${fa(H5,'задняя_стенка')} + ${fa(H7,'корпус')} + ${fa(H9,'фасад')} + ${fa(H18,'механизм')} + ${fa(H22,'петли')} + ${fa(H24,'полки')} + ${fa(H26,'навесы')} + ${fa(H28,'опоры')}`;
  const sumL_parts = [];
  if (L20 > 0) sumL_parts.push(fa(L20,'ящик_84'));
  if (L21 > 0) sumL_parts.push(fa(L21,'ящик_116'));
  if (L22 > 0) sumL_parts.push(fa(L22,'ящик_199'));
  const sumL_formula = sumL_parts.length ? sumL_parts.join(' + ') : "0";
  const S_formula = `${fa(sumH,'корпус+фасад')} + ${fa(sumL,'ящики')} + ${fa(E11,'задняя_витрины')} + ${fa(U37,'расходники')}`;
  const markupSheet_formula = `${fa(addSheet,'нац_плит')} × (${fa(N10,'S_ящик')} + ${fa(N7,'S_корп')})`;
  const markupEdge_formula = `${fa(addEdge,'нац_кромки')} × (${fa(N11,'P_ящик')} + ${fa(N8,'P_корп')} + ${fa(N14,'P_фасад')})`;
  const markupGeneral_formula = `${fa(S,'сумма')} × (${fa(L4,'коэф')} − 1)`;

  return {
    price: K3,
    breakdown: {
      H5: { value: H5, formula: H5_formula },
      E11: { value: E11, formula: E11_formula },
      H7_sheet: { value: H7_sheet, formula: H7_sheet_formula },
      H7_edge: { value: H7_edge, formula: H7_edge_formula },
      H7: { value: H7, formula: H7_formula },
      H9_sheet: { value: H9_sheet, formula: H9_sheet_formula },
      H9_edge: { value: H9_edge, formula: H9_edge_formula },
      H9: { value: H9, formula: H9_formula },
      H18: { value: H18, formula: H18_formula },
      H22: { value: H22, formula: H22_formula },
      H24: { value: H24, formula: H24_formula },
      H26: { value: H26, formula: H26_formula },
      H28: { value: H28, formula: H28_formula },
      L20: { value: L20, formula: L20_formula },
      L21: { value: L21, formula: L21_formula },
      L22: { value: L22, formula: L22_formula },
      U37: { value: U37, formula: U37_formula },
      sumH: { value: sumH, formula: sumH_formula },
      sumL: { value: sumL, formula: sumL_formula },
      S: { value: S, formula: S_formula },
      coefficient: L4,
      markupSheet: { value: markupSheet, formula: markupSheet_formula },
      markupEdge: { value: markupEdge, formula: markupEdge_formula },
      markupGeneral: { value: markupGeneral, formula: markupGeneral_formula },
      addSheet, addEdge,
    },
    fieldBreakdown: {
      back_panel: H5,
      showcase_back_panel_color: E11,
      material_corpus: H7,
      corpus_color: H7,
      material_facade: H9,
      facade_color: H9,
      edge_band: edgePriceFacade * N14,
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
    details: { D31, D33, D35, D16, supportsH, N7, N8, N10, N11, N13, N14, K20, K21, K22, O4, O5, addSheet, addEdge,
      lift_mechanism_key: G18,
      lift_mechanism_found: liftMechRow ? liftMechRow.name : null,
      lift_mechanism_raw_price: liftMechRow?.price_per_unit ?? null,
      edge_band_key: G_edge_band,
      edge_band_used_for_corpus: !!G_edge_band,
    },
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
