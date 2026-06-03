const { query } = require("../config/db");

const DEFAULT_SETTINGS = {
  header: {
    logoText: "NeXaos",
    navLinks: [
      { label: "Каталог", url: "/catalog" },
      { label: "Контакты", url: "/contacts" },
      { label: "Отзывы", url: "/reviews" },
    ],
    socialLinks: [],
  },
};

const normalizeSocialLink = (item, index) => {
  if (!item || typeof item !== "object") return null;
  const url = String(item.url || "").trim();
  if (!url) return null;
  const icon = String(item.icon || "link").trim().toLowerCase() || "link";
  const label = String(item.label || icon).trim() || icon;
  const id = String(item.id || `social-${index}`).trim() || `social-${index}`;
  return { id, label, url, icon, sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index };
};

const normalizeHeader = (header) => {
  const base = DEFAULT_SETTINGS.header;
  const input = header && typeof header === "object" ? header : {};
  const logoText = String(input.logoText || base.logoText).trim() || base.logoText;

  const navLinks = Array.isArray(input.navLinks)
    ? input.navLinks
        .map((link) => {
          if (!link || typeof link !== "object") return null;
          const label = String(link.label || "").trim();
          const url = String(link.url || "").trim();
          if (!label || !url) return null;
          return { label, url };
        })
        .filter(Boolean)
    : base.navLinks;

  const socialLinks = Array.isArray(input.socialLinks)
    ? input.socialLinks
        .map((item, index) => normalizeSocialLink(item, index))
        .filter(Boolean)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item, index) => ({ ...item, sortOrder: index }))
    : [];

  return { logoText, navLinks, socialLinks };
};

const normalizeSettings = (raw) => {
  const input = raw && typeof raw === "object" ? raw : {};
  return {
    header: normalizeHeader(input.header),
  };
};

const getSettings = async () => {
  const { rows } = await query(`SELECT settings, updated_at FROM site_settings WHERE id = 1`);
  if (!rows[0]) {
    return { settings: DEFAULT_SETTINGS, updated_at: null };
  }
  return {
    settings: normalizeSettings(rows[0].settings),
    updated_at: rows[0].updated_at,
  };
};

const saveSettings = async (rawSettings) => {
  const settings = normalizeSettings(rawSettings);
  const { rows } = await query(
    `INSERT INTO site_settings (id, settings, updated_at)
     VALUES (1, $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW()
     RETURNING settings, updated_at`,
    [JSON.stringify(settings)]
  );
  return {
    settings: normalizeSettings(rows[0].settings),
    updated_at: rows[0].updated_at,
  };
};

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  normalizeSettings,
};
