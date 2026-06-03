const siteSettingsService = require("../services/site-settings.service");

const getAdmin = async (_req, res) => {
  const data = await siteSettingsService.getSettings();
  res.status(200).json({ data });
};

const updateAdmin = async (req, res) => {
  const settings = req.body?.settings ?? req.body;
  const data = await siteSettingsService.saveSettings(settings);
  res.status(200).json({ data });
};

const getPublic = async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const data = await siteSettingsService.getSettings();
  res.status(200).json({ data: data.settings });
};

module.exports = {
  getAdmin,
  updateAdmin,
  getPublic,
};
