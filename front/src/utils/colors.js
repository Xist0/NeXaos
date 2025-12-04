export const COLOR_PALETTE = {
  // Примеры. При необходимости можно дополнять своими кодами.
  cashmere_grey: { name: "Кашемир серый", hex: "#B5ADA4" },
  white: { name: "Белый", hex: "#FFFFFF" },
  black: { name: "Чёрный", hex: "#000000" },
};

export const resolveColor = (value) => {
  if (!value) return null;

  const key = String(value).trim().toLowerCase().replace(/\s+/g, "_");
  const fromMap = COLOR_PALETTE[key];
  if (fromMap) {
    return { label: fromMap.name, hex: fromMap.hex };
  }

  // Если пришёл уже hex или CSS-цвет — просто используем его
  return { label: value, hex: value };
};




