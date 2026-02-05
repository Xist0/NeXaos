const ApiError = require("../utils/api-error");
const asyncHandler = require("../utils/async-handler");
const { query } = require("../config/db");

const getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const productId = parseInt(id, 10);
  if (isNaN(productId) || productId <= 0) {
    throw ApiError.badRequest("Некорректный ID товара");
  }

  const attachColors = async (row) => {
    if (!row || typeof row !== "object") return row;

    if (row.primary_color_id) {
      const { rows: primaryColorRows } = await query(
        `SELECT id, name, sku, image_url FROM colors WHERE id = $1`,
        [row.primary_color_id]
      );
      if (primaryColorRows[0]) row.primary_color = primaryColorRows[0];
    }

    if (row.secondary_color_id) {
      const { rows: secondaryColorRows } = await query(
        `SELECT id, name, sku, image_url FROM colors WHERE id = $1`,
        [row.secondary_color_id]
      );
      if (secondaryColorRows[0]) row.secondary_color = secondaryColorRows[0];
    }

    return row;
  };

  const attachImages = async (row, entityType) => {
    if (!row || typeof row !== "object") return row;
    const { rows: allImages } = await query(
      `SELECT id, url, alt, sort_order,
       (sort_order = 0) as is_preview
       FROM images
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY (sort_order IS NULL) ASC, sort_order ASC, id ASC`,
      [entityType, row.id]
    );

    row.images = allImages;
    if (!row.preview_url && allImages && allImages[0]?.url) {
      row.preview_url = allImages[0].url;
    }
    return row;
  };

  const { rows: modules } = await query(
    `SELECT m.*
     FROM modules m
     WHERE m.id = $1 AND m.is_active = true`,
    [productId]
  );

  if (modules.length) {
    const moduleRow = await attachImages({ ...modules[0] }, "modules");
    await attachColors(moduleRow);
    return res.status(200).json({ data: { ...moduleRow, __type: "module" } });
  }

  const { rows: catalogItems } = await query(
    `SELECT ci.*
     FROM catalog_items ci
     WHERE ci.id = $1 AND ci.is_active = true`,
    [productId]
  );

  if (catalogItems.length) {
    const catalogRow = await attachImages({ ...catalogItems[0] }, "catalog-items");
    await attachColors(catalogRow);
    return res.status(200).json({ data: { ...catalogRow, __type: "catalogItem" } });
  }

  return res.status(404).json({ message: "Товар не найден" });
});

module.exports = {
  getById,
};
