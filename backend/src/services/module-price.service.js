const { query } = require("../config/db");
const { calculateModulePrice } = require("./module-price-calculator.service");

const loadCalculationReferences = async () => {
  const [materialsRes, hardwareRes, coeffsRes, linearRes] = await Promise.all([
    query(
      `SELECT name, sku, price_per_m2, edge_price_per_m, price_per_sheet, category
       FROM sheet_materials WHERE is_active IS NOT FALSE`
    ),
    query(
      `SELECT id, name, sku, price_per_unit, price_per_m2, category
       FROM hardware_items_extended WHERE is_active IS NOT FALSE`
    ),
    query(`SELECT name, numeric_value, value FROM calculation_parameters`),
    query(
      `SELECT name, edge_price_per_m FROM linear_materials
       WHERE edge_price_per_m IS NOT NULL AND is_active IS NOT FALSE
       ORDER BY edge_price_per_m DESC LIMIT 1`
    ),
  ]);

  const materials = (materialsRes.rows || []).map((r) => ({
    name: r.name,
    sku: r.sku,
    price_per_m2: r.price_per_m2,
    edge_price_per_m: r.edge_price_per_m,
    price: r.price_per_m2,
    edgePrice: r.edge_price_per_m,
  }));

  const hardware = hardwareRes.rows || [];

  const coeffMap = {};
  for (const row of coeffsRes.rows || []) {
    const name = String(row.name || "").trim().toLowerCase();
    const num = Number(row.numeric_value);
    if (name.includes("добавочн") && name.includes("плитн")) coeffMap.addSheet = num;
    else if (name.includes("добавочн") && name.includes("кромк")) coeffMap.addEdge = num;
    else if (name.includes("общий") || name.includes("коэф. общий")) coeffMap.general = num;
    else if (name.includes("плитн")) coeffMap.sheet = num;
    else if (name.includes("кромк")) coeffMap.edge = num;
  }

  // Fallbacks only when DB has no matching row (undefined), not when value is 0
  if (coeffMap.general === undefined) coeffMap.general = 2.2;
  if (coeffMap.sheet === undefined) coeffMap.sheet = 1.2;
  if (coeffMap.edge === undefined) coeffMap.edge = 1.15;
  if (coeffMap.addSheet === undefined) coeffMap.addSheet = 0;
  if (coeffMap.addEdge === undefined) coeffMap.addEdge = 0;

  // Try: linear_materials max edge_price → Кромка from sheet_materials → any item with edge_price_per_m
  let edgePricePerM = linearRes.rows?.[0]?.edge_price_per_m || null;
  if (!edgePricePerM) {
    // Fallback: find any sheet material with category "Кромка" that has edge_price_per_m
    const кромкаItems = materials.filter((m) => m.category === "Кромка" && m.edge_price_per_m != null);
    if (кромкаItems.length > 0) {
      edgePricePerM = Math.max(...кромкаItems.map((m) => Number(m.edge_price_per_m) || 0));
    }
  }

  return { materials, hardware, coefficients: coeffMap, edgePricePerM };
};

const calculatePrice = async (input) => {
  const refs = await loadCalculationReferences();
  return calculateModulePrice(input, refs);
};

module.exports = { calculatePrice, loadCalculationReferences };
