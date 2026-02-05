const normalizeKey = (v) => String(v ?? "").trim();

const CATEGORY_GROUP_CODES = {
  "Кухня": "Kitchen",
  "Прихожая": "EntranceHall",
  "Гостиная": "Livingroom",
  "Спальня": "Bedroom",
};

const CATEGORY_CODES = {
  // Hallway
  "Готовые прихожие": "ReadyMadeHallways",
  "Шкафы": "Wardrobes",
  "Обувницы": "Shoeracks",
  "Комоды": "Dressers",
  "Тумбы подвесные": "WallCabinets",
  "Рейки": "Slats",
  "Верхние шкафы": "TopCabinets",
  "Аксессуары для прихожей": "HallwayAccessories",
  "Доборные элементы": "Fillers",

  // Livingroom
  "Стенки для гостиной": "LivingroomWalls",
  "ТВ зоны": "TvZones",
  "Стеллажи": "Shelving",
  "Настенные полки": "WallShelves",
  "Журнальные столики": "CoffeeTables",

  // Bedroom
  "Комплект мебели для спальни": "BedroomSets",
  "Кровати": "Beds",
  "Туалетные столики": "DressingTables",
  "Прикроватные тумбы": "Bedside",

  // Kitchen catalog
  "Готовые кухни": "ReadyMadeKitchens",
  "Столешницы": "Countertops",
  "Аксессуары для кухни": "KitchenAccessories",
};

const resolveCategoryGroupCode = (categoryGroup) => {
  const key = normalizeKey(categoryGroup);
  return CATEGORY_GROUP_CODES[key] || key;
};

const resolveCategoryCode = (category) => {
  const key = normalizeKey(category);
  return CATEGORY_CODES[key] || key;
};

module.exports = {
  resolveCategoryGroupCode,
  resolveCategoryCode,
};
